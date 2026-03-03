const http = require('http');
const path = require('path');
const { createCompetitionApi } = require('./server/competition-api');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number.parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';
const WS_PATH = process.env.WS_PATH || '/ws';
const MAX_PLAYERS = clampNumber(
    Number.parseInt(process.env.MAX_PLAYERS || process.env.MAX_ROOM_SIZE || '4', 10),
    2,
    4
);
const MAX_WS_PAYLOAD_BYTES = clampNumber(
    Number.parseInt(process.env.MAX_WS_PAYLOAD_BYTES || '16384', 10),
    1024,
    262144
);
const RATE_LIMIT_WINDOW_MS = clampNumber(
    Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    1000,
    10 * 60 * 1000
);
const RATE_LIMIT_MAX_MESSAGES = clampNumber(
    Number.parseInt(process.env.RATE_LIMIT_MAX_MESSAGES || '180', 10),
    20,
    5000
);
const RATE_LIMIT_MAX_JOINS = clampNumber(
    Number.parseInt(process.env.RATE_LIMIT_MAX_JOINS || '30', 10),
    5,
    1000
);
const RATE_LIMIT_MAX_AUTH = clampNumber(
    Number.parseInt(process.env.RATE_LIMIT_MAX_AUTH || '25', 10),
    5,
    300
);
const SESSION_TTL_MS = clampNumber(
    Number.parseInt(process.env.SESSION_TTL_MS || String(7 * 24 * 60 * 60 * 1000), 10),
    60 * 60 * 1000,
    90 * 24 * 60 * 60 * 1000
);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'jeu.sqlite');
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const ALLOW_EMPTY_ORIGIN = String(process.env.ALLOW_EMPTY_ORIGIN || 'false').toLowerCase() === 'true';
const DEFAULT_ALLOWED_ORIGINS = [
    'capacitor://localhost',
    'http://localhost',
    'https://localhost',
    'https://*.onrender.com',
    'https://*.netlify.app',
    'https://*.github.io'
];
const ALLOWED_ORIGINS = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);

const rooms = new Map();
const rateLimitByIp = new Map();

function clampNumber(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, Math.trunc(value)));
}

function parseAllowedOrigins(rawValue) {
    const source = String(rawValue || '').trim();
    const entries = source
        ? source.split(',').map((entry) => entry.trim()).filter(Boolean)
        : [...DEFAULT_ALLOWED_ORIGINS];
    if (entries.length === 0) {
        return [...DEFAULT_ALLOWED_ORIGINS];
    }
    return Array.from(new Set(entries.map((entry) => entry.toLowerCase())));
}

function getDefaultPort(protocol) {
    if (protocol === 'http:' || protocol === 'ws:') return '80';
    if (protocol === 'https:' || protocol === 'wss:') return '443';
    return '';
}

function doesOriginMatchRule(originUrl, rule) {
    const normalizedRule = String(rule || '').trim().toLowerCase();
    if (!normalizedRule) return false;
    if (normalizedRule === '*') return true;

    const wildcardMatch = normalizedRule.match(/^([a-z][a-z0-9+.-]*):\/\/\*\.(.+)$/i);
    if (wildcardMatch) {
        const expectedProtocol = `${wildcardMatch[1].toLowerCase()}:`;
        const expectedDomain = wildcardMatch[2].toLowerCase();
        if (originUrl.protocol.toLowerCase() !== expectedProtocol) return false;
        const host = originUrl.hostname.toLowerCase();
        return host === expectedDomain || host.endsWith(`.${expectedDomain}`);
    }

    try {
        const ruleUrl = new URL(normalizedRule);
        const originProtocol = originUrl.protocol.toLowerCase();
        const ruleProtocol = ruleUrl.protocol.toLowerCase();
        if (originProtocol !== ruleProtocol) return false;

        const originHost = originUrl.hostname.toLowerCase();
        const ruleHost = ruleUrl.hostname.toLowerCase();
        if (originHost !== ruleHost) return false;

        const originPort = originUrl.port || getDefaultPort(originUrl.protocol);
        const rulePort = ruleUrl.port || getDefaultPort(ruleUrl.protocol);
        return originPort === rulePort;
    } catch (_error) {
        return false;
    }
}

function isOriginAllowed(originHeader) {
    const rawOrigin = String(originHeader || '').trim();
    if (!rawOrigin) return ALLOW_EMPTY_ORIGIN;

    let parsedOrigin;
    try {
        parsedOrigin = new URL(rawOrigin);
    } catch (_error) {
        return false;
    }

    return ALLOWED_ORIGINS.some((rule) => doesOriginMatchRule(parsedOrigin, rule));
}

function getClientIp(req) {
    const forwardedRaw = req?.headers?.['x-forwarded-for'];
    if (typeof forwardedRaw === 'string' && forwardedRaw.trim()) {
        return forwardedRaw.split(',')[0].trim();
    }
    return String(req?.socket?.remoteAddress || '').trim() || 'unknown';
}

function trimRateBucket(bucket, now) {
    while (bucket.length > 0 && (now - bucket[0]) > RATE_LIMIT_WINDOW_MS) {
        bucket.shift();
    }
}

function getRateEntry(ip) {
    const key = String(ip || 'unknown');
    let entry = rateLimitByIp.get(key);
    if (!entry) {
        entry = {
            messages: [],
            joins: [],
            lastSeenAt: Date.now()
        };
        rateLimitByIp.set(key, entry);
    }
    return entry;
}

function hitRateLimit(ip, bucketName, maxHits) {
    const now = Date.now();
    const entry = getRateEntry(ip);
    const bucket = bucketName === 'joins' ? entry.joins : entry.messages;
    trimRateBucket(bucket, now);
    bucket.push(now);
    entry.lastSeenAt = now;
    return bucket.length > maxHits;
}

function pruneRateLimitMap() {
    const now = Date.now();
    const staleThreshold = RATE_LIMIT_WINDOW_MS * 3;
    for (const [ip, entry] of rateLimitByIp.entries()) {
        trimRateBucket(entry.messages, now);
        trimRateBucket(entry.joins, now);
        const inactive = (now - (Number(entry.lastSeenAt) || 0)) > staleThreshold;
        if (inactive && entry.messages.length === 0 && entry.joins.length === 0) {
            rateLimitByIp.delete(ip);
        }
    }
}

function sanitizeRoomCode(raw) {
    return String(raw || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 6);
}

function sanitizePeerId(raw) {
    return String(raw || '')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 24);
}

function normalizeMaxPeers(rawValue) {
    return clampNumber(Number.parseInt(rawValue, 10), 2, MAX_PLAYERS);
}

function ensureRoom(code) {
    if (!rooms.has(code)) {
        rooms.set(code, {
            host: null,
            guests: new Map(),
            maxPeers: MAX_PLAYERS,
            nextGuestIndex: 1
        });
    }
    return rooms.get(code);
}

function isSocketOpen(ws) {
    return Boolean(ws && ws.readyState === WebSocket.OPEN);
}

function listRoomPeerIds(room) {
    const ids = [];
    if (isSocketOpen(room.host)) {
        ids.push('host');
    }
    for (const [peerId, socket] of room.guests.entries()) {
        if (isSocketOpen(socket)) {
            ids.push(peerId);
        }
    }
    return ids;
}

function getPeerCount(room) {
    return listRoomPeerIds(room).length;
}

function getRoomsStats() {
    let clients = 0;
    for (const room of rooms.values()) {
        clients += getPeerCount(room);
    }
    return { rooms: rooms.size, clients };
}

function send(ws, payload) {
    if (!isSocketOpen(ws)) return;
    ws.send(JSON.stringify(payload));
}

function sendJoined(ws, roomCode, room) {
    send(ws, {
        type: 'joined',
        room: roomCode,
        role: ws.role,
        peerId: ws.peerId,
        peerCount: getPeerCount(room),
        maxPeers: room.maxPeers,
        participants: listRoomPeerIds(room)
    });
}

function findGuestIdBySocket(room, targetSocket) {
    for (const [peerId, socket] of room.guests.entries()) {
        if (socket === targetSocket) {
            return peerId;
        }
    }
    return null;
}

function pruneClosedGuests(room) {
    for (const [peerId, socket] of room.guests.entries()) {
        if (!isSocketOpen(socket)) {
            room.guests.delete(peerId);
        }
    }
}

function assignGuestId(room, preferredId = '') {
    const preferred = sanitizePeerId(preferredId);
    if (preferred && preferred !== 'host' && !room.guests.has(preferred)) {
        return preferred;
    }

    let safety = 0;
    while (safety < 10000) {
        const candidate = `guest-${room.nextGuestIndex}`;
        room.nextGuestIndex += 1;
        if (!room.guests.has(candidate)) {
            return candidate;
        }
        safety += 1;
    }
    return `guest-${Date.now()}`;
}

function releaseSocket(ws) {
    const roomCode = ws.roomCode;
    const role = ws.role;
    const peerId = ws.peerId;
    if (!roomCode || !role || !peerId) return;

    const room = rooms.get(roomCode);
    if (!room) {
        ws.roomCode = null;
        ws.role = null;
        ws.peerId = null;
        return;
    }

    pruneClosedGuests(room);

    if (role === 'host' && room.host === ws) {
        room.host = null;
        for (const guestSocket of room.guests.values()) {
            send(guestSocket, {
                type: 'peer-left',
                room: roomCode,
                fromId: 'host',
                peerId: 'host',
                participants: listRoomPeerIds(room)
            });
        }
    } else if (role === 'guest') {
        const existing = room.guests.get(peerId);
        if (existing === ws) {
            room.guests.delete(peerId);
        } else {
            const resolvedId = findGuestIdBySocket(room, ws);
            if (resolvedId) {
                room.guests.delete(resolvedId);
            }
        }

        send(room.host, {
            type: 'peer-left',
            room: roomCode,
            fromId: peerId,
            peerId,
            participants: listRoomPeerIds(room)
        });
    }

    pruneClosedGuests(room);
    if (!isSocketOpen(room.host) && room.guests.size === 0) {
        rooms.delete(roomCode);
    }

    ws.roomCode = null;
    ws.role = null;
    ws.peerId = null;
}

function handleJoin(ws, message) {
    const roomCode = sanitizeRoomCode(message.room);
    const role = message.role === 'host' ? 'host' : (message.role === 'guest' ? 'guest' : null);

    if (!roomCode) {
        send(ws, { type: 'error', message: 'Code de session invalide.' });
        return;
    }
    if (!role) {
        send(ws, { type: 'error', message: 'Role invalide.' });
        return;
    }

    releaseSocket(ws);

    const room = ensureRoom(roomCode);
    pruneClosedGuests(room);

    if (role === 'host') {
        if (isSocketOpen(room.host) && room.host !== ws) {
            send(ws, { type: 'error', message: 'Le role host est deja occupe.' });
            return;
        }

        room.maxPeers = normalizeMaxPeers(message.maxPeers || room.maxPeers || MAX_PLAYERS);
        room.host = ws;
        ws.roomCode = roomCode;
        ws.role = 'host';
        ws.peerId = 'host';

        sendJoined(ws, roomCode, room);
        for (const guestSocket of room.guests.values()) {
            send(guestSocket, {
                type: 'peer-ready',
                room: roomCode,
                fromId: 'host',
                peerId: 'host',
                participants: listRoomPeerIds(room)
            });
        }
        return;
    }

    if (!isSocketOpen(room.host)) {
        send(ws, { type: 'error', message: 'Hote indisponible.' });
        if (room.guests.size === 0) {
            rooms.delete(roomCode);
        }
        return;
    }

    const peerCountBefore = getPeerCount(room);
    if (peerCountBefore >= room.maxPeers) {
        send(ws, { type: 'error', message: 'Session complete.' });
        return;
    }

    const assignedPeerId = assignGuestId(room, message.peerId);
    room.guests.set(assignedPeerId, ws);
    ws.roomCode = roomCode;
    ws.role = 'guest';
    ws.peerId = assignedPeerId;

    sendJoined(ws, roomCode, room);
    send(room.host, {
        type: 'peer-ready',
        room: roomCode,
        fromId: assignedPeerId,
        peerId: assignedPeerId,
        participants: listRoomPeerIds(room)
    });
    send(ws, {
        type: 'peer-ready',
        room: roomCode,
        fromId: 'host',
        peerId: 'host',
        participants: listRoomPeerIds(room)
    });
}

function resolveSignalTarget(room, sourceSocket, targetId) {
    if (!room) return null;
    const sourceRole = sourceSocket.role;

    if (sourceRole === 'host') {
        const normalizedTarget = sanitizePeerId(targetId);
        if (!normalizedTarget || normalizedTarget === 'host') return null;
        const guestSocket = room.guests.get(normalizedTarget);
        if (!isSocketOpen(guestSocket)) return null;
        return { socket: guestSocket, peerId: normalizedTarget };
    }

    if (sourceRole === 'guest') {
        if (!isSocketOpen(room.host)) return null;
        const normalizedTarget = sanitizePeerId(targetId || 'host');
        if (normalizedTarget && normalizedTarget !== 'host') return null;
        return { socket: room.host, peerId: 'host' };
    }

    return null;
}

function handleSignal(ws, message) {
    const roomCode = sanitizeRoomCode(message.room || ws.roomCode);
    if (!roomCode || !ws.roomCode || roomCode !== ws.roomCode) {
        send(ws, { type: 'error', message: 'Session inconnue pour ce signal.' });
        return;
    }

    const room = rooms.get(roomCode);
    if (!room) {
        send(ws, { type: 'error', message: 'Session introuvable.' });
        return;
    }

    pruneClosedGuests(room);

    const target = resolveSignalTarget(room, ws, message.targetId);
    if (!target) {
        send(ws, { type: 'error', message: 'Cible de signalisation indisponible.' });
        return;
    }

    send(target.socket, {
        type: 'signal',
        room: roomCode,
        fromId: ws.peerId,
        peerId: ws.peerId,
        toId: target.peerId,
        payload: message.payload || null
    });
}

function handleClientMessage(ws, rawMessage) {
    const clientIp = ws.clientIp || 'unknown';
    if (hitRateLimit(clientIp, 'messages', RATE_LIMIT_MAX_MESSAGES)) {
        send(ws, { type: 'error', message: 'Trop de messages. Reessayez plus tard.' });
        ws.close(1008, 'Rate limit exceeded');
        return;
    }

    let message;
    try {
        message = JSON.parse(rawMessage);
    } catch (_error) {
        send(ws, { type: 'error', message: 'Message JSON invalide.' });
        return;
    }

    if (!message || typeof message !== 'object') {
        send(ws, { type: 'error', message: 'Message invalide.' });
        return;
    }

    if (message.type === 'join') {
        if (hitRateLimit(clientIp, 'joins', RATE_LIMIT_MAX_JOINS)) {
            send(ws, { type: 'error', message: 'Trop de tentatives de connexion.' });
            ws.close(1008, 'Join rate limit exceeded');
            return;
        }
        handleJoin(ws, message);
        return;
    }
    if (message.type === 'signal') {
        handleSignal(ws, message);
        return;
    }
    send(ws, { type: 'error', message: 'Type de message non supporte.' });
}

const competitionApi = createCompetitionApi({
    isOriginAllowed,
    getRoomsStats,
    maxPlayers: MAX_PLAYERS,
    dbPath: DB_PATH,
    supabaseUrl: SUPABASE_URL,
    supabaseServiceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
    authRateLimitMax: RATE_LIMIT_MAX_AUTH,
    sessionTtlMs: SESSION_TTL_MS,
    rateWindowMs: RATE_LIMIT_WINDOW_MS
});

const server = http.createServer((req, res) => {
    competitionApi.handleHttp(req, res).then((handled) => {
        if (handled) {
            return;
        }
        if (req.url === '/health') {
            const stats = getRoomsStats();
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true, rooms: stats.rooms, clients: stats.clients, maxPlayers: MAX_PLAYERS }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('WebRTC signaling server is running.\n');
    }).catch((error) => {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: 'Erreur serveur.' }));
        console.error('API error', error?.message || error);
    });
});

const wss = new WebSocketServer({
    server,
    path: WS_PATH,
    maxPayload: MAX_WS_PAYLOAD_BYTES
});

wss.on('connection', (ws, req) => {
    const origin = req?.headers?.origin;
    if (!isOriginAllowed(origin)) {
        ws.close(1008, 'Origin non autorisee');
        return;
    }

    ws.isAlive = true;
    ws.roomCode = null;
    ws.role = null;
    ws.peerId = null;
    ws.clientIp = getClientIp(req);

    ws.on('pong', () => {
        ws.isAlive = true;
    });

    ws.on('message', (message) => {
        handleClientMessage(ws, message.toString());
    });

    ws.on('close', () => {
        releaseSocket(ws);
    });

    ws.on('error', () => {
        releaseSocket(ws);
    });
});

const heartbeatTimer = setInterval(() => {
    pruneRateLimitMap();
    competitionApi.onTick();
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            ws.terminate();
            return;
        }
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('close', () => {
    clearInterval(heartbeatTimer);
});

server.listen(PORT, HOST, () => {
    console.log(`Signaling WS server listening on ws://${HOST}:${PORT}${WS_PATH}`);
    console.log(`Competition API: /api/auth/*, /api/events* (db=${competitionApi.getDbPath()})`);
    console.log(`Security: maxPayload=${MAX_WS_PAYLOAD_BYTES}B, rate=${RATE_LIMIT_MAX_MESSAGES}/min, joinRate=${RATE_LIMIT_MAX_JOINS}/min, authRate=${RATE_LIMIT_MAX_AUTH}/min, origins=${ALLOWED_ORIGINS.join(', ')}, allowEmptyOrigin=${ALLOW_EMPTY_ORIGIN}`);
});
