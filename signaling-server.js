const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number.parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';
const WS_PATH = process.env.WS_PATH || '/ws';
const MAX_ROOM_SIZE = 2;

const rooms = new Map();

function sanitizeRoomCode(raw) {
    return String(raw || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 6);
}

function ensureRoom(code) {
    if (!rooms.has(code)) {
        rooms.set(code, {
            host: null,
            guest: null
        });
    }
    return rooms.get(code);
}

function getPeerCount(room) {
    let count = 0;
    if (room.host && room.host.readyState === WebSocket.OPEN) {
        count += 1;
    }
    if (room.guest && room.guest.readyState === WebSocket.OPEN) {
        count += 1;
    }
    return count;
}

function send(ws, payload) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(payload));
}

function getCounterpart(room, role) {
    if (!room) return null;
    return role === 'host' ? room.guest : room.host;
}

function releaseSocket(ws) {
    const roomCode = ws.roomCode;
    const role = ws.role;
    if (!roomCode || !role) return;

    const room = rooms.get(roomCode);
    if (!room) return;

    if (role === 'host' && room.host === ws) {
        room.host = null;
    } else if (role === 'guest' && room.guest === ws) {
        room.guest = null;
    }

    const counterpart = getCounterpart(room, role);
    if (counterpart) {
        send(counterpart, {
            type: 'peer-left',
            room: roomCode
        });
    }

    if (!room.host && !room.guest) {
        rooms.delete(roomCode);
    }

    ws.roomCode = null;
    ws.role = null;
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
    const slot = room[role];

    if (slot && slot !== ws && slot.readyState === WebSocket.OPEN) {
        send(ws, { type: 'error', message: `Le role ${role} est deja occupe.` });
        return;
    }

    const peerCountBefore = getPeerCount(room);
    if (peerCountBefore >= MAX_ROOM_SIZE && slot !== ws) {
        send(ws, { type: 'error', message: 'Session complete.' });
        return;
    }

    room[role] = ws;
    ws.roomCode = roomCode;
    ws.role = role;

    const peerCount = getPeerCount(room);
    send(ws, {
        type: 'joined',
        room: roomCode,
        role,
        peerCount
    });

    if (room.host && room.guest) {
        send(room.host, { type: 'peer-ready', room: roomCode });
        send(room.guest, { type: 'peer-ready', room: roomCode });
    }
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

    const counterpart = getCounterpart(room, ws.role);
    if (!counterpart || counterpart.readyState !== WebSocket.OPEN) {
        send(ws, { type: 'error', message: 'Adversaire non connecte.' });
        return;
    }

    send(counterpart, {
        type: 'signal',
        room: roomCode,
        fromRole: ws.role,
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
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
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
