/**
 * Competition API — PostgreSQL adapter (Railway / Neon / Supabase Postgres)
 * Drop-in replacement for the SQLite version.
 * Activated when DATABASE_URL environment variable is set.
 */
const crypto = require('crypto');
const { Pool } = require('pg');

const EVENT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROLE_SET = new Set(['player', 'organizer', 'admin']);

function clampNumber(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, Math.trunc(value)));
}

function nowMs() { return Date.now(); }

function createHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function createCompetitionApiPg(options) {
    const isOriginAllowed = options.isOriginAllowed;
    const getRoomsStats = options.getRoomsStats;
    const maxPlayers = clampNumber(Number(options.maxPlayers) || 4, 2, 16);

    const databaseUrl = String(options.databaseUrl || process.env.DATABASE_URL || '').trim();
    const authRateLimitMax = clampNumber(Number(options.authRateLimitMax) || 25, 5, 300);
    const sessionTtlMs = clampNumber(
        Number(options.sessionTtlMs) || (7 * 24 * 60 * 60 * 1000),
        60 * 60 * 1000,
        90 * 24 * 60 * 60 * 1000
    );
    const rateWindowMs = clampNumber(Number(options.rateWindowMs) || 60000, 1000, 10 * 60 * 1000);

    const authRateByIp = new Map();

    // PostgreSQL connection pool
    const pool = new Pool({
        connectionString: databaseUrl,
        ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000
    });

    // Initialize schema
    let schemaReady = false;
    const schemaPromise = initSchema();

    async function initSchema() {
        const client = await pool.connect();
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    email TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    password_salt TEXT NOT NULL,
                    pseudo TEXT NOT NULL UNIQUE,
                    role TEXT NOT NULL DEFAULT 'player',
                    avatar_url TEXT NOT NULL DEFAULT '',
                    country_code TEXT NOT NULL DEFAULT '',
                    level INTEGER NOT NULL DEFAULT 1,
                    elo INTEGER NOT NULL DEFAULT 1200,
                    games_played INTEGER NOT NULL DEFAULT 0,
                    wins_total INTEGER NOT NULL DEFAULT 0,
                    losses_total INTEGER NOT NULL DEFAULT 0,
                    auth_provider TEXT NOT NULL DEFAULT 'password',
                    auth_provider_user_id TEXT,
                    created_at BIGINT NOT NULL,
                    updated_at BIGINT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS sessions (
                    token_hash TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    created_at BIGINT NOT NULL,
                    expires_at BIGINT NOT NULL,
                    last_seen_at BIGINT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS events (
                    id SERIAL PRIMARY KEY,
                    code TEXT NOT NULL UNIQUE,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    mode TEXT NOT NULL DEFAULT 'classic',
                    status TEXT NOT NULL DEFAULT 'lobby',
                    max_players INTEGER NOT NULL,
                    created_by INTEGER NOT NULL REFERENCES users(id),
                    winner_user_id INTEGER REFERENCES users(id),
                    starts_at BIGINT,
                    created_at BIGINT NOT NULL,
                    updated_at BIGINT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS event_players (
                    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    display_name TEXT NOT NULL,
                    is_host INTEGER NOT NULL DEFAULT 0,
                    joined_at BIGINT NOT NULL,
                    wins INTEGER NOT NULL DEFAULT 0,
                    losses INTEGER NOT NULL DEFAULT 0,
                    points INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (event_id, user_id)
                );

                CREATE TABLE IF NOT EXISTS matches (
                    id SERIAL PRIMARY KEY,
                    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                    round_number INTEGER NOT NULL,
                    slot_index INTEGER NOT NULL,
                    player_a_user_id INTEGER REFERENCES users(id),
                    player_b_user_id INTEGER REFERENCES users(id),
                    winner_user_id INTEGER REFERENCES users(id),
                    status TEXT NOT NULL DEFAULT 'pending',
                    score_a INTEGER NOT NULL DEFAULT 0,
                    score_b INTEGER NOT NULL DEFAULT 0,
                    created_at BIGINT NOT NULL,
                    updated_at BIGINT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS messages (
                    id SERIAL PRIMARY KEY,
                    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    content TEXT NOT NULL,
                    tone TEXT NOT NULL DEFAULT 'info',
                    created_at BIGINT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS achievements (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    icon TEXT NOT NULL,
                    description TEXT NOT NULL,
                    criteria_type TEXT NOT NULL,
                    criteria_value INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS user_achievements (
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
                    earned_at BIGINT NOT NULL,
                    PRIMARY KEY (user_id, achievement_id)
                );

                -- Default Achievements
                INSERT INTO achievements (name, icon, description, criteria_type, criteria_value)
                VALUES 
                    ('Première Victoire', '🏆', 'Gagnez votre premier match en compétition', 'wins', 1),
                    ('Vétéran', '🎖️', 'Jouez 10 parties en compétition', 'games', 10),
                    ('Maître', '⭐', 'Atteignez 1500 ELO', 'elo', 1500),
                    ('Légende', '💎', 'Atteignez 2000 ELO', 'elo', 2000)
                ON CONFLICT (name) DO NOTHING;

                CREATE TABLE IF NOT EXISTS matchmaking_queue (
                    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                    mode TEXT NOT NULL,
                    joined_at BIGINT NOT NULL,
                    elo INTEGER NOT NULL
                );

                -- Singleton Ranked Event
                INSERT INTO events (id, code, name, description, mode, status, max_players, created_by, created_at, updated_at)
                VALUES (1, 'RANKED', 'Matchmaking Classé', 'Système de matchmaking automatique par ELO.', 'classic', 'started', 99999, 1, 0, 0)
                ON CONFLICT (id) DO NOTHING;

                CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
                CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
                CREATE INDEX IF NOT EXISTS idx_event_players_event_id ON event_players(event_id);
                CREATE INDEX IF NOT EXISTS idx_matches_event_round ON matches(event_id, round_number, slot_index);
                CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider, auth_provider_user_id);
                CREATE INDEX IF NOT EXISTS idx_messages_event_id ON messages(event_id, created_at);
                CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
                CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_mode ON matchmaking_queue(mode, elo);
            `);
            schemaReady = true;
            console.log('[PG] Database schema initialized successfully.');
        } finally {
            client.release();
        }
    }

    // --- DB Helpers ---
    async function dbGet(sql, params = []) {
        const result = await pool.query(sql, params);
        return result.rows[0] || null;
    }

    async function dbAll(sql, params = []) {
        const result = await pool.query(sql, params);
        return result.rows;
    }

    async function dbRun(sql, params = []) {
        const result = await pool.query(sql, params);
        return result;
    }

    async function dbWithTransaction(callback) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // --- Sanitization ---
    function sanitizeEmail(raw) { return String(raw || '').trim().toLowerCase(); }
    function sanitizePseudo(raw) { return String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 24); }
    function sanitizeCountryCode(raw) { return String(raw || '').trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2); }
    function sanitizeAvatarUrl(raw) {
        const value = String(raw || '').trim().slice(0, 512);
        if (!value) return '';
        try { const p = new URL(value); if (p.protocol === 'http:' || p.protocol === 'https:') return p.toString(); } catch (_) {}
        return '';
    }
    function sanitizeRole(raw) { const role = String(raw || '').trim().toLowerCase(); return ROLE_SET.has(role) ? role : 'player'; }
    function sanitizeEventName(raw) { return String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 64); }
    function sanitizeEventDescription(raw) { return String(raw || '').trim().slice(0, 280); }
    function sanitizeEventMode(raw) { const v = String(raw || '').trim().toLowerCase(); if (!v) return 'classic'; return /^[a-z0-9_-]{2,24}$/.test(v) ? v : 'classic'; }
    function normalizeCompetitionMaxPlayers(rawValue) { return clampNumber(Number.parseInt(rawValue, 10), 2, 64); }
    function isEmailValid(email) { if (!email || email.length > 120) return false; return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
    function isPasswordValid(password) { return typeof password === 'string' && password.length >= 8 && password.length <= 128; }
    function levelFromElo(elo) { return Math.max(1, Math.floor((Number.isFinite(elo) ? elo : 1200) - 800) / 120 + 1); }
    function winRatePercent(wins, gamesPlayed) { const g = Math.max(0, Number(gamesPlayed || 0)); if (g === 0) return 0; return Math.round((Math.max(0, Number(wins || 0)) / g) * 10000) / 100; }

    function computeEloDelta(winnerEloRaw, loserEloRaw, kFactor = 24) {
        const winnerElo = Number.isFinite(winnerEloRaw) ? winnerEloRaw : 1200;
        const loserElo = Number.isFinite(loserEloRaw) ? loserEloRaw : 1200;
        const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
        const expectedLoser = 1 - expectedWinner;
        return { winnerDelta: Math.round(kFactor * (1 - expectedWinner)), loserDelta: Math.round(kFactor * (0 - expectedLoser)) };
    }

    // --- Crypto ---
    function hashToken(rawToken) { return crypto.createHash('sha256').update(String(rawToken || '')).digest('hex'); }
    function hashPassword(password, saltHex) { const salt = Buffer.from(saltHex, 'hex'); return crypto.scryptSync(String(password || ''), salt, 64).toString('hex'); }
    function createPasswordHash(password) { const saltHex = crypto.randomBytes(16).toString('hex'); return { saltHex, hashHex: hashPassword(password, saltHex) }; }
    function secureCompareHex(leftHex, rightHex) {
        try {
            const left = Buffer.from(String(leftHex || ''), 'hex');
            const right = Buffer.from(String(rightHex || ''), 'hex');
            if (left.length === 0 || right.length === 0 || left.length !== right.length) return false;
            return crypto.timingSafeEqual(left, right);
        } catch (_) { return false; }
    }

    // --- Session ---
    async function issueSessionToken(userId) {
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(token);
        const now = nowMs();
        await dbRun(
            'INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen_at) VALUES ($1, $2, $3, $4, $5)',
            [tokenHash, userId, now, now + sessionTtlMs, now]
        );
        return token;
    }

    async function purgeExpiredSessions() {
        await dbRun('DELETE FROM sessions WHERE expires_at <= $1', [nowMs()]);
    }

    function getBearerToken(req) {
        const raw = String(req?.headers?.authorization || '').trim();
        if (!raw) return '';
        const match = raw.match(/^Bearer\s+(.+)$/i);
        return match ? match[1].trim() : '';
    }

    async function requireUser(req) {
        const token = getBearerToken(req);
        if (!token) return null;

        const tokenHash = hashToken(token);
        const now = nowMs();
        const row = await dbGet(
            `SELECT s.token_hash, s.user_id, s.expires_at, u.id, u.email, u.pseudo, u.role, u.avatar_url, u.country_code,
                    u.level, u.elo, u.games_played, u.wins_total, u.losses_total, u.auth_provider, u.created_at
             FROM sessions s JOIN users u ON u.id = s.user_id
             WHERE s.token_hash = $1 LIMIT 1`, [tokenHash]
        );
        if (!row) return null;
        if (Number(row.expires_at) <= now) {
            await dbRun('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
            return null;
        }

        await dbRun('UPDATE sessions SET last_seen_at = $1 WHERE token_hash = $2', [now, tokenHash]);
        return {
            id: Number(row.id), email: row.email, pseudo: row.pseudo,
            role: sanitizeRole(row.role), avatarUrl: String(row.avatar_url || ''),
            country: String(row.country_code || ''), level: Number(row.level || 1),
            elo: Number(row.elo || 1200), gamesPlayed: Number(row.games_played || 0),
            wins: Number(row.wins_total || 0), losses: Number(row.losses_total || 0),
            winRate: winRatePercent(Number(row.wins_total || 0), Number(row.games_played || 0)),
            authProvider: String(row.auth_provider || 'password'), createdAt: Number(row.created_at)
        };
    }

    function toSafeUser(userRow) {
        const gamesPlayed = Number(userRow.games_played || 0);
        const winsTotal = Number(userRow.wins_total || 0);
        const lossesTotal = Number(userRow.losses_total || 0);
        const elo = Number(userRow.elo || 1200);
        return {
            id: Number(userRow.id), email: String(userRow.email || ''), pseudo: String(userRow.pseudo || ''),
            role: sanitizeRole(userRow.role), avatarUrl: String(userRow.avatar_url || ''),
            country: String(userRow.country_code || ''), level: Number(userRow.level || levelFromElo(elo)),
            elo, gamesPlayed, wins: winsTotal, losses: lossesTotal,
            winRate: winRatePercent(winsTotal, gamesPlayed),
            authProvider: String(userRow.auth_provider || 'password'),
            createdAt: Number(userRow.created_at || nowMs())
        };
    }

    async function getUserById(userId) {
        return dbGet(
            `SELECT id, email, pseudo, role, avatar_url, country_code, level, elo, games_played, wins_total, losses_total, auth_provider, created_at
             FROM users WHERE id = $1 LIMIT 1`, [userId]
        );
    }

    async function getUserMatchHistory(userId, limitRaw = 20) {
        const limit = clampNumber(Number.parseInt(limitRaw, 10), 1, 100);
        const rows = await dbAll(
            `SELECT m.id, m.event_id, m.round_number, m.slot_index, m.player_a_user_id, m.player_b_user_id, m.winner_user_id,
                    m.score_a, m.score_b, m.updated_at, e.name AS event_name, e.code AS event_code
             FROM matches m JOIN events e ON e.id = m.event_id
             WHERE m.status = 'completed' AND (m.player_a_user_id = $1 OR m.player_b_user_id = $1)
             ORDER BY m.updated_at DESC LIMIT $2`, [userId, limit]
        );

        const results = [];
        for (const row of rows) {
            const playerA = row.player_a_user_id == null ? null : Number(row.player_a_user_id);
            const playerB = row.player_b_user_id == null ? null : Number(row.player_b_user_id);
            const winner = row.winner_user_id == null ? null : Number(row.winner_user_id);
            const opponentId = playerA === Number(userId) ? playerB : playerA;
            let opponentPseudo = 'BYE';
            if (opponentId != null) {
                const opp = await dbGet('SELECT pseudo FROM users WHERE id = $1 LIMIT 1', [opponentId]);
                opponentPseudo = opp?.pseudo || `Joueur #${opponentId}`;
            }
            results.push({
                matchId: Number(row.id), eventId: Number(row.event_id),
                eventCode: String(row.event_code || ''), eventName: String(row.event_name || 'Evenement'),
                round: Number(row.round_number || 0), slot: Number(row.slot_index || 0),
                playedAt: Number(row.updated_at || 0), opponentUserId: opponentId,
                opponentPseudo, result: winner === Number(userId) ? 'win' : 'loss',
                scoreA: Number(row.score_a || 0), scoreB: Number(row.score_b || 0), winnerUserId: winner
            });
        }
        return results;
    }

    // --- Rate Limiting ---
    function getClientIp(req) {
        const forwardedRaw = req?.headers?.['x-forwarded-for'];
        if (typeof forwardedRaw === 'string' && forwardedRaw.trim()) return forwardedRaw.split(',')[0].trim();
        return String(req?.socket?.remoteAddress || '').trim() || 'unknown';
    }

    function hitAuthRateLimit(ip) {
        const now = nowMs();
        const key = String(ip || 'unknown');
        let bucket = authRateByIp.get(key);
        if (!bucket) { bucket = []; authRateByIp.set(key, bucket); }
        while (bucket.length > 0 && (now - bucket[0]) > rateWindowMs) bucket.shift();
        bucket.push(now);
        return bucket.length > authRateLimitMax;
    }

    function pruneAuthRate() {
        const now = nowMs();
        for (const [ip, bucket] of authRateByIp.entries()) {
            while (bucket.length > 0 && (now - bucket[0]) > rateWindowMs) bucket.shift();
            if (bucket.length === 0) authRateByIp.delete(ip);
        }
    }

    // --- CORS ---
    function buildCorsHeaders(originHeader) {
        const rawOrigin = String(originHeader || '').trim();
        if (!rawOrigin) return {};
        if (!isOriginAllowed(rawOrigin)) return null;
        return {
            'Access-Control-Allow-Origin': rawOrigin,
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Max-Age': '86400',
            Vary: 'Origin'
        };
    }

    function sendJson(res, statusCode, payload, extraHeaders = {}) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders });
        res.end(JSON.stringify(payload));
    }

    function apiError(res, statusCode, message, corsHeaders) { sendJson(res, statusCode, { ok: false, error: message }, corsHeaders); }

    function readJsonBody(req, limitBytes = 64 * 1024) {
        return new Promise((resolve, reject) => {
            let size = 0; const chunks = [];
            req.on('data', (chunk) => { size += chunk.length; if (size > limitBytes) { reject(createHttpError(413, 'Corps de requete trop volumineux.')); req.destroy(); return; } chunks.push(chunk); });
            req.on('end', () => { if (chunks.length === 0) { resolve({}); return; } const text = Buffer.concat(chunks).toString('utf8'); try { const parsed = JSON.parse(text); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) { reject(createHttpError(400, 'JSON invalide.')); return; } resolve(parsed); } catch (_) { reject(createHttpError(400, 'JSON invalide.')); } });
            req.on('error', () => { reject(createHttpError(400, 'Lecture de requete impossible.')); });
        });
    }

    function isUniqueViolation(error) {
        const code = String(error?.code || '');
        const text = String(error?.message || '').toLowerCase();
        return code === '23505' || text.includes('unique') || text.includes('duplicate');
    }

    // --- Event helpers ---
    async function generateEventCode() {
        for (let attempt = 0; attempt < 40; attempt++) {
            let code = '';
            for (let i = 0; i < 6; i++) code += EVENT_CODE_ALPHABET[crypto.randomInt(0, EVENT_CODE_ALPHABET.length)];
            const existing = await dbGet('SELECT id FROM events WHERE code = $1 LIMIT 1', [code]);
            if (!existing) return code;
        }
        throw createHttpError(500, 'Generation de code evenement impossible.');
    }

    async function getEventByCode(code) {
        return dbGet(
            `SELECT e.id, e.code, e.name, e.description, e.mode, e.status, e.max_players, e.created_by, e.winner_user_id,
                    e.starts_at, e.created_at, e.updated_at, owner.pseudo AS owner_pseudo, winner.pseudo AS winner_pseudo
             FROM events e JOIN users owner ON owner.id = e.created_by LEFT JOIN users winner ON winner.id = e.winner_user_id
             WHERE e.code = $1 LIMIT 1`, [String(code || '').toUpperCase()]
        );
    }

    async function getEventPlayers(eventId) {
        const rows = await dbAll(
            `SELECT ep.user_id, ep.display_name, ep.is_host, ep.joined_at, ep.wins, ep.losses, ep.points, u.pseudo
             FROM event_players ep JOIN users u ON u.id = ep.user_id
             WHERE ep.event_id = $1 ORDER BY ep.is_host DESC, ep.joined_at ASC`, [eventId]
        );
        return rows.map(row => ({
            userId: Number(row.user_id), pseudo: String(row.pseudo || ''),
            displayName: String(row.display_name || row.pseudo || ''),
            isHost: Number(row.is_host) === 1, joinedAt: Number(row.joined_at),
            wins: Number(row.wins), losses: Number(row.losses), points: Number(row.points)
        }));
    }

    async function getEventMatches(eventId) {
        const rows = await dbAll(
            `SELECT m.id, m.round_number, m.slot_index, m.player_a_user_id, m.player_b_user_id, m.winner_user_id, m.status, m.score_a, m.score_b,
                    ua.pseudo AS player_a_pseudo, ub.pseudo AS player_b_pseudo
             FROM matches m
             LEFT JOIN users ua ON ua.id = m.player_a_user_id
             LEFT JOIN users ub ON ub.id = m.player_b_user_id
             WHERE m.event_id = $1 ORDER BY m.round_number ASC, m.slot_index ASC`, [eventId]
        );
        return rows.map(row => ({
            id: Number(row.id), round: Number(row.round_number), slot: Number(row.slot_index),
            playerAUserId: row.player_a_user_id == null ? null : Number(row.player_a_user_id),
            playerBUserId: row.player_b_user_id == null ? null : Number(row.player_b_user_id),
            playerAPseudo: String(row.player_a_pseudo || 'BYE'),
            playerBPseudo: String(row.player_b_pseudo || 'BYE'),
            winnerUserId: row.winner_user_id == null ? null : Number(row.winner_user_id),
            status: String(row.status), scoreA: Number(row.score_a), scoreB: Number(row.score_b)
        }));
    }

    async function toEventPayload(eventRow, options = {}) {
        const includeMatches = options.includeMatches !== false;
        const players = await getEventPlayers(eventRow.id);
        const payload = {
            id: Number(eventRow.id), code: String(eventRow.code || ''), name: String(eventRow.name || ''),
            description: String(eventRow.description || ''), mode: String(eventRow.mode || 'classic'),
            status: String(eventRow.status || 'lobby'), maxPlayers: Number(eventRow.max_players),
            startsAt: eventRow.starts_at == null ? null : Number(eventRow.starts_at),
            createdAt: Number(eventRow.created_at), updatedAt: Number(eventRow.updated_at),
            createdBy: Number(eventRow.created_by), ownerPseudo: String(eventRow.owner_pseudo || ''),
            winnerUserId: eventRow.winner_user_id == null ? null : Number(eventRow.winner_user_id),
            winnerPseudo: eventRow.winner_pseudo == null ? null : String(eventRow.winner_pseudo),
            playerCount: players.length, players
        };
        if (includeMatches) payload.matches = await getEventMatches(eventRow.id);
        return payload;
    }

    async function requireEventByCodeOrThrow(code) {
        const event = await getEventByCode(code);
        if (!event) throw createHttpError(404, 'Evenement introuvable.');
        return event;
    }

    async function userIsEventHost(eventId, userId) {
        const row = await dbGet('SELECT is_host FROM event_players WHERE event_id = $1 AND user_id = $2 LIMIT 1', [eventId, userId]);
        return Boolean(row && Number(row.is_host) === 1);
    }

    async function upsertEventPlayer(eventId, user, isHost = false) {
        const now = nowMs();
        await dbRun(
            `INSERT INTO event_players (event_id, user_id, display_name, is_host, joined_at)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT(event_id, user_id) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                is_host = CASE WHEN EXCLUDED.is_host = 1 THEN 1 ELSE event_players.is_host END`,
            [eventId, user.id, user.pseudo, isHost ? 1 : 0, now]
        );
    }

    async function hasAvailableSeats(eventRow) {
        const row = await dbGet('SELECT COUNT(1) AS player_count FROM event_players WHERE event_id = $1', [eventRow.id]);
        return Number(row?.player_count || 0) < Number(eventRow.max_players || 0);
    }

    async function addPlayerStats(eventId, userId, delta) {
        if (!userId) return;
        await dbRun(
            `UPDATE event_players SET wins = wins + $1, losses = losses + $2, points = points + $3
             WHERE event_id = $4 AND user_id = $5`,
            [Number(delta.wins || 0), Number(delta.losses || 0), Number(delta.points || 0), eventId, userId]
        );
    }

    async function applyGlobalMatchResult(winnerUserId, loserUserId) {
        if (!winnerUserId || !loserUserId) return;
        const winner = await getUserById(winnerUserId);
        const loser = await getUserById(loserUserId);
        if (!winner || !loser) return;

        const { winnerDelta, loserDelta } = computeEloDelta(Number(winner.elo || 1200), Number(loser.elo || 1200));
        const now = nowMs();

        await dbRun(
            `UPDATE users SET elo = $1, level = $2, games_played = games_played + 1, wins_total = wins_total + 1, updated_at = $3 WHERE id = $4`,
            [Math.max(100, Number(winner.elo || 1200) + winnerDelta), levelFromElo(Math.max(100, Number(winner.elo || 1200) + winnerDelta)), now, winnerUserId]
        );
        await dbRun(
            `UPDATE users SET elo = $1, level = $2, games_played = games_played + 1, losses_total = losses_total + 1, updated_at = $3 WHERE id = $4`,
            [Math.max(100, Number(loser.elo || 1200) + loserDelta), levelFromElo(Math.max(100, Number(loser.elo || 1200) + loserDelta)), now, loserUserId]
        );
    }

    function shuffleArray(values) {
        const output = [...values];
        for (let i = output.length - 1; i > 0; i--) { const j = crypto.randomInt(0, i + 1); [output[i], output[j]] = [output[j], output[i]]; }
        return output;
    }

    async function createRoundMatches(eventId, roundNumber, playerIds) {
        let participants = [...playerIds];
        if (participants.length % 2 !== 0) participants.push(null);
        const now = nowMs();
        let slotIndex = 1;
        for (let i = 0; i < participants.length; i += 2) {
            const playerA = participants[i];
            const playerB = participants[i + 1];
            if (playerA != null && playerB != null) {
                await dbRun(
                    `INSERT INTO matches (event_id, round_number, slot_index, player_a_user_id, player_b_user_id, winner_user_id, status, score_a, score_b, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, NULL, 'pending', 0, 0, $6, $7)`,
                    [eventId, roundNumber, slotIndex, playerA, playerB, now, now]
                );
            } else {
                const winnerUserId = playerA == null ? playerB : playerA;
                await dbRun(
                    `INSERT INTO matches (event_id, round_number, slot_index, player_a_user_id, player_b_user_id, winner_user_id, status, score_a, score_b, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, 'completed', 0, 0, $7, $8)`,
                    [eventId, roundNumber, slotIndex, playerA, playerB, winnerUserId, now, now]
                );
                if (winnerUserId != null) await addPlayerStats(eventId, winnerUserId, { wins: 1, points: 1 });
            }
            slotIndex++;
        }
    }

    async function ensureCompetitionProgress(eventId) {
        while (true) {
            const eventRow = await dbGet('SELECT id, status FROM events WHERE id = $1 LIMIT 1', [eventId]);
            if (!eventRow || String(eventRow.status) !== 'started') return;
            const roundRow = await dbGet('SELECT MAX(round_number) AS max_round FROM matches WHERE event_id = $1', [eventId]);
            const maxRound = Number(roundRow?.max_round || 0);
            if (maxRound < 1) return;
            const pendingRow = await dbGet('SELECT COUNT(1) AS pending_count FROM matches WHERE event_id = $1 AND round_number = $2 AND status = $3', [eventId, maxRound, 'pending']);
            if (Number(pendingRow?.pending_count || 0) > 0) return;
            const winnerRows = await dbAll('SELECT winner_user_id FROM matches WHERE event_id = $1 AND round_number = $2 ORDER BY slot_index ASC', [eventId, maxRound]);
            const winners = winnerRows.map(r => r.winner_user_id == null ? null : Number(r.winner_user_id)).filter(v => v != null);
            if (winners.length <= 1) {
                await dbRun('UPDATE events SET status = $1, winner_user_id = $2, updated_at = $3 WHERE id = $4', ['finished', winners.length === 1 ? winners[0] : null, nowMs(), eventId]);
                return;
            }
            await createRoundMatches(eventId, maxRound + 1, winners);
        }
    }

    // --- Route Handlers ---
    async function handleAuthRegister(req, res, corsHeaders, userIp) {
        if (hitAuthRateLimit(userIp)) { apiError(res, 429, 'Trop de tentatives. Reessayez plus tard.', corsHeaders); return; }
        const body = await readJsonBody(req);
        const email = sanitizeEmail(body.email);
        const password = String(body.password || '');
        const pseudo = sanitizePseudo(body.pseudo);
        if (!isEmailValid(email)) throw createHttpError(400, 'Email invalide.');
        if (!isPasswordValid(password)) throw createHttpError(400, 'Mot de passe trop court (minimum 8 caracteres).');
        if (!pseudo || pseudo.length < 2) throw createHttpError(400, 'Pseudo invalide.');
        const now = nowMs();
        const { saltHex, hashHex } = createPasswordHash(password);
        let createdUser;
        try {
            const result = await dbGet(
                `INSERT INTO users (email, password_hash, password_salt, pseudo, role, avatar_url, country_code, level, elo, games_played, wins_total, losses_total, auth_provider, auth_provider_user_id, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, 'player', $5, $6, 1, 1200, 0, 0, 0, 'password', NULL, $7, $8) RETURNING *`,
                [email, hashHex, saltHex, pseudo, sanitizeAvatarUrl(body.avatarUrl), sanitizeCountryCode(body.country), now, now]
            );
            createdUser = result;
        } catch (error) {
            console.error('[AUTH_REG_ERROR]', error);
            if (isUniqueViolation(error)) throw createHttpError(409, 'Email ou pseudo deja utilise.');
            throw error;
        }
        const token = await issueSessionToken(createdUser.id);
        sendJson(res, 201, { ok: true, token, user: toSafeUser(createdUser) }, corsHeaders);
    }

    async function handleAuthLogin(req, res, corsHeaders, userIp) {
        if (hitAuthRateLimit(userIp)) { apiError(res, 429, 'Trop de tentatives. Reessayez plus tard.', corsHeaders); return; }
        const body = await readJsonBody(req);
        const email = sanitizeEmail(body.email);
        const password = String(body.password || '');
        if (!isEmailValid(email) || !password) throw createHttpError(400, 'Identifiants invalides.');
        const row = await dbGet(
            `SELECT id, email, pseudo, role, avatar_url, country_code, level, elo, games_played, wins_total, losses_total, auth_provider, created_at, password_hash, password_salt
             FROM users WHERE email = $1 LIMIT 1`, [email]
        );
        if (!row) throw createHttpError(401, 'Email ou mot de passe invalide.');
        const candidateHash = hashPassword(password, row.password_salt);
        if (!secureCompareHex(candidateHash, row.password_hash)) throw createHttpError(401, 'Email ou mot de passe invalide.');
        const token = await issueSessionToken(row.id);
        sendJson(res, 200, { ok: true, token, user: toSafeUser(row) }, corsHeaders);
    }

    async function handleAuthMe(req, res, corsHeaders) {
        const user = await requireUser(req);
        if (!user) throw createHttpError(401, 'Session invalide.');
        sendJson(res, 200, { ok: true, user }, corsHeaders);
    }

    async function handleAuthLogout(req, res, corsHeaders) {
        const token = getBearerToken(req);
        if (!token) throw createHttpError(401, 'Session invalide.');
        await dbRun('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
        sendJson(res, 200, { ok: true }, corsHeaders);
    }

    async function handleLeaderboard(res, corsHeaders, parsedUrl) {
        const limit = clampNumber(Number.parseInt(parsedUrl.searchParams.get('limit') || '20', 10), 1, 100);
        const top = await dbAll(`
            SELECT pseudo, avatar_url as avatarUrl, elo, wins_total as wins, games_played as gamesCount, level
            FROM users 
            ORDER BY elo DESC, wins_total DESC 
            LIMIT $1
        `, [limit]);
        sendJson(res, 200, { ok: true, leaderboard: top }, corsHeaders);
    }

    async function checkAchievements(userId) {
        const user = await dbGet('SELECT elo, wins_total, games_played FROM users WHERE id = $1', [userId]);
        if (!user) return;
        const potential = await dbAll('SELECT id, criteria_type, criteria_value FROM achievements');
        const earned = await dbAll('SELECT achievement_id FROM user_achievements WHERE user_id = $1', [userId]);
        const earnedSet = new Set(earned.map(e => e.achievement_id));

        for (const a of potential) {
            if (earnedSet.has(a.id)) continue;
            let condition = false;
            if (a.criteria_type === 'wins' && user.wins_total >= a.criteria_value) condition = true;
            if (a.criteria_type === 'games' && user.games_played >= a.criteria_value) condition = true;
            if (a.criteria_type === 'elo' && user.elo >= a.criteria_value) condition = true;
            
            if (condition) {
                await dbRun('INSERT INTO user_achievements (user_id, achievement_id, earned_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [userId, a.id, nowMs()]);
            }
        }
    }

    async function handleProfileMe(req, res, corsHeaders, parsedUrl) {
        const user = await requireUser(req);
        if (!user) throw createHttpError(401, 'Session invalide.');
        await checkAchievements(user.id);
        const achievements = await dbAll(`
            SELECT a.name, a.icon, a.description, ua.earned_at as ts
            FROM achievements a
            JOIN user_achievements ua ON a.id = ua.achievement_id
            WHERE ua.user_id = $1
            ORDER BY ua.earned_at DESC
        `, [user.id]);
        const history = await getUserMatchHistory(user.id, parsedUrl.searchParams.get('historyLimit') || '20');
        sendJson(res, 200, { 
            ok: true, 
            user, 
            history, 
            achievements,
            stats: { gamesPlayed: user.gamesPlayed, wins: user.wins, losses: user.losses, winRate: user.winRate, elo: user.elo, level: user.level } 
        }, corsHeaders);
    }

    async function handleProfileUpdate(req, res, corsHeaders) {
        const user = await requireUser(req);
        if (!user) throw createHttpError(401, 'Session invalide.');
        const body = await readJsonBody(req);
        const sets = []; const params = []; let paramIndex = 1;
        if (typeof body.pseudo === 'string') { const p = sanitizePseudo(body.pseudo); if (p.length < 2) throw createHttpError(400, 'Pseudo invalide.'); sets.push(`pseudo = $${paramIndex++}`); params.push(p); }
        if (typeof body.avatarUrl === 'string' || typeof body.avatar_url === 'string') { sets.push(`avatar_url = $${paramIndex++}`); params.push(sanitizeAvatarUrl(body.avatarUrl || body.avatar_url)); }
        if (typeof body.country === 'string' || typeof body.countryCode === 'string' || typeof body.country_code === 'string') { sets.push(`country_code = $${paramIndex++}`); params.push(sanitizeCountryCode(body.country || body.countryCode || body.country_code)); }
        if (sets.length === 0) throw createHttpError(400, 'Aucune modification fournie.');
        sets.push(`updated_at = $${paramIndex++}`); params.push(nowMs());
        params.push(user.id);
        try {
            await dbRun(`UPDATE users SET ${sets.join(', ')} WHERE id = $${paramIndex}`, params);
        } catch (error) {
            if (isUniqueViolation(error)) throw createHttpError(409, 'Pseudo deja utilise.');
            throw error;
        }
        const updated = await getUserById(user.id);
        sendJson(res, 200, { ok: true, user: toSafeUser(updated) }, corsHeaders);
    }

    async function handleEventsList(res, corsHeaders, parsedUrl) {
        const statusFilter = String(parsedUrl.searchParams.get('status') || '').trim().toLowerCase();
        const max = clampNumber(Number.parseInt(parsedUrl.searchParams.get('limit') || '20', 10), 1, 100);
        let rows;
        if (statusFilter) {
            rows = await dbAll(
                `SELECT e.id, e.code, e.name, e.description, e.mode, e.status, e.max_players, e.created_by, e.winner_user_id,
                        e.starts_at, e.created_at, e.updated_at, owner.pseudo AS owner_pseudo, winner.pseudo AS winner_pseudo
                 FROM events e JOIN users owner ON owner.id = e.created_by LEFT JOIN users winner ON winner.id = e.winner_user_id
                 WHERE e.status = $1 ORDER BY e.created_at DESC LIMIT $2`, [statusFilter, max]
            );
        } else {
            rows = await dbAll(
                `SELECT e.id, e.code, e.name, e.description, e.mode, e.status, e.max_players, e.created_by, e.winner_user_id,
                        e.starts_at, e.created_at, e.updated_at, owner.pseudo AS owner_pseudo, winner.pseudo AS winner_pseudo
                 FROM events e JOIN users owner ON owner.id = e.created_by LEFT JOIN users winner ON winner.id = e.winner_user_id
                 ORDER BY e.created_at DESC LIMIT $1`, [max]
            );
        }
        const events = [];
        for (const row of rows) events.push(await toEventPayload(row, { includeMatches: false }));
        sendJson(res, 200, { ok: true, events }, corsHeaders);
    }

    async function handleEventsCreate(req, res, corsHeaders) {
        const user = await requireUser(req);
        if (!user) throw createHttpError(401, 'Authentification requise.');
        const body = await readJsonBody(req);
        const name = sanitizeEventName(body.name);
        const description = sanitizeEventDescription(body.description);
        const mode = sanitizeEventMode(body.mode);
        const maxEventPlayers = normalizeCompetitionMaxPlayers(body.maxPlayers || body.max_players);
        if (!name || name.length < 3) throw createHttpError(400, 'Nom evenement invalide.');
        const now = nowMs();
        const code = await generateEventCode();
        await dbRun(
            `INSERT INTO events (code, name, description, mode, status, max_players, created_by, starts_at, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'lobby', $5, $6, NULL, $7, $8)`,
            [code, name, description, mode, maxEventPlayers, user.id, now, now]
        );
        const eventRow = await requireEventByCodeOrThrow(code);
        await upsertEventPlayer(eventRow.id, user, true);
        sendJson(res, 201, { ok: true, event: await toEventPayload(eventRow) }, corsHeaders);
    }

    async function handleEventDetail(res, corsHeaders, code) {
        const event = await requireEventByCodeOrThrow(code);
        sendJson(res, 200, { ok: true, event: await toEventPayload(event) }, corsHeaders);
    }

    async function handleEventJoin(req, res, corsHeaders, code) {
        const user = await requireUser(req);
        if (!user) throw createHttpError(401, 'Authentification requise.');
        const event = await requireEventByCodeOrThrow(code);
        if (String(event.status) !== 'lobby') throw createHttpError(409, 'Le salon est deja lance.');
        const alreadyJoined = await dbGet('SELECT 1 FROM event_players WHERE event_id = $1 AND user_id = $2 LIMIT 1', [event.id, user.id]);
        if (!alreadyJoined && !(await hasAvailableSeats(event))) throw createHttpError(409, 'Salon complet.');
        await upsertEventPlayer(event.id, user, false);
        const updated = await requireEventByCodeOrThrow(code);
        sendJson(res, 200, { ok: true, event: await toEventPayload(updated) }, corsHeaders);
    }

    async function handleEventLeave(req, res, corsHeaders, code) {
        const user = await requireUser(req);
        if (!user) throw createHttpError(401, 'Authentification requise.');
        const event = await requireEventByCodeOrThrow(code);
        if (String(event.status) !== 'lobby') throw createHttpError(409, 'Impossible de quitter: partie deja lancee.');
        if (await userIsEventHost(event.id, user.id)) throw createHttpError(409, 'L hote ne peut pas quitter.');
        await dbRun('DELETE FROM event_players WHERE event_id = $1 AND user_id = $2', [event.id, user.id]);
        const updated = await requireEventByCodeOrThrow(code);
        sendJson(res, 200, { ok: true, event: await toEventPayload(updated) }, corsHeaders);
    }

    async function handleEventStart(req, res, corsHeaders, code) {
        const user = await requireUser(req);
        if (!user) throw createHttpError(401, 'Authentification requise.');
        const event = await requireEventByCodeOrThrow(code);
        if (!(await userIsEventHost(event.id, user.id))) throw createHttpError(403, 'Seul l hote peut lancer la competition.');
        if (String(event.status) !== 'lobby') throw createHttpError(409, 'Competition deja lancee.');
        const entrants = (await getEventPlayers(event.id)).map(p => p.userId);
        if (entrants.length < 2) throw createHttpError(409, 'Au moins 2 joueurs sont requis.');
        await createRoundMatches(event.id, 1, shuffleArray(entrants));
        await dbRun('UPDATE events SET status = $1, starts_at = $2, updated_at = $3 WHERE id = $4', ['started', nowMs(), nowMs(), event.id]);
        await ensureCompetitionProgress(event.id);
        const updated = await requireEventByCodeOrThrow(code);
        sendJson(res, 200, { ok: true, event: await toEventPayload(updated) }, corsHeaders);
    }

    async function handleEventDelete(req, res, corsHeaders, code) {
        const user = await requireUser(req);
        if (!user) throw createHttpError(401, 'Authentification requise.');
        const event = await requireEventByCodeOrThrow(code);
        if (!(await userIsEventHost(event.id, user.id))) throw createHttpError(403, 'Seul l hote peut supprimer la competition.');
        if (String(event.status) === 'started') throw createHttpError(409, 'Impossible de supprimer une competition en cours.');
        await dbRun('DELETE FROM matches WHERE event_id = $1', [event.id]);
        await dbRun('DELETE FROM event_players WHERE event_id = $1', [event.id]);
        await dbRun('DELETE FROM events WHERE id = $1', [event.id]);
        sendJson(res, 200, { ok: true, message: 'Competition supprimee avec succes.' }, corsHeaders);
    }

    async function handleMatchmakingJoin(req, res, corsHeaders) {
        const user = await requireUser(req);
        if (!user) throw createHttpError(401, 'Authentification requise.');
        
        const body = await readJsonBody(req);
        const mode = sanitizeEventMode(body.mode);
        const now = nowMs();

        // 1. Check if already in queue
        const existing = await dbGet('SELECT * FROM matchmaking_queue WHERE user_id = $1', [user.id]);
        if (existing) {
            // Update mode/elo if already there
            await dbRun('UPDATE matchmaking_queue SET mode = $1, elo = $2, joined_at = $3 WHERE user_id = $4', [mode, user.elo, now, user.id]);
        } else {
            await dbRun('INSERT INTO matchmaking_queue (user_id, mode, joined_at, elo) VALUES ($1, $2, $3, $4)', [user.id, mode, now, user.elo]);
        }

        // 2. Try to find a match
        // Find players in same mode, not self, within +/- 150 ELO
        const opponent = await dbGet(`
            SELECT user_id, elo 
            FROM matchmaking_queue 
            WHERE mode = $1 AND user_id != $2 
            AND elo BETWEEN $3 AND $4
            ORDER BY joined_at ASC 
            LIMIT 1
        `, [mode, user.id, user.elo - 150, user.elo + 150]);

        if (opponent) {
            // MATCH FOUND!
            const playerA = user.id;
            const playerB = opponent.user_id;

            // Remove both from queue
            await dbRun('DELETE FROM matchmaking_queue WHERE user_id IN ($1, $2)', [playerA, playerB]);

            // Create a ranked match in the Ranked Event (ID=1)
            const matchResult = await dbRun(`
                INSERT INTO matches (event_id, round_number, slot_index, player_a_user_id, player_b_user_id, status, created_at, updated_at)
                VALUES (1, 0, 0, $1, $2, 'pending', $3, $3)
            `, [playerA, playerB, now]);
            
            sendJson(res, 200, { ok: true, matched: true, matchId: 0, opponentPseudo: 'Adversaire' }, corsHeaders);
            return;
        }

        sendJson(res, 200, { ok: true, matched: false, message: 'En attente d\'un adversaire...' }, corsHeaders);
    }

    async function handleMatchmakingCancel(req, res, corsHeaders) {
        const user = await requireUser(req);
        if (!user) throw createHttpError(401, 'Authentification requise.');
        await dbRun('DELETE FROM matchmaking_queue WHERE user_id = $1', [user.id]);
        sendJson(res, 200, { ok: true, message: 'Recherche annulée.' }, corsHeaders);
    }

    async function handleMatchmakingStatus(req, res, corsHeaders) {
        const user = await requireUser(req);
        if (!user) throw createHttpError(401, 'Authentification requise.');

        const inQueue = await dbGet('SELECT joined_at FROM matchmaking_queue WHERE user_id = $1', [user.id]);
        
        // Check if a match was created recently for this user
        const match = await dbGet(`
            SELECT m.id, u1.pseudo as p1, u2.pseudo as p2, m.player_a_user_id, m.player_b_user_id
            FROM matches m
            JOIN users u1 ON u1.id = m.player_a_user_id
            JOIN users u2 ON u2.id = m.player_b_user_id
            WHERE m.event_id = 1 AND m.status = 'pending'
            AND (m.player_a_user_id = $1 OR m.player_b_user_id = $1)
            ORDER BY m.created_at DESC
            LIMIT 1
        `, [user.id]);

        if (match) {
            const oppPseudo = match.player_a_user_id === user.id ? match.p2 : match.p1;
            sendJson(res, 200, { 
                ok: true, 
                matched: true, 
                matchId: match.id, 
                opponentPseudo: oppPseudo,
                isHost: (match.player_a_user_id === user.id)
            }, corsHeaders);
            return;
        }

        sendJson(res, 200, { ok: true, matched: false, inQueue: !!inQueue }, corsHeaders);
    }

    async function handleMatchResult(req, res, corsHeaders, code, matchId) {
        const user = await requireUser(req);
        if (!user) throw createHttpError(401, 'Authentification requise.');
        const event = await requireEventByCodeOrThrow(code);
        if (!(await userIsEventHost(event.id, user.id))) throw createHttpError(403, 'Seul l hote peut valider un resultat.');
        if (String(event.status) !== 'started') throw createHttpError(409, 'Competition non active.');
        const body = await readJsonBody(req);
        const winnerUserId = Number.parseInt(body.winnerUserId, 10);
        const scoreA = clampNumber(Number.parseInt(body.scoreA || '0', 10), 0, 999);
        const scoreB = clampNumber(Number.parseInt(body.scoreB || '0', 10), 0, 999);
        if (!Number.isFinite(winnerUserId)) throw createHttpError(400, 'winnerUserId est requis.');
        const match = await dbGet('SELECT id, player_a_user_id, player_b_user_id, status FROM matches WHERE id = $1 AND event_id = $2 LIMIT 1', [matchId, event.id]);
        if (!match) throw createHttpError(404, 'Match introuvable.');
        if (String(match.status) !== 'pending') throw createHttpError(409, 'Ce match est deja valide.');
        const playerA = match.player_a_user_id == null ? null : Number(match.player_a_user_id);
        const playerB = match.player_b_user_id == null ? null : Number(match.player_b_user_id);
        if (winnerUserId !== playerA && winnerUserId !== playerB) throw createHttpError(400, 'Le gagnant doit etre dans le match.');
        const loserUserId = winnerUserId === playerA ? playerB : playerA;
        await dbRun(`UPDATE matches SET winner_user_id = $1, status = 'completed', score_a = $2, score_b = $3, updated_at = $4 WHERE id = $5`, [winnerUserId, scoreA, scoreB, nowMs(), match.id]);
        await addPlayerStats(event.id, winnerUserId, { wins: 1, points: 3 });
        if (loserUserId != null) { await addPlayerStats(event.id, loserUserId, { losses: 1, points: 0 }); await applyGlobalMatchResult(winnerUserId, loserUserId); }
        await ensureCompetitionProgress(event.id);
        const updated = await requireEventByCodeOrThrow(code);
        sendJson(res, 200, { ok: true, event: await toEventPayload(updated) }, corsHeaders);
    }

    async function handleEventMessagesGet(req, res, corsHeaders, code) {
        const user = await requireUser(req);
        if (!user) throw createHttpError(401, 'Authentification requise.');
        const event = await requireEventByCodeOrThrow(code);
        // Check if user is in event
        const isPlayer = await dbGet('SELECT user_id FROM event_players WHERE event_id = $1 AND user_id = $2 LIMIT 1', [event.id, user.id]);
        if (!isPlayer) throw createHttpError(403, 'Vous devez rejoindre le salon pour voir les messages.');

        const messages = await dbAll(`
            SELECT m.id, m.content, m.tone, m.created_at as ts, u.pseudo as sender_name, u.avatar_url as sender_avatar
            FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.event_id = $1 
            ORDER BY m.created_at ASC 
            LIMIT 50
        `, [event.id]);
        
        sendJson(res, 200, { ok: true, messages }, corsHeaders);
    }

    async function handleEventMessagePost(req, res, corsHeaders, code) {
        const user = await requireUser(req);
        if (!user) throw createHttpError(401, 'Authentification requise.');
        const event = await requireEventByCodeOrThrow(code);
        const isPlayer = await dbGet('SELECT user_id FROM event_players WHERE event_id = $1 AND user_id = $2 LIMIT 1', [event.id, user.id]);
        if (!isPlayer) throw createHttpError(403, 'Vous devez rejoindre le salon pour envoyer un message.');

        const body = await readJsonBody(req);
        const content = String(body.content || '').trim().slice(0, 500);
        if (!content) throw createHttpError(400, 'Message vide.');

        await dbRun('INSERT INTO messages (event_id, user_id, content, tone, created_at) VALUES ($1, $2, $3, $4, $5)', 
            [event.id, user.id, content, body.tone || 'info', nowMs()]);
        
        sendJson(res, 201, { ok: true }, corsHeaders);
    }

    // --- Main Router ---
    async function routeApi(req, res, corsHeaders, parsedUrl) {
        const method = String(req.method || 'GET').toUpperCase();
        const pathName = parsedUrl.pathname;
        const userIp = getClientIp(req);

        if (pathName === '/api/health' && method === 'GET') {
            const stats = getRoomsStats();
            let dbStatus = 'postgresql (error)';
            try {
                const res = await pool.query('SELECT 1');
                if (res.rowCount === 1) dbStatus = 'postgresql (ok)';
            } catch (err) {
                console.error('[HEALTH_CHECK_ERROR]', err);
            }

            sendJson(res, 200, {
                ok: true,
                rooms: stats.rooms,
                clients: stats.clients,
                maxPlayers,
                db: dbStatus
            }, corsHeaders);
            return;
        }
        if (pathName === '/api/auth/register' && method === 'POST') { await handleAuthRegister(req, res, corsHeaders, userIp); return; }
        if (pathName === '/api/auth/login' && method === 'POST') { await handleAuthLogin(req, res, corsHeaders, userIp); return; }
        if (pathName === '/api/auth/me' && method === 'GET') { await handleAuthMe(req, res, corsHeaders); return; }
        if (pathName === '/api/auth/logout' && method === 'POST') { await handleAuthLogout(req, res, corsHeaders); return; }
        if (pathName === '/api/profile/me' && method === 'GET') { await handleProfileMe(req, res, corsHeaders, parsedUrl); return; }
        if (pathName === '/api/profile/me' && method === 'POST') { await handleProfileUpdate(req, res, corsHeaders); return; }
        if (pathName === '/api/leaderboard' && method === 'GET') { await handleLeaderboard(res, corsHeaders, parsedUrl); return; }
        if (pathName === '/api/events' && method === 'GET') { await handleEventsList(res, corsHeaders, parsedUrl); return; }
        if (pathName === '/api/events' && method === 'POST') { await handleEventsCreate(req, res, corsHeaders); return; }

        const matchResultRoute = pathName.match(/^\/api\/events\/([a-z0-9]{4,10})\/matches\/([0-9]+)\/result$/i);
        if (matchResultRoute && method === 'POST') { await handleMatchResult(req, res, corsHeaders, matchResultRoute[1], Number.parseInt(matchResultRoute[2], 10)); return; }

        if (pathName.startsWith('/api/matchmaking/')) {
            if (pathName === '/api/matchmaking/join' && method === 'POST') { await handleMatchmakingJoin(req, res, corsHeaders); return; }
            if (pathName === '/api/matchmaking/cancel' && method === 'POST') { await handleMatchmakingCancel(req, res, corsHeaders); return; }
            if (pathName === '/api/matchmaking/status' && method === 'GET') { await handleMatchmakingStatus(req, res, corsHeaders); return; }
        }

        const actionRoute = pathName.match(/^\/api\/events\/([A-Z0-9]{6})(?:\/([a-z]+))?$/);
        if (actionRoute) {
            const code = actionRoute[1]; const action = actionRoute[2] || '';
            if (!action && method === 'GET') { await handleEventDetail(res, corsHeaders, code); return; }
            if (!action && method === 'DELETE') { await handleEventDelete(req, res, corsHeaders, code); return; }
            if (action === 'join' && method === 'POST') { await handleEventJoin(req, res, corsHeaders, code); return; }
            if (action === 'leave' && method === 'POST') { await handleEventLeave(req, res, corsHeaders, code); return; }
            if (action === 'start' && method === 'POST') { await handleEventStart(req, res, corsHeaders, code); return; }
            if (action === 'messages' && method === 'GET') { await handleEventMessagesGet(req, res, corsHeaders, code); return; }
            if (action === 'messages' && method === 'POST') { await handleEventMessagePost(req, res, corsHeaders, code); return; }
        }

        throw createHttpError(404, 'Route API introuvable.');
    }

    // --- HTTP Handler ---
    async function handleHttp(req, res) {
        if (!schemaReady) await schemaPromise;
        const parsedUrl = new URL(req.url || '/', 'http://localhost');
        const pathName = parsedUrl.pathname;
        if (!pathName.startsWith('/api/')) return false;
        const method = String(req.method || 'GET').toUpperCase();
        const corsHeaders = buildCorsHeaders(req.headers.origin);
        if (corsHeaders == null) { sendJson(res, 403, { ok: false, error: 'Origin non autorisee.' }); return true; }
        if (method === 'OPTIONS') { res.writeHead(204, corsHeaders); res.end(); return true; }
        try {
            await routeApi(req, res, corsHeaders || {}, parsedUrl);
        } catch (error) {
            const statusCode = clampNumber(Number.parseInt(error.status || '500', 10), 400, 599);
            const message = (statusCode >= 500 && statusCode !== 501) ? 'Erreur serveur.' : String(error.message || 'Requete invalide.');
            apiError(res, statusCode, message, corsHeaders || {});
        }
        return true;
    }

    function onTick() { purgeExpiredSessions().catch(() => {}); pruneAuthRate(); }

    return { handleHttp, onTick, getDbPath: () => 'postgresql://' };
}

module.exports = { createCompetitionApiPg };
