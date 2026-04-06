const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let DatabaseSync = null;

const EVENT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROLE_SET = new Set(['player', 'organizer', 'admin']);

function clampNumber(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, Math.trunc(value)));
}

function nowMs() {
    return Date.now();
}

function createHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function createCompetitionApi(options) {
    // Priority: DATABASE_URL (Railway PostgreSQL) > Supabase > SQLite
    const databaseUrl = String(options.databaseUrl || process.env.DATABASE_URL || '').trim();
    if (databaseUrl) {
        console.log('[API] DATABASE_URL detected, using PostgreSQL adapter (Railway).');
        const { createCompetitionApiPg } = require('./competition-api-pg');
        return createCompetitionApiPg({ ...options, databaseUrl });
    }

    const supabaseUrl = String(options.supabaseUrl || process.env.SUPABASE_URL || '').trim();
    const supabaseServiceRoleKey = String(options.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (supabaseUrl || supabaseServiceRoleKey) {
        if (!supabaseUrl || !supabaseServiceRoleKey) {
            throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be defined.');
        }
        const { createCompetitionApiSupabase } = require('./competition-api-supabase');
        return createCompetitionApiSupabase({
            ...options,
            supabaseUrl,
            supabaseServiceRoleKey
        });
    }

    const isOriginAllowed = options.isOriginAllowed;
    const getRoomsStats = options.getRoomsStats;
    const maxPlayers = clampNumber(Number(options.maxPlayers) || 4, 2, 16);

    const dbPath = String(options.dbPath || path.join(process.cwd(), 'data', 'jeu.sqlite'));
    const authRateLimitMax = clampNumber(Number(options.authRateLimitMax) || 25, 5, 300);
    const sessionTtlMs = clampNumber(
        Number(options.sessionTtlMs) || (7 * 24 * 60 * 60 * 1000),
        60 * 60 * 1000,
        90 * 24 * 60 * 60 * 1000
    );
    const rateWindowMs = clampNumber(Number(options.rateWindowMs) || 60000, 1000, 10 * 60 * 1000);

    const authRateByIp = new Map();
    const db = initDatabase(dbPath);

    // File d'attente de matchmaking
    const matchmakingQueue = new Map(); // userId -> { userId, pseudo, elo, mode, joinedAt }
    const matchmakingMatches = new Map(); // userId -> { eventCode, opponentId }

    function dbGet(sql, params = []) {
        return db.prepare(sql).get(...params);
    }

    function dbAll(sql, params = []) {
        return db.prepare(sql).all(...params);
    }

    function dbRun(sql, params = []) {
        return db.prepare(sql).run(...params);
    }

    function dbWithTransaction(callback) {
        db.exec('BEGIN');
        try {
            const result = callback();
            db.exec('COMMIT');
            return result;
        } catch (error) {
            db.exec('ROLLBACK');
            throw error;
        }
    }

    function sanitizeEmail(raw) {
        return String(raw || '').trim().toLowerCase();
    }

    function sanitizePseudo(raw) {
        return String(raw || '')
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, 24);
    }

    function sanitizeCountryCode(raw) {
        return String(raw || '')
            .trim()
            .toUpperCase()
            .replace(/[^A-Z]/g, '')
            .slice(0, 2);
    }

    function sanitizeAvatarUrl(raw) {
        const value = String(raw || '').trim().slice(0, 512);
        if (!value) return '';
        try {
            const parsed = new URL(value);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                return parsed.toString();
            }
        } catch (_error) {
            return '';
        }
        return '';
    }

    function sanitizeRole(raw) {
        const role = String(raw || '').trim().toLowerCase();
        return ROLE_SET.has(role) ? role : 'player';
    }

    function levelFromElo(elo) {
        const normalizedElo = Number.isFinite(elo) ? elo : 1200;
        return Math.max(1, Math.floor((normalizedElo - 800) / 120) + 1);
    }

    function winRatePercent(wins, gamesPlayed) {
        const g = Math.max(0, Number(gamesPlayed || 0));
        if (g === 0) return 0;
        const w = Math.max(0, Number(wins || 0));
        return Math.round((w / g) * 10000) / 100;
    }

    function computeEloDelta(winnerEloRaw, loserEloRaw, kFactor = 24) {
        const winnerElo = Number.isFinite(winnerEloRaw) ? winnerEloRaw : 1200;
        const loserElo = Number.isFinite(loserEloRaw) ? loserEloRaw : 1200;
        const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
        const expectedLoser = 1 - expectedWinner;
        const winnerDelta = Math.round(kFactor * (1 - expectedWinner));
        const loserDelta = Math.round(kFactor * (0 - expectedLoser));
        return { winnerDelta, loserDelta };
    }

    function sanitizeEventName(raw) {
        return String(raw || '')
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, 64);
    }

    function sanitizeEventDescription(raw) {
        return String(raw || '')
            .trim()
            .slice(0, 280);
    }

    function sanitizeEventMode(raw) {
        const value = String(raw || '').trim().toLowerCase();
        if (!value) return 'classic';
        if (/^[a-z0-9_-]{2,24}$/.test(value)) return value;
        return 'classic';
    }

    function normalizeCompetitionMaxPlayers(rawValue) {
        return clampNumber(Number.parseInt(rawValue, 10), 2, 64);
    }

    function isEmailValid(email) {
        if (!email || email.length > 120) return false;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function isPasswordValid(password) {
        return typeof password === 'string' && password.length >= 8 && password.length <= 128;
    }

    function hashToken(rawToken) {
        return crypto.createHash('sha256').update(String(rawToken || '')).digest('hex');
    }

    function hashPassword(password, saltHex) {
        const salt = Buffer.from(saltHex, 'hex');
        return crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
    }

    function createPasswordHash(password) {
        const saltHex = crypto.randomBytes(16).toString('hex');
        const hashHex = hashPassword(password, saltHex);
        return { saltHex, hashHex };
    }

    function secureCompareHex(leftHex, rightHex) {
        try {
            const left = Buffer.from(String(leftHex || ''), 'hex');
            const right = Buffer.from(String(rightHex || ''), 'hex');
            if (left.length === 0 || right.length === 0 || left.length !== right.length) {
                return false;
            }
            return crypto.timingSafeEqual(left, right);
        } catch (_error) {
            return false;
        }
    }

    function issueSessionToken(userId) {
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(token);
        const now = nowMs();
        dbRun(
            'INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)',
            [tokenHash, userId, now, now + sessionTtlMs, now]
        );
        return token;
    }

    function purgeExpiredSessions() {
        dbRun('DELETE FROM sessions WHERE expires_at <= ?', [nowMs()]);
    }

    function getBearerToken(req) {
        const raw = String(req?.headers?.authorization || '').trim();
        if (!raw) return '';
        const match = raw.match(/^Bearer\s+(.+)$/i);
        if (!match) return '';
        return match[1].trim();
    }

    function requireUser(req) {
        const token = getBearerToken(req);
        if (!token) return null;

        const tokenHash = hashToken(token);
        const now = nowMs();
        const row = dbGet(
            `
            SELECT s.token_hash, s.user_id, s.expires_at, u.id, u.email, u.pseudo, u.role, u.avatar_url, u.country_code,
                   u.level, u.elo, u.games_played, u.wins_total, u.losses_total, u.auth_provider, u.created_at
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = ?
            LIMIT 1
            `,
            [tokenHash]
        );
        if (!row) return null;
        if (Number(row.expires_at) <= now) {
            dbRun('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
            return null;
        }

        dbRun('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?', [now, tokenHash]);
        return {
            id: Number(row.id),
            email: row.email,
            pseudo: row.pseudo,
            role: sanitizeRole(row.role),
            avatarUrl: String(row.avatar_url || ''),
            country: String(row.country_code || ''),
            level: Number(row.level || 1),
            elo: Number(row.elo || 1200),
            gamesPlayed: Number(row.games_played || 0),
            wins: Number(row.wins_total || 0),
            losses: Number(row.losses_total || 0),
            winRate: winRatePercent(Number(row.wins_total || 0), Number(row.games_played || 0)),
            authProvider: String(row.auth_provider || 'password'),
            createdAt: Number(row.created_at)
        };
    }

    function toSafeUser(userRow) {
        const gamesPlayed = Number(userRow.games_played || 0);
        const winsTotal = Number(userRow.wins_total || 0);
        const lossesTotal = Number(userRow.losses_total || 0);
        const elo = Number(userRow.elo || 1200);
        const level = Number(userRow.level || levelFromElo(elo));
        return {
            id: Number(userRow.id),
            email: String(userRow.email || ''),
            pseudo: String(userRow.pseudo || ''),
            role: sanitizeRole(userRow.role),
            avatarUrl: String(userRow.avatar_url || ''),
            country: String(userRow.country_code || ''),
            level,
            elo,
            gamesPlayed,
            wins: winsTotal,
            losses: lossesTotal,
            winRate: winRatePercent(winsTotal, gamesPlayed),
            authProvider: String(userRow.auth_provider || 'password'),
            createdAt: Number(userRow.created_at || userRow.createdAt || nowMs())
        };
    }

    function getUserById(userId) {
        return dbGet(
            `
            SELECT id, email, pseudo, role, avatar_url, country_code, level, elo, games_played, wins_total, losses_total, auth_provider, created_at
            FROM users
            WHERE id = ?
            LIMIT 1
            `,
            [userId]
        );
    }

    function getUserMatchHistory(userId, limitRaw = 20) {
        const limit = clampNumber(Number.parseInt(limitRaw, 10), 1, 100);
        const rows = dbAll(
            `
            SELECT m.id, m.event_id, m.round_number, m.slot_index, m.player_a_user_id, m.player_b_user_id, m.winner_user_id,
                   m.score_a, m.score_b, m.updated_at, e.name AS event_name, e.code AS event_code
            FROM matches m
            JOIN events e ON e.id = m.event_id
            WHERE m.status = 'completed'
              AND (m.player_a_user_id = ? OR m.player_b_user_id = ?)
            ORDER BY m.updated_at DESC
            LIMIT ?
            `,
            [userId, userId, limit]
        );

        return rows.map((row) => {
            const playerA = row.player_a_user_id == null ? null : Number(row.player_a_user_id);
            const playerB = row.player_b_user_id == null ? null : Number(row.player_b_user_id);
            const winner = row.winner_user_id == null ? null : Number(row.winner_user_id);
            const opponentId = playerA === Number(userId) ? playerB : playerA;
            const opponentRow = opponentId == null ? null : dbGet('SELECT pseudo FROM users WHERE id = ? LIMIT 1', [opponentId]);
            return {
                matchId: Number(row.id),
                eventId: Number(row.event_id),
                eventCode: String(row.event_code || ''),
                eventName: String(row.event_name || 'Evenement'),
                round: Number(row.round_number || 0),
                slot: Number(row.slot_index || 0),
                playedAt: Number(row.updated_at || 0),
                opponentUserId: opponentId,
                opponentPseudo: opponentId == null ? 'BYE' : String(opponentRow?.pseudo || `Joueur #${opponentId}`),
                result: winner === Number(userId) ? 'win' : 'loss',
                scoreA: Number(row.score_a || 0),
                scoreB: Number(row.score_b || 0),
                winnerUserId: winner
            };
        });
    }

    function getClientIp(req) {
        const forwardedRaw = req?.headers?.['x-forwarded-for'];
        if (typeof forwardedRaw === 'string' && forwardedRaw.trim()) {
            return forwardedRaw.split(',')[0].trim();
        }
        return String(req?.socket?.remoteAddress || '').trim() || 'unknown';
    }

    function hitAuthRateLimit(ip) {
        const now = nowMs();
        const key = String(ip || 'unknown');
        let bucket = authRateByIp.get(key);
        if (!bucket) {
            bucket = [];
            authRateByIp.set(key, bucket);
        }
        while (bucket.length > 0 && (now - bucket[0]) > rateWindowMs) {
            bucket.shift();
        }
        bucket.push(now);
        return bucket.length > authRateLimitMax;
    }

    function pruneAuthRate() {
        const now = nowMs();
        for (const [ip, bucket] of authRateByIp.entries()) {
            while (bucket.length > 0 && (now - bucket[0]) > rateWindowMs) {
                bucket.shift();
            }
            if (bucket.length === 0) {
                authRateByIp.delete(ip);
            }
        }
    }

    function buildCorsHeaders(originHeader) {
        const rawOrigin = String(originHeader || '').trim();
        if (!rawOrigin) {
            return {};
        }
        if (!isOriginAllowed(rawOrigin)) {
            return null;
        }
        return {
            'Access-Control-Allow-Origin': rawOrigin,
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Max-Age': '86400',
            Vary: 'Origin'
        };
    }

    function sendJson(res, statusCode, payload, extraHeaders = {}) {
        const headers = {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            ...extraHeaders
        };
        res.writeHead(statusCode, headers);
        res.end(JSON.stringify(payload));
    }

    function apiError(res, statusCode, message, corsHeaders) {
        sendJson(res, statusCode, { ok: false, error: message }, corsHeaders);
    }

    function readJsonBody(req, limitBytes = 64 * 1024) {
        return new Promise((resolve, reject) => {
            let size = 0;
            const chunks = [];

            req.on('data', (chunk) => {
                size += chunk.length;
                if (size > limitBytes) {
                    reject(createHttpError(413, 'Corps de requete trop volumineux.'));
                    req.destroy();
                    return;
                }
                chunks.push(chunk);
            });

            req.on('end', () => {
                if (chunks.length === 0) {
                    resolve({});
                    return;
                }
                const text = Buffer.concat(chunks).toString('utf8');
                try {
                    const parsed = JSON.parse(text);
                    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                        reject(createHttpError(400, 'JSON invalide.'));
                        return;
                    }
                    resolve(parsed);
                } catch (_error) {
                    reject(createHttpError(400, 'JSON invalide.'));
                }
            });

            req.on('error', () => {
                reject(createHttpError(400, 'Lecture de requete impossible.'));
            });
        });
    }

    function isUniqueViolation(error) {
        const text = String(error?.message || '').toLowerCase();
        return text.includes('unique') || text.includes('constraint');
    }

    function generateEventCode() {
        for (let attempt = 0; attempt < 40; attempt += 1) {
            let code = '';
            for (let i = 0; i < 6; i += 1) {
                const index = crypto.randomInt(0, EVENT_CODE_ALPHABET.length);
                code += EVENT_CODE_ALPHABET[index];
            }
            const existing = dbGet('SELECT id FROM events WHERE code = ? LIMIT 1', [code]);
            if (!existing) return code;
        }
        throw createHttpError(500, 'Generation de code evenement impossible.');
    }

    function getEventByCode(code) {
        return dbGet(
            `
            SELECT e.id, e.code, e.name, e.description, e.mode, e.status, e.max_players, e.created_by, e.winner_user_id,
                   e.starts_at, e.created_at, e.updated_at,
                   owner.pseudo AS owner_pseudo,
                   winner.pseudo AS winner_pseudo
            FROM events e
            JOIN users owner ON owner.id = e.created_by
            LEFT JOIN users winner ON winner.id = e.winner_user_id
            WHERE e.code = ?
            LIMIT 1
            `,
            [String(code || '').toUpperCase()]
        );
    }

    function getEventPlayers(eventId) {
        return dbAll(
            `
            SELECT ep.user_id, ep.display_name, ep.is_host, ep.joined_at, ep.wins, ep.losses, ep.points, u.pseudo
            FROM event_players ep
            JOIN users u ON u.id = ep.user_id
            WHERE ep.event_id = ?
            ORDER BY ep.is_host DESC, ep.joined_at ASC
            `,
            [eventId]
        ).map((row) => ({
            userId: Number(row.user_id),
            pseudo: String(row.pseudo || ''),
            displayName: String(row.display_name || row.pseudo || ''),
            isHost: Number(row.is_host) === 1,
            joinedAt: Number(row.joined_at),
            wins: Number(row.wins),
            losses: Number(row.losses),
            points: Number(row.points)
        }));
    }

    function getEventMatches(eventId) {
        return dbAll(
            `
            SELECT id, round_number, slot_index, player_a_user_id, player_b_user_id, winner_user_id, status, score_a, score_b
            FROM matches
            WHERE event_id = ?
            ORDER BY round_number ASC, slot_index ASC
            `,
            [eventId]
        ).map((row) => ({
            id: Number(row.id),
            round: Number(row.round_number),
            slot: Number(row.slot_index),
            playerAUserId: row.player_a_user_id == null ? null : Number(row.player_a_user_id),
            playerBUserId: row.player_b_user_id == null ? null : Number(row.player_b_user_id),
            winnerUserId: row.winner_user_id == null ? null : Number(row.winner_user_id),
            status: String(row.status),
            scoreA: Number(row.score_a),
            scoreB: Number(row.score_b)
        }));
    }

    function toEventPayload(eventRow, options = {}) {
        const includeMatches = options.includeMatches !== false;
        const players = getEventPlayers(eventRow.id);
        const payload = {
            id: Number(eventRow.id),
            code: String(eventRow.code || ''),
            name: String(eventRow.name || ''),
            description: String(eventRow.description || ''),
            mode: String(eventRow.mode || 'classic'),
            status: String(eventRow.status || 'lobby'),
            maxPlayers: Number(eventRow.max_players),
            startsAt: eventRow.starts_at == null ? null : Number(eventRow.starts_at),
            createdAt: Number(eventRow.created_at),
            updatedAt: Number(eventRow.updated_at),
            createdBy: Number(eventRow.created_by),
            ownerPseudo: String(eventRow.owner_pseudo || ''),
            winnerUserId: eventRow.winner_user_id == null ? null : Number(eventRow.winner_user_id),
            winnerPseudo: eventRow.winner_pseudo == null ? null : String(eventRow.winner_pseudo),
            playerCount: players.length,
            players
        };
        if (includeMatches) {
            payload.matches = getEventMatches(eventRow.id);
        }
        return payload;
    }

    function requireEventByCodeOrThrow(code) {
        const event = getEventByCode(code);
        if (!event) {
            throw createHttpError(404, 'Evenement introuvable.');
        }
        return event;
    }

    function userIsEventHost(eventId, userId) {
        const row = dbGet(
            'SELECT is_host FROM event_players WHERE event_id = ? AND user_id = ? LIMIT 1',
            [eventId, userId]
        );
        return Boolean(row && Number(row.is_host) === 1);
    }

    function upsertEventPlayer(eventId, user, isHost = false) {
        const now = nowMs();
        dbRun(
            `
            INSERT INTO event_players (event_id, user_id, display_name, is_host, joined_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(event_id, user_id) DO UPDATE SET
                display_name = excluded.display_name,
                is_host = CASE WHEN excluded.is_host = 1 THEN 1 ELSE event_players.is_host END
            `,
            [eventId, user.id, user.pseudo, isHost ? 1 : 0, now]
        );
    }

    function hasAvailableSeats(eventRow) {
        const row = dbGet('SELECT COUNT(1) AS player_count FROM event_players WHERE event_id = ?', [eventRow.id]);
        return Number(row?.player_count || 0) < Number(eventRow.max_players || 0);
    }

    function addPlayerStats(eventId, userId, delta) {
        if (!userId) return;
        const wins = Number(delta.wins || 0);
        const losses = Number(delta.losses || 0);
        const points = Number(delta.points || 0);
        dbRun(
            `
            UPDATE event_players
            SET wins = wins + ?,
                losses = losses + ?,
                points = points + ?
            WHERE event_id = ? AND user_id = ?
            `,
            [wins, losses, points, eventId, userId]
        );
    }

    function applyGlobalMatchResult(winnerUserId, loserUserId) {
        if (!winnerUserId || !loserUserId) return;
        const winner = getUserById(winnerUserId);
        const loser = getUserById(loserUserId);
        if (!winner || !loser) return;

        const { winnerDelta, loserDelta } = computeEloDelta(
            Number(winner.elo || 1200),
            Number(loser.elo || 1200)
        );

        const winnerElo = Math.max(100, Number(winner.elo || 1200) + winnerDelta);
        const loserElo = Math.max(100, Number(loser.elo || 1200) + loserDelta);
        const winnerGames = Number(winner.games_played || 0) + 1;
        const loserGames = Number(loser.games_played || 0) + 1;
        const winnerWins = Number(winner.wins_total || 0) + 1;
        const loserLosses = Number(loser.losses_total || 0) + 1;

        dbRun(
            `
            UPDATE users
            SET elo = ?, level = ?, games_played = ?, wins_total = ?, updated_at = ?
            WHERE id = ?
            `,
            [winnerElo, levelFromElo(winnerElo), winnerGames, winnerWins, nowMs(), winnerUserId]
        );
        dbRun(
            `
            UPDATE users
            SET elo = ?, level = ?, games_played = ?, losses_total = ?, updated_at = ?
            WHERE id = ?
            `,
            [loserElo, levelFromElo(loserElo), loserGames, loserLosses, nowMs(), loserUserId]
        );
    }

    function shuffleArray(values) {
        const output = [...values];
        for (let i = output.length - 1; i > 0; i -= 1) {
            const j = crypto.randomInt(0, i + 1);
            const temp = output[i];
            output[i] = output[j];
            output[j] = temp;
        }
        return output;
    }

    function createRoundMatches(eventId, roundNumber, playerIds) {
        let participants = [...playerIds];
        if (participants.length % 2 !== 0) {
            participants.push(null);
        }

        const now = nowMs();
        let slotIndex = 1;
        for (let i = 0; i < participants.length; i += 2) {
            const playerA = participants[i];
            const playerB = participants[i + 1];
            if (playerA != null && playerB != null) {
                dbRun(
                    `
                    INSERT INTO matches (
                        event_id, round_number, slot_index, player_a_user_id, player_b_user_id,
                        winner_user_id, status, score_a, score_b, created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, NULL, 'pending', 0, 0, ?, ?)
                    `,
                    [eventId, roundNumber, slotIndex, playerA, playerB, now, now]
                );
            } else {
                const winnerUserId = playerA == null ? playerB : playerA;
                dbRun(
                    `
                    INSERT INTO matches (
                        event_id, round_number, slot_index, player_a_user_id, player_b_user_id,
                        winner_user_id, status, score_a, score_b, created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, 'completed', 0, 0, ?, ?)
                    `,
                    [eventId, roundNumber, slotIndex, playerA, playerB, winnerUserId, now, now]
                );
                if (winnerUserId != null) {
                    addPlayerStats(eventId, winnerUserId, { wins: 1, points: 1 });
                }
            }
            slotIndex += 1;
        }
    }

    function ensureCompetitionProgress(eventId) {
        while (true) {
            const eventRow = dbGet('SELECT id, status FROM events WHERE id = ? LIMIT 1', [eventId]);
            if (!eventRow || String(eventRow.status) !== 'started') {
                return;
            }

            const roundRow = dbGet('SELECT MAX(round_number) AS max_round FROM matches WHERE event_id = ?', [eventId]);
            const maxRound = Number(roundRow?.max_round || 0);
            if (maxRound < 1) return;

            const pendingRow = dbGet(
                'SELECT COUNT(1) AS pending_count FROM matches WHERE event_id = ? AND round_number = ? AND status = ?',
                [eventId, maxRound, 'pending']
            );
            if (Number(pendingRow?.pending_count || 0) > 0) {
                return;
            }

            const winners = dbAll(
                `
                SELECT winner_user_id
                FROM matches
                WHERE event_id = ? AND round_number = ?
                ORDER BY slot_index ASC
                `,
                [eventId, maxRound]
            )
                .map((row) => (row.winner_user_id == null ? null : Number(row.winner_user_id)))
                .filter((value) => value != null);

            if (winners.length <= 1) {
                const winnerUserId = winners.length === 1 ? winners[0] : null;
                dbRun(
                    'UPDATE events SET status = ?, winner_user_id = ?, updated_at = ? WHERE id = ?',
                    ['finished', winnerUserId, nowMs(), eventId]
                );
                return;
            }

            createRoundMatches(eventId, maxRound + 1, winners);
        }
    }

    async function handleAuthRegister(req, res, corsHeaders, userIp) {
        if (hitAuthRateLimit(userIp)) {
            apiError(res, 429, 'Trop de tentatives. Reessayez plus tard.', corsHeaders);
            return;
        }

        const body = await readJsonBody(req);
        const email = sanitizeEmail(body.email);
        const password = String(body.password || '');
        const pseudo = sanitizePseudo(body.pseudo);

        if (!isEmailValid(email)) {
            throw createHttpError(400, 'Email invalide.');
        }
        if (!isPasswordValid(password)) {
            throw createHttpError(400, 'Mot de passe trop court (minimum 8 caracteres).');
        }
        if (!pseudo || pseudo.length < 2) {
            throw createHttpError(400, 'Pseudo invalide.');
        }

        const now = nowMs();
        const { saltHex, hashHex } = createPasswordHash(password);
        let createdUser;
        try {
            const insertResult = dbRun(
                `
                INSERT INTO users (
                    email, password_hash, password_salt, pseudo, role, avatar_url, country_code,
                    level, elo, games_played, wins_total, losses_total, auth_provider, auth_provider_user_id,
                    created_at, updated_at
                )
                VALUES (?, ?, ?, ?, 'player', ?, ?, 1, 1200, 0, 0, 0, 'password', NULL, ?, ?)
                `,
                [email, hashHex, saltHex, pseudo, sanitizeAvatarUrl(body.avatarUrl), sanitizeCountryCode(body.country), now, now]
            );
            const userId = Number(insertResult.lastInsertRowid);
            createdUser = dbGet(
                'SELECT id, email, pseudo, role, avatar_url, country_code, level, elo, games_played, wins_total, losses_total, auth_provider, created_at FROM users WHERE id = ? LIMIT 1',
                [userId]
            );
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw createHttpError(409, 'Email ou pseudo deja utilise.');
            }
            throw error;
        }

        const token = issueSessionToken(createdUser.id);
        sendJson(
            res,
            201,
            {
                ok: true,
                token,
                user: toSafeUser(createdUser)
            },
            corsHeaders
        );
    }

    async function handleAuthLogin(req, res, corsHeaders, userIp) {
        if (hitAuthRateLimit(userIp)) {
            apiError(res, 429, 'Trop de tentatives. Reessayez plus tard.', corsHeaders);
            return;
        }

        const body = await readJsonBody(req);
        const email = sanitizeEmail(body.email);
        const password = String(body.password || '');

        if (!isEmailValid(email) || !password) {
            throw createHttpError(400, 'Identifiants invalides.');
        }

        const row = dbGet(
            `
            SELECT id, email, pseudo, role, avatar_url, country_code, level, elo, games_played, wins_total, losses_total, auth_provider, created_at, password_hash, password_salt
            FROM users
            WHERE email = ?
            LIMIT 1
            `,
            [email]
        );
        if (!row) {
            throw createHttpError(401, 'Email ou mot de passe invalide.');
        }

        const candidateHash = hashPassword(password, row.password_salt);
        if (!secureCompareHex(candidateHash, row.password_hash)) {
            throw createHttpError(401, 'Email ou mot de passe invalide.');
        }

        const token = issueSessionToken(row.id);
        sendJson(
            res,
            200,
            {
                ok: true,
                token,
                user: toSafeUser(row)
            },
            corsHeaders
        );
    }

    function handleAuthMe(req, res, corsHeaders) {
        const user = requireUser(req);
        if (!user) {
            throw createHttpError(401, 'Session invalide.');
        }
        sendJson(res, 200, { ok: true, user }, corsHeaders);
    }

    async function handleAuthLogout(req, res, corsHeaders) {
        const token = getBearerToken(req);
        if (!token) {
            throw createHttpError(401, 'Session invalide.');
        }
        const tokenHash = hashToken(token);
        dbRun('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
        sendJson(res, 200, { ok: true }, corsHeaders);
    }

    async function handleAuthOAuthMobile(_req, _res, _corsHeaders, _userIp) {
        throw createHttpError(501, 'OAuth Google/Apple requis le mode Supabase.');
    }

    async function handleProfileMe(req, res, corsHeaders, parsedUrl) {
        const user = requireUser(req);
        if (!user) {
            throw createHttpError(401, 'Session invalide.');
        }
        const matchHistory = getUserMatchHistory(user.id, parsedUrl.searchParams.get('historyLimit') || '20');
        sendJson(
            res,
            200,
            {
                ok: true,
                user,
                matchHistory,
                stats: {
                    gamesPlayed: user.gamesPlayed,
                    wins: user.wins,
                    losses: user.losses,
                    winRate: user.winRate,
                    elo: user.elo,
                    level: user.level
                }
            },
            corsHeaders
        );
    }

    async function handleProfileUpdate(req, res, corsHeaders) {
        const user = requireUser(req);
        if (!user) {
            throw createHttpError(401, 'Session invalide.');
        }
        const body = await readJsonBody(req);
        const patchFields = [];
        const params = [];

        if (typeof body.pseudo === 'string') {
            const pseudo = sanitizePseudo(body.pseudo);
            if (pseudo.length < 2) {
                throw createHttpError(400, 'Pseudo invalide.');
            }
            patchFields.push('pseudo = ?');
            params.push(pseudo);
        }
        if (typeof body.avatarUrl === 'string' || typeof body.avatar_url === 'string') {
            patchFields.push('avatar_url = ?');
            params.push(sanitizeAvatarUrl(body.avatarUrl || body.avatar_url));
        }
        if (typeof body.country === 'string' || typeof body.countryCode === 'string' || typeof body.country_code === 'string') {
            patchFields.push('country_code = ?');
            params.push(sanitizeCountryCode(body.country || body.countryCode || body.country_code));
        }

        if (patchFields.length === 0) {
            throw createHttpError(400, 'Aucune modification fournie.');
        }
        patchFields.push('updated_at = ?');
        params.push(nowMs(), user.id);

        try {
            dbRun(`UPDATE users SET ${patchFields.join(', ')} WHERE id = ?`, params);
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw createHttpError(409, 'Pseudo deja utilise.');
            }
            throw error;
        }

        const updated = getUserById(user.id);
        sendJson(res, 200, { ok: true, user: toSafeUser(updated) }, corsHeaders);
    }

    async function handleLeaderboard(res, corsHeaders, parsedUrl) {
        const limit = clampNumber(Number.parseInt(parsedUrl.searchParams.get('limit') || '100', 10), 1, 100);
        const top = dbAll(
            `
            SELECT id, pseudo, avatar_url, country_code, level, elo, games_played, wins_total, losses_total
            FROM users
            WHERE games_played > 0
            ORDER BY elo DESC, wins_total DESC
            LIMIT ?
            `,
            [limit]
        );
        const leaderboard = top.map((row) => ({
            id: Number(row.id),
            pseudo: String(row.pseudo || ''),
            avatarUrl: String(row.avatar_url || ''),
            country: String(row.country_code || ''),
            level: Number(row.level || 1),
            elo: Number(row.elo || 1200),
            gamesCount: Number(row.games_played || 0),
            wins: Number(row.wins_total || 0),
            losses: Number(row.losses_total || 0),
            winRate: winRatePercent(Number(row.wins_total || 0), Number(row.games_played || 0))
        }));
        sendJson(res, 200, { ok: true, leaderboard }, corsHeaders);
    }

    async function handleAdminUpdateRole(req, res, corsHeaders, userId) {
        const requester = requireUser(req);
        if (!requester) {
            throw createHttpError(401, 'Session invalide.');
        }
        if (requester.role !== 'admin') {
            throw createHttpError(403, 'Action reservee aux admins.');
        }

        const body = await readJsonBody(req);
        const role = sanitizeRole(body.role);
        if (!ROLE_SET.has(role)) {
            throw createHttpError(400, 'Role invalide.');
        }

        dbRun('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', [role, nowMs(), userId]);
        const updated = getUserById(userId);
        if (!updated) {
            throw createHttpError(404, 'Utilisateur introuvable.');
        }
        sendJson(res, 200, { ok: true, user: toSafeUser(updated) }, corsHeaders);
    }

    function handleEventsList(res, corsHeaders, parsedUrl) {
        const statusFilter = String(parsedUrl.searchParams.get('status') || '').trim().toLowerCase();
        const max = clampNumber(Number.parseInt(parsedUrl.searchParams.get('limit') || '20', 10), 1, 100);
        let rows;
        if (statusFilter) {
            rows = dbAll(
                `
                SELECT e.id, e.code, e.name, e.description, e.mode, e.status, e.max_players, e.created_by, e.winner_user_id,
                       e.starts_at, e.created_at, e.updated_at,
                       owner.pseudo AS owner_pseudo,
                       winner.pseudo AS winner_pseudo
                FROM events e
                JOIN users owner ON owner.id = e.created_by
                LEFT JOIN users winner ON winner.id = e.winner_user_id
                WHERE e.status = ?
                ORDER BY e.created_at DESC
                LIMIT ?
                `,
                [statusFilter, max]
            );
        } else {
            rows = dbAll(
                `
                SELECT e.id, e.code, e.name, e.description, e.mode, e.status, e.max_players, e.created_by, e.winner_user_id,
                       e.starts_at, e.created_at, e.updated_at,
                       owner.pseudo AS owner_pseudo,
                       winner.pseudo AS winner_pseudo
                FROM events e
                JOIN users owner ON owner.id = e.created_by
                LEFT JOIN users winner ON winner.id = e.winner_user_id
                ORDER BY e.created_at DESC
                LIMIT ?
                `,
                [max]
            );
        }

        const events = rows.map((row) => toEventPayload(row, { includeMatches: false }));
        sendJson(res, 200, { ok: true, events }, corsHeaders);
    }

    async function handleEventsCreate(req, res, corsHeaders) {
        const user = requireUser(req);
        if (!user) {
            throw createHttpError(401, 'Authentification requise.');
        }

        const body = await readJsonBody(req);
        const name = sanitizeEventName(body.name);
        const description = sanitizeEventDescription(body.description);
        const mode = sanitizeEventMode(body.mode);
        const maxEventPlayers = normalizeCompetitionMaxPlayers(body.maxPlayers || body.max_players);

        if (!name || name.length < 3) {
            throw createHttpError(400, 'Nom evenement invalide.');
        }

        const event = dbWithTransaction(() => {
            const now = nowMs();
            const code = generateEventCode();
            dbRun(
                `
                INSERT INTO events (code, name, description, mode, status, max_players, created_by, starts_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'lobby', ?, ?, NULL, ?, ?)
                `,
                [code, name, description, mode, maxEventPlayers, user.id, now, now]
            );
            const eventRow = requireEventByCodeOrThrow(code);
            upsertEventPlayer(eventRow.id, user, true);
            return eventRow;
        });

        sendJson(res, 201, { ok: true, event: toEventPayload(event) }, corsHeaders);
    }

    function handleEventDetail(res, corsHeaders, code) {
        const event = requireEventByCodeOrThrow(code);
        sendJson(res, 200, { ok: true, event: toEventPayload(event) }, corsHeaders);
    }

    async function handleEventJoin(req, res, corsHeaders, code) {
        const user = requireUser(req);
        if (!user) {
            throw createHttpError(401, 'Authentification requise.');
        }

        const event = requireEventByCodeOrThrow(code);
        if (String(event.status) !== 'lobby') {
            throw createHttpError(409, 'Le salon est deja lance.');
        }

        const alreadyJoined = dbGet(
            'SELECT 1 FROM event_players WHERE event_id = ? AND user_id = ? LIMIT 1',
            [event.id, user.id]
        );
        if (!alreadyJoined && !hasAvailableSeats(event)) {
            throw createHttpError(409, 'Salon complet.');
        }

        upsertEventPlayer(event.id, user, false);
        const updated = requireEventByCodeOrThrow(code);
        sendJson(res, 200, { ok: true, event: toEventPayload(updated) }, corsHeaders);
    }

    async function handleEventLeave(req, res, corsHeaders, code) {
        const user = requireUser(req);
        if (!user) {
            throw createHttpError(401, 'Authentification requise.');
        }

        const event = requireEventByCodeOrThrow(code);
        if (String(event.status) !== 'lobby') {
            throw createHttpError(409, 'Impossible de quitter: partie deja lancee.');
        }
        if (userIsEventHost(event.id, user.id)) {
            throw createHttpError(409, 'L hote ne peut pas quitter. Supprimez puis recreez le salon.');
        }

        dbRun('DELETE FROM event_players WHERE event_id = ? AND user_id = ?', [event.id, user.id]);
        const updated = requireEventByCodeOrThrow(code);
        sendJson(res, 200, { ok: true, event: toEventPayload(updated) }, corsHeaders);
    }

    async function handleEventStart(req, res, corsHeaders, code) {
        const user = requireUser(req);
        if (!user) {
            throw createHttpError(401, 'Authentification requise.');
        }

        const event = requireEventByCodeOrThrow(code);
        if (!userIsEventHost(event.id, user.id)) {
            throw createHttpError(403, 'Seul l hote peut lancer la competition.');
        }
        if (String(event.status) !== 'lobby') {
            throw createHttpError(409, 'Competition deja lancee.');
        }

        const entrants = getEventPlayers(event.id).map((player) => player.userId);
        if (entrants.length < 2) {
            throw createHttpError(409, 'Au moins 2 joueurs sont requis.');
        }

        dbWithTransaction(() => {
            createRoundMatches(event.id, 1, shuffleArray(entrants));
            dbRun('UPDATE events SET status = ?, starts_at = ?, updated_at = ? WHERE id = ?', [
                'started',
                nowMs(),
                nowMs(),
                event.id
            ]);
            ensureCompetitionProgress(event.id);
        });

        const updated = requireEventByCodeOrThrow(code);
        sendJson(res, 200, { ok: true, event: toEventPayload(updated) }, corsHeaders);
    }

    async function handleEventDelete(req, res, corsHeaders, code) {
        const user = requireUser(req);
        if (!user) {
            throw createHttpError(401, 'Authentification requise.');
        }

        const event = requireEventByCodeOrThrow(code);
        if (!userIsEventHost(event.id, user.id)) {
            throw createHttpError(403, 'Seul l hote peut supprimer la competition.');
        }
        if (String(event.status) === 'started') {
            throw createHttpError(409, 'Impossible de supprimer une competition en cours.');
        }

        dbWithTransaction(() => {
            dbRun('DELETE FROM matches WHERE event_id = ?', [event.id]);
            dbRun('DELETE FROM event_players WHERE event_id = ?', [event.id]);
            dbRun('DELETE FROM events WHERE id = ?', [event.id]);
        });

        sendJson(res, 200, { ok: true, message: 'Competition supprimee avec succes.' }, corsHeaders);
    }

    async function handleMatchResult(req, res, corsHeaders, code, matchId) {
        const user = requireUser(req);
        if (!user) {
            throw createHttpError(401, 'Authentification requise.');
        }

        const event = requireEventByCodeOrThrow(code);
        if (!userIsEventHost(event.id, user.id)) {
            throw createHttpError(403, 'Seul l hote peut valider un resultat.');
        }
        if (String(event.status) !== 'started') {
            throw createHttpError(409, 'Competition non active.');
        }

        const body = await readJsonBody(req);
        const winnerUserId = Number.parseInt(body.winnerUserId, 10);
        const scoreA = clampNumber(Number.parseInt(body.scoreA || '0', 10), 0, 999);
        const scoreB = clampNumber(Number.parseInt(body.scoreB || '0', 10), 0, 999);
        if (!Number.isFinite(winnerUserId)) {
            throw createHttpError(400, 'winnerUserId est requis.');
        }

        dbWithTransaction(() => {
            const match = dbGet(
                `
                SELECT id, player_a_user_id, player_b_user_id, status
                FROM matches
                WHERE id = ? AND event_id = ?
                LIMIT 1
                `,
                [matchId, event.id]
            );
            if (!match) {
                throw createHttpError(404, 'Match introuvable.');
            }
            if (String(match.status) !== 'pending') {
                throw createHttpError(409, 'Ce match est deja valide.');
            }

            const playerA = match.player_a_user_id == null ? null : Number(match.player_a_user_id);
            const playerB = match.player_b_user_id == null ? null : Number(match.player_b_user_id);
            if (winnerUserId !== playerA && winnerUserId !== playerB) {
                throw createHttpError(400, 'Le gagnant doit etre dans le match.');
            }
            const loserUserId = winnerUserId === playerA ? playerB : playerA;

            dbRun(
                `
                UPDATE matches
                SET winner_user_id = ?, status = 'completed', score_a = ?, score_b = ?, updated_at = ?
                WHERE id = ?
                `,
                [winnerUserId, scoreA, scoreB, nowMs(), match.id]
            );

            addPlayerStats(event.id, winnerUserId, { wins: 1, points: 3 });
            if (loserUserId != null) {
                addPlayerStats(event.id, loserUserId, { losses: 0 });
                applyGlobalMatchResult(winnerUserId, loserUserId);
            }

            ensureCompetitionProgress(event.id);
        });

        const updated = requireEventByCodeOrThrow(code);
        sendJson(res, 200, { ok: true, event: toEventPayload(updated) }, corsHeaders);
    }

    // ========== MATCHMAKING ==========

    function findMatchmakingOpponent(userId, userElo, mode) {
        const ELO_RANGE = 100; // ±100 points
        const MAX_WAIT_TIME = 60000; // 60 secondes
        const now = nowMs();
        
        let bestMatch = null;
        let bestEloDiff = Infinity;
        
        for (const [opponentId, data] of matchmakingQueue.entries()) {
            if (opponentId === userId) continue;
            if (data.mode !== mode) continue;
            
            const eloDiff = Math.abs(data.elo - userElo);
            const waitTime = now - data.joinedAt;
            
            // Élargir la plage ELO après 30 secondes
            const adjustedRange = waitTime > 30000 ? ELO_RANGE * 2 : ELO_RANGE;
            
            if (eloDiff <= adjustedRange && eloDiff < bestEloDiff) {
                bestMatch = data;
                bestEloDiff = eloDiff;
            }
        }
        
        return bestMatch;
    }

    function getQueuePosition(userId) {
        const entries = Array.from(matchmakingQueue.entries());
        entries.sort((a, b) => a[1].joinedAt - b[1].joinedAt);
        const index = entries.findIndex(([id]) => id === userId);
        return index >= 0 ? index + 1 : 0;
    }

    function estimateWaitTime(elo, mode) {
        // Estimation basique : 30 secondes par défaut
        const queueSize = Array.from(matchmakingQueue.values()).filter(d => d.mode === mode).length;
        return Math.max(10000, 30000 - (queueSize * 5000));
    }

    function createMatchmakingEvent(code, user1, user2, mode) {
        const now = nowMs();
        const eventName = `Match Classé: ${user1.pseudo} vs ${user2.pseudo}`;
        
        dbRun(
            `INSERT INTO events (code, name, description, mode, status, max_players, created_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [code, eventName, 'Match classé automatique', mode, 'open', 2, user1.id, now, now]
        );
        
        const event = dbGet('SELECT id FROM events WHERE code = ? LIMIT 1', [code]);
        const eventId = Number(event.id);
        
        // Ajouter les deux joueurs
        dbRun(
            `INSERT INTO event_players (event_id, user_id, display_name, is_host, joined_at)
             VALUES (?, ?, ?, ?, ?)`,
            [eventId, user1.id, user1.pseudo, 1, now]
        );
        
        dbRun(
            `INSERT INTO event_players (event_id, user_id, display_name, is_host, joined_at)
             VALUES (?, ?, ?, ?, ?)`,
            [eventId, user2.userId, user2.pseudo, 0, now]
        );
        
        return eventId;
    }

    async function handleMatchmakingJoin(req, res, corsHeaders) {
        const user = requireUser(req);
        if (!user) {
            throw createHttpError(401, 'Authentification requise.');
        }

        const body = await readJsonBody(req);
        const mode = sanitizeEventMode(body.mode);
        
        // Vérifier si déjà en file
        if (matchmakingQueue.has(user.id)) {
            throw createHttpError(409, 'Vous etes deja en recherche de match.');
        }
        
        // Ajouter à la file
        matchmakingQueue.set(user.id, {
            userId: user.id,
            pseudo: user.pseudo,
            elo: user.elo,
            mode,
            joinedAt: nowMs()
        });

        // Chercher un adversaire
        const opponent = findMatchmakingOpponent(user.id, user.elo, mode);
        
        if (opponent) {
            // Match trouvé!
            const eventCode = generateEventCode();
            const eventId = createMatchmakingEvent(eventCode, user, opponent, mode);
            
            // Stocker le match pour les deux joueurs
            matchmakingMatches.set(user.id, { eventCode, opponentId: opponent.userId });
            matchmakingMatches.set(opponent.userId, { eventCode, opponentId: user.id });
            
            // Retirer de la file
            matchmakingQueue.delete(user.id);
            matchmakingQueue.delete(opponent.userId);
            
            sendJson(res, 200, {
                ok: true,
                matched: true,
                eventCode,
                eventId,
                opponent: {
                    pseudo: opponent.pseudo,
                    elo: opponent.elo
                }
            }, corsHeaders);
        } else {
            sendJson(res, 200, {
                ok: true,
                matched: false,
                queuePosition: getQueuePosition(user.id),
                estimatedWaitTime: estimateWaitTime(user.elo, mode)
            }, corsHeaders);
        }
    }

    async function handleMatchmakingCancel(req, res, corsHeaders) {
        const user = requireUser(req);
        if (!user) {
            throw createHttpError(401, 'Authentification requise.');
        }
        
        matchmakingQueue.delete(user.id);
        
        sendJson(res, 200, { ok: true }, corsHeaders);
    }

    async function handleMatchmakingStatus(req, res, corsHeaders) {
        const user = requireUser(req);
        if (!user) {
            throw createHttpError(401, 'Authentification requise.');
        }
        
        // Vérifier si un match a été trouvé
        const match = matchmakingMatches.get(user.id);
        if (match) {
            matchmakingMatches.delete(user.id);
            const opponent = dbGet('SELECT pseudo, elo FROM users WHERE id = ? LIMIT 1', [match.opponentId]);
            sendJson(res, 200, {
                ok: true,
                inQueue: false,
                matched: true,
                eventCode: match.eventCode,
                opponent: {
                    pseudo: opponent?.pseudo || 'Adversaire',
                    elo: opponent?.elo || 1200
                }
            }, corsHeaders);
            return;
        }
        
        const data = matchmakingQueue.get(user.id);
        
        if (!data) {
            sendJson(res, 200, {
                ok: true,
                inQueue: false,
                matched: false
            }, corsHeaders);
            return;
        }
        
        sendJson(res, 200, {
            ok: true,
            inQueue: true,
            matched: false,
            queuePosition: getQueuePosition(user.id),
            waitTime: nowMs() - data.joinedAt,
            estimatedWaitTime: estimateWaitTime(user.elo, data.mode)
        }, corsHeaders);
    }

    // ========== CHAT ==========

    async function handleChatMessages(req, res, corsHeaders, code) {

        const user = requireUser(req);
        if (!user) {
            throw createHttpError(401, 'Authentification requise.');
        }

        const event = requireEventByCodeOrThrow(code);
        const isParticipant = dbGet(
            'SELECT 1 FROM event_players WHERE event_id = ? AND user_id = ? LIMIT 1',
            [event.id, user.id]
        );
        if (!isParticipant) {
            throw createHttpError(403, 'Vous devez rejoindre le salon pour voir les messages.');
        }

        const messages = dbAll(
            `
            SELECT id, user_id, pseudo, message, created_at
            FROM salon_messages
            WHERE event_code = ?
            ORDER BY created_at DESC
            LIMIT 50
            `,
            [code]
        );

        sendJson(res, 200, { ok: true, messages: messages.reverse() }, corsHeaders);
    }

    async function handleChatSend(req, res, corsHeaders, code) {
        const user = requireUser(req);
        if (!user) {
            throw createHttpError(401, 'Authentification requise.');
        }

        const event = requireEventByCodeOrThrow(code);
        const isParticipant = dbGet(
            'SELECT 1 FROM event_players WHERE event_id = ? AND user_id = ? LIMIT 1',
            [event.id, user.id]
        );
        if (!isParticipant) {
            throw createHttpError(403, 'Vous devez rejoindre le salon pour envoyer des messages.');
        }

        const body = await readJsonBody(req);
        const message = String(body.message || '').trim();
        if (!message || message.length === 0) {
            throw createHttpError(400, 'Message vide.');
        }
        if (message.length > 200) {
            throw createHttpError(400, 'Message trop long (max 200 caracteres).');
        }

        // Filtre basique de mots interdits
        const bannedWords = ['connard', 'salaud', 'merde', 'putain', 'con'];
        const lowerMessage = message.toLowerCase();
        for (const word of bannedWords) {
            if (lowerMessage.includes(word)) {
                throw createHttpError(400, 'Message contient des mots interdits.');
            }
        }

        dbRun(
            `
            INSERT INTO salon_messages (event_code, user_id, pseudo, message, created_at)
            VALUES (?, ?, ?, ?, ?)
            `,
            [code, user.id, user.pseudo, message, nowMs()]
        );

        sendJson(res, 200, { ok: true }, corsHeaders);
    }

    async function routeApi(req, res, corsHeaders, parsedUrl) {
        const method = String(req.method || 'GET').toUpperCase();
        const pathName = parsedUrl.pathname;
        const userIp = getClientIp(req);

        if (pathName === '/api/health' && method === 'GET') {
            const roomStats = getRoomsStats();
            sendJson(
                res,
                200,
                {
                    ok: true,
                    rooms: roomStats.rooms,
                    clients: roomStats.clients,
                    maxPlayers
                },
                corsHeaders
            );
            return;
        }

        if (pathName === '/api/auth/register' && method === 'POST') {
            await handleAuthRegister(req, res, corsHeaders, userIp);
            return;
        }
        if (pathName === '/api/auth/login' && method === 'POST') {
            await handleAuthLogin(req, res, corsHeaders, userIp);
            return;
        }
        if (pathName === '/api/auth/oauth/mobile' && method === 'POST') {
            await handleAuthOAuthMobile(req, res, corsHeaders, userIp);
            return;
        }
        if (pathName === '/api/auth/me' && method === 'GET') {
            handleAuthMe(req, res, corsHeaders);
            return;
        }
        if (pathName === '/api/auth/logout' && method === 'POST') {
            await handleAuthLogout(req, res, corsHeaders);
            return;
        }

        if (pathName === '/api/profile/me' && method === 'GET') {
            await handleProfileMe(req, res, corsHeaders, parsedUrl);
            return;
        }
        if (pathName === '/api/profile/me' && method === 'POST') {
            await handleProfileUpdate(req, res, corsHeaders);
            return;
        }

        if (pathName === '/api/leaderboard' && method === 'GET') {
            await handleLeaderboard(res, corsHeaders, parsedUrl);
            return;
        }

        const adminRoleRoute = pathName.match(/^\/api\/admin\/users\/([0-9]+)\/role$/i);
        if (adminRoleRoute && method === 'POST') {
            await handleAdminUpdateRole(req, res, corsHeaders, Number.parseInt(adminRoleRoute[1], 10));
            return;
        }

        if (pathName === '/api/events' && method === 'GET') {
            handleEventsList(res, corsHeaders, parsedUrl);
            return;
        }
        if (pathName === '/api/events' && method === 'POST') {
            await handleEventsCreate(req, res, corsHeaders);
            return;
        }

        const matchResultRoute = pathName.match(/^\/api\/events\/([a-z0-9]{4,10})\/matches\/([0-9]+)\/result$/i);
        if (matchResultRoute && method === 'POST') {
            await handleMatchResult(req, res, corsHeaders, matchResultRoute[1], Number.parseInt(matchResultRoute[2], 10));
            return;
        }

        const messagesRoute = pathName.match(/^\/api\/events\/([a-z0-9]{4,10})\/messages$/i);
        if (messagesRoute) {
            const code = messagesRoute[1];
            if (method === 'GET') {
                await handleChatMessages(req, res, corsHeaders, code);
                return;
            }
            if (method === 'POST') {
                await handleChatSend(req, res, corsHeaders, code);
                return;
            }
        }

        if (pathName === '/api/matchmaking/join' && method === 'POST') {
            await handleMatchmakingJoin(req, res, corsHeaders);
            return;
        }
        if (pathName === '/api/matchmaking/cancel' && method === 'POST') {
            await handleMatchmakingCancel(req, res, corsHeaders);
            return;
        }
        if (pathName === '/api/matchmaking/status' && method === 'GET') {
            await handleMatchmakingStatus(req, res, corsHeaders);
            return;
        }

        const actionRoute = pathName.match(/^\/api\/events\/([a-z0-9]{4,10})(?:\/([a-z-]+))?$/i);
        if (actionRoute) {
            const code = actionRoute[1];
            const action = actionRoute[2] || '';
            if (!action && method === 'GET') {
                handleEventDetail(res, corsHeaders, code);
                return;
            }
            if (!action && method === 'DELETE') {
                await handleEventDelete(req, res, corsHeaders, code);
                return;
            }
            if (action === 'join' && method === 'POST') {
                await handleEventJoin(req, res, corsHeaders, code);
                return;
            }
            if (action === 'leave' && method === 'POST') {
                await handleEventLeave(req, res, corsHeaders, code);
                return;
            }
            if (action === 'start' && method === 'POST') {
                await handleEventStart(req, res, corsHeaders, code);
                return;
            }
        }

        throw createHttpError(404, 'Route API introuvable.');
    }

    async function handleHttp(req, res) {
        const parsedUrl = new URL(req.url || '/', 'http://localhost');
        const pathName = parsedUrl.pathname;
        if (!pathName.startsWith('/api/')) {
            return false;
        }

        const method = String(req.method || 'GET').toUpperCase();
        const corsHeaders = buildCorsHeaders(req.headers.origin);

        if (corsHeaders == null) {
            sendJson(res, 403, { ok: false, error: 'Origin non autorisee.' });
            return true;
        }
        if (method === 'OPTIONS') {
            res.writeHead(204, corsHeaders);
            res.end();
            return true;
        }

        try {
            await routeApi(req, res, corsHeaders || {}, parsedUrl);
        } catch (error) {
            const statusCode = clampNumber(Number.parseInt(error.status || '500', 10), 400, 599);
            const message = (statusCode >= 500 && statusCode !== 501)
                ? 'Erreur serveur.'
                : String(error.message || 'Requete invalide.');
            apiError(res, statusCode, message, corsHeaders || {});
        }
        return true;
    }

    function getDbPath() {
        return dbPath;
    }

    function onTick() {
        pruneExpiredSessions();
        pruneAuthRate();
    }

    return {
        getDbPath,
        handleHttp,
        onTick
    };
}

function initDatabase(dbPath) {
    if (!DatabaseSync) {
        ({ DatabaseSync } = require('node:sqlite'));
    }
    const directory = path.dirname(dbPath);
    fs.mkdirSync(directory, { recursive: true });

    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            last_seen_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            mode TEXT NOT NULL DEFAULT 'classic',
            status TEXT NOT NULL DEFAULT 'lobby',
            max_players INTEGER NOT NULL,
            created_by INTEGER NOT NULL REFERENCES users(id),
            winner_user_id INTEGER REFERENCES users(id),
            starts_at INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS event_players (
            event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            display_name TEXT NOT NULL,
            is_host INTEGER NOT NULL DEFAULT 0,
            joined_at INTEGER NOT NULL,
            wins INTEGER NOT NULL DEFAULT 0,
            losses INTEGER NOT NULL DEFAULT 0,
            points INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (event_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS matches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
            round_number INTEGER NOT NULL,
            slot_index INTEGER NOT NULL,
            player_a_user_id INTEGER REFERENCES users(id),
            player_b_user_id INTEGER REFERENCES users(id),
            winner_user_id INTEGER REFERENCES users(id),
            status TEXT NOT NULL DEFAULT 'pending',
            score_a INTEGER NOT NULL DEFAULT 0,
            score_b INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS salon_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_code TEXT NOT NULL,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            pseudo TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
        CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
        CREATE INDEX IF NOT EXISTS idx_event_players_event_id ON event_players(event_id);
        CREATE INDEX IF NOT EXISTS idx_matches_event_round ON matches(event_id, round_number, slot_index);
        CREATE INDEX IF NOT EXISTS idx_salon_messages_event ON salon_messages(event_code, created_at DESC);
    `);

    ensureSqliteColumn(db, 'users', 'avatar_url', "TEXT NOT NULL DEFAULT ''");
    ensureSqliteColumn(db, 'users', 'country_code', "TEXT NOT NULL DEFAULT ''");
    ensureSqliteColumn(db, 'users', 'level', 'INTEGER NOT NULL DEFAULT 1');
    ensureSqliteColumn(db, 'users', 'elo', 'INTEGER NOT NULL DEFAULT 1200');
    ensureSqliteColumn(db, 'users', 'games_played', 'INTEGER NOT NULL DEFAULT 0');
    ensureSqliteColumn(db, 'users', 'wins_total', 'INTEGER NOT NULL DEFAULT 0');
    ensureSqliteColumn(db, 'users', 'losses_total', 'INTEGER NOT NULL DEFAULT 0');
    ensureSqliteColumn(db, 'users', 'auth_provider', "TEXT NOT NULL DEFAULT 'password'");
    ensureSqliteColumn(db, 'users', 'auth_provider_user_id', 'TEXT');
    db.exec('CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider, auth_provider_user_id);');
    return db;
}

function ensureSqliteColumn(db, tableName, columnName, definition) {
    const cols = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const hasColumn = cols.some((col) => String(col.name || '').toLowerCase() === String(columnName).toLowerCase());
    if (!hasColumn) {
        db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
}

module.exports = {
    createCompetitionApi
};
