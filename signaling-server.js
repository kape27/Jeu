const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number.parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';
const WS_PATH = process.env.WS_PATH || '/ws';
const MAX_PLAYERS = clampNumber(
    Number.parseInt(process.env.MAX_PLAYERS || process.env.MAX_ROOM_SIZE || '4', 10),
    2,
    4
);

const rooms = new Map();

function clampNumber(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, Math.trunc(value)));
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
        handleJoin(ws, message);
        return;
    }
    if (message.type === 'signal') {
        handleSignal(ws, message);
        return;
    }
    send(ws, { type: 'error', message: 'Type de message non supporte.' });
}

const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        let clients = 0;
        for (const room of rooms.values()) {
            clients += getPeerCount(room);
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, rooms: rooms.size, clients, maxPlayers: MAX_PLAYERS }));
        return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('WebRTC signaling server is running.\n');
});

const wss = new WebSocketServer({
    server,
    path: WS_PATH
});

wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.roomCode = null;
    ws.role = null;
    ws.peerId = null;

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
});
