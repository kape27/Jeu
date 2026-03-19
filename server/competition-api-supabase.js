const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const EVENT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROLE_SET = new Set(['player', 'organizer', 'admin']);
const OAUTH_PROVIDERS = new Set(['google', 'apple']);

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

function normalizeRelation(value) {
    if (Array.isArray(value)) return value[0] || null;
    return value || null;
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

function sanitizeRole(raw) {
    const role = String(raw || '').trim().toLowerCase();
    if (ROLE_SET.has(role)) return role;
    return 'player';
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

function createCompetitionApiSupabase(options) {
    const isOriginAllowed = options.isOriginAllowed;
    const getRoomsStats = options.getRoomsStats;
    const maxPlayers = clampNumber(Number(options.maxPlayers) || 4, 2, 16);

    const supabaseUrl = String(options.supabaseUrl || process.env.SUPABASE_URL || '').trim();
    const supabaseServiceRoleKey = String(options.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!supabaseUrl || !supabaseServiceRoleKey) {
        throw new Error('Supabase configuration missing: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    }

    const authRateLimitMax = clampNumber(Number(options.authRateLimitMax) || 25, 5, 300);
    const sessionTtlMs = clampNumber(
        Number(options.sessionTtlMs) || (7 * 24 * 60 * 60 * 1000),
        60 * 60 * 1000,
        90 * 24 * 60 * 60 * 1000
    );
    const rateWindowMs = clampNumber(Number(options.rateWindowMs) || 60000, 1000, 10 * 60 * 1000);

    const authRateByIp = new Map();
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    function sanitizeEmail(raw) {
        return String(raw || '').trim().toLowerCase();
    }

    function sanitizePseudo(raw) {
        return String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    }

    function sanitizeEventName(raw) {
        return String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 64);
    }

    function sanitizeEventDescription(raw) {
        return String(raw || '').trim().slice(0, 280);
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
            if (left.length === 0 || right.length === 0 || left.length !== right.length) return false;
            return crypto.timingSafeEqual(left, right);
        } catch (_error) {
            return false;
        }
    }

    function isUniqueViolation(error) {
        if (!error) return false;
        if (String(error.code || '') === '23505') return true;
        const text = String(error.message || '').toLowerCase();
        return text.includes('unique') || text.includes('constraint');
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

    function getBearerToken(req) {
        const raw = String(req?.headers?.authorization || '').trim();
        if (!raw) return '';
        const match = raw.match(/^Bearer\s+(.+)$/i);
        if (!match) return '';
        return match[1].trim();
    }

    function buildCorsHeaders(originHeader) {
        const rawOrigin = String(originHeader || '').trim();
        if (!rawOrigin) return {};
        if (!isOriginAllowed(rawOrigin)) return null;
        return {
            'Access-Control-Allow-Origin': rawOrigin,
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
            createdAt: Number(userRow.created_at || nowMs())
        };
    }

    async function getUserById(userId) {
        const { data, error } = await supabase
            .from('users')
            .select('id, email, pseudo, role, avatar_url, country_code, level, elo, games_played, wins_total, losses_total, auth_provider, created_at')
            .eq('id', userId)
            .maybeSingle();
        if (error) throw error;
        return data || null;
    }

    async function getUserByEmail(email) {
        const { data, error } = await supabase
            .from('users')
            .select('id, email, pseudo, role, avatar_url, country_code, level, elo, games_played, wins_total, losses_total, auth_provider, auth_provider_user_id, created_at')
            .eq('email', email)
            .maybeSingle();
        if (error) throw error;
        return data || null;
    }

    async function getUserByOAuthProvider(provider, providerUserId) {
        const { data, error } = await supabase
            .from('users')
            .select('id, email, pseudo, role, avatar_url, country_code, level, elo, games_played, wins_total, losses_total, auth_provider, auth_provider_user_id, created_at')
            .eq('auth_provider', provider)
            .eq('auth_provider_user_id', providerUserId)
            .maybeSingle();
        if (error) throw error;
        return data || null;
    }

    async function ensureUniquePseudo(initialPseudo) {
        const base = sanitizePseudo(initialPseudo) || `joueur${crypto.randomInt(1000, 9999)}`;
        let candidate = base;
        for (let attempt = 0; attempt < 50; attempt += 1) {
            const { data, error } = await supabase
                .from('users')
                .select('id')
                .eq('pseudo', candidate)
                .maybeSingle();
            if (error) throw error;
            if (!data) return candidate;
            candidate = `${base.slice(0, 18)}${crypto.randomInt(10, 99)}`;
        }
        return `${base.slice(0, 16)}${Date.now().toString().slice(-4)}`;
    }

    async function getUserMatchHistory(userId, limitRaw = 20) {
        const limit = clampNumber(Number.parseInt(limitRaw, 10), 1, 100);
        const { data, error } = await supabase
            .from('matches')
            .select('id, event_id, round_number, slot_index, player_a_user_id, player_b_user_id, winner_user_id, score_a, score_b, updated_at')
            .or(`player_a_user_id.eq.${userId},player_b_user_id.eq.${userId}`)
            .eq('status', 'completed')
            .order('updated_at', { ascending: false })
            .limit(limit);
        if (error) throw error;

        const rows = data || [];
        const eventIds = Array.from(new Set(rows.map((row) => Number(row.event_id)).filter(Boolean)));
        const userIds = Array.from(new Set(
            rows.flatMap((row) => [row.player_a_user_id, row.player_b_user_id, row.winner_user_id])
                .map((value) => (value == null ? null : Number(value)))
                .filter((value) => value != null)
        ));

        const eventsMap = new Map();
        if (eventIds.length > 0) {
            const { data: eventRows, error: eventsError } = await supabase
                .from('events')
                .select('id, name, code')
                .in('id', eventIds);
            if (eventsError) throw eventsError;
            for (const eventRow of (eventRows || [])) {
                eventsMap.set(Number(eventRow.id), eventRow);
            }
        }

        const usersMap = new Map();
        if (userIds.length > 0) {
            const { data: userRows, error: usersError } = await supabase
                .from('users')
                .select('id, pseudo')
                .in('id', userIds);
            if (usersError) throw usersError;
            for (const userRow of (userRows || [])) {
                usersMap.set(Number(userRow.id), String(userRow.pseudo || 'Joueur'));
            }
        }

        return rows.map((row) => {
            const playerA = row.player_a_user_id == null ? null : Number(row.player_a_user_id);
            const playerB = row.player_b_user_id == null ? null : Number(row.player_b_user_id);
            const winnerId = row.winner_user_id == null ? null : Number(row.winner_user_id);
            const meIsA = playerA === Number(userId);
            const meIsB = playerB === Number(userId);
            const opponentId = meIsA ? playerB : (meIsB ? playerA : null);
            const event = eventsMap.get(Number(row.event_id));
            return {
                matchId: Number(row.id),
                eventId: Number(row.event_id),
                eventCode: String(event?.code || ''),
                eventName: String(event?.name || 'Evenement'),
                round: Number(row.round_number || 0),
                slot: Number(row.slot_index || 0),
                playedAt: Number(row.updated_at || 0),
                opponentUserId: opponentId,
                opponentPseudo: opponentId == null ? 'BYE' : (usersMap.get(opponentId) || `Joueur #${opponentId}`),
                result: winnerId === Number(userId) ? 'win' : 'loss',
                scoreA: Number(row.score_a || 0),
                scoreB: Number(row.score_b || 0),
                winnerUserId: winnerId
            };
        });
    }


    async function issueSessionToken(userId) {
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(token);
        const now = nowMs();
        const { error } = await supabase
            .from('sessions')
            .insert({
                token_hash: tokenHash,
                user_id: userId,
                created_at: now,
                expires_at: now + sessionTtlMs,
                last_seen_at: now
            });
        if (error) throw error;
        return token;
    }

    async function purgeExpiredSessions() {
        const { error } = await supabase
            .from('sessions')
            .delete()
            .lte('expires_at', nowMs());
        if (error) throw error;
    }

    async function requireUser(req) {
        const token = getBearerToken(req);
        if (!token) return null;

        const tokenHash = hashToken(token);
        const now = nowMs();
        const { data, error } = await supabase
            .from('sessions')
            .select('token_hash, user_id, expires_at, user:users!sessions_user_id_fkey(id, email, pseudo, role, avatar_url, country_code, level, elo, games_played, wins_total, losses_total, auth_provider, created_at)')
            .eq('token_hash', tokenHash)
            .maybeSingle();
        if (error) throw error;
        if (!data) return null;
        if (Number(data.expires_at) <= now) {
            await supabase.from('sessions').delete().eq('token_hash', tokenHash);
            return null;
        }

        await supabase
            .from('sessions')
            .update({ last_seen_at: now })
            .eq('token_hash', tokenHash);

        const user = normalizeRelation(data.user);
        if (!user) return null;
        return toSafeUser(user);
    }

    async function generateEventCode() {
        for (let attempt = 0; attempt < 40; attempt += 1) {
            let code = '';
            for (let i = 0; i < 6; i += 1) {
                code += EVENT_CODE_ALPHABET[crypto.randomInt(0, EVENT_CODE_ALPHABET.length)];
            }
            const { data, error } = await supabase
                .from('events')
                .select('id')
                .eq('code', code)
                .maybeSingle();
            if (error) throw error;
            if (!data) return code;
        }
        throw createHttpError(500, 'Generation de code evenement impossible.');
    }

    function normalizeEventRow(row) {
        const owner = normalizeRelation(row.owner);
        const winner = normalizeRelation(row.winner);
        return {
            ...row,
            owner_pseudo: String(owner?.pseudo || ''),
            winner_pseudo: winner?.pseudo ? String(winner.pseudo) : null
        };
    }

    async function getEventByCode(code) {
        const { data, error } = await supabase
            .from('events')
            .select(`
                id, code, name, description, mode, status, max_players, created_by, winner_user_id,
                starts_at, created_at, updated_at,
                owner:users!events_created_by_fkey(pseudo),
                winner:users!events_winner_user_id_fkey(pseudo)
            `)
            .eq('code', String(code || '').toUpperCase())
            .maybeSingle();
        if (error) throw error;
        if (!data) return null;
        return normalizeEventRow(data);
    }

    async function requireEventByCodeOrThrow(code) {
        const event = await getEventByCode(code);
        if (!event) throw createHttpError(404, 'Evenement introuvable.');
        return event;
    }

    async function getEventPlayers(eventId) {
        const { data, error } = await supabase
            .from('event_players')
            .select('user_id, display_name, is_host, joined_at, wins, losses, points, user:users!event_players_user_id_fkey(pseudo)')
            .eq('event_id', eventId)
            .order('is_host', { ascending: false })
            .order('joined_at', { ascending: true });
        if (error) throw error;

        return (data || []).map((row) => ({
            userId: Number(row.user_id),
            pseudo: String(normalizeRelation(row.user)?.pseudo || ''),
            displayName: String(row.display_name || normalizeRelation(row.user)?.pseudo || ''),
            isHost: Boolean(row.is_host),
            joinedAt: Number(row.joined_at),
            wins: Number(row.wins || 0),
            losses: Number(row.losses || 0),
            points: Number(row.points || 0)
        }));
    }

    async function getEventMatches(eventId) {
        const { data, error } = await supabase
            .from('matches')
            .select('id, round_number, slot_index, player_a_user_id, player_b_user_id, winner_user_id, status, score_a, score_b')
            .eq('event_id', eventId)
            .order('round_number', { ascending: true })
            .order('slot_index', { ascending: true });
        if (error) throw error;

        return (data || []).map((row) => ({
            id: Number(row.id),
            round: Number(row.round_number),
            slot: Number(row.slot_index),
            playerAUserId: row.player_a_user_id == null ? null : Number(row.player_a_user_id),
            playerBUserId: row.player_b_user_id == null ? null : Number(row.player_b_user_id),
            winnerUserId: row.winner_user_id == null ? null : Number(row.winner_user_id),
            status: String(row.status || 'pending'),
            scoreA: Number(row.score_a || 0),
            scoreB: Number(row.score_b || 0)
        }));
    }

    async function toEventPayload(eventRow, options = {}) {
        const includeMatches = options.includeMatches !== false;
        const players = await getEventPlayers(eventRow.id);
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
            payload.matches = await getEventMatches(eventRow.id);
        }
        return payload;
    }

    async function userIsEventHost(eventId, userId) {
        const { data, error } = await supabase
            .from('event_players')
            .select('is_host')
            .eq('event_id', eventId)
            .eq('user_id', userId)
            .maybeSingle();
        if (error) throw error;
        return Boolean(data && data.is_host);
    }

    async function hasAvailableSeats(eventRow) {
        const { count, error } = await supabase
            .from('event_players')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', eventRow.id);
        if (error) throw error;
        return Number(count || 0) < Number(eventRow.max_players || 0);
    }

    async function upsertEventPlayer(eventId, user, isHost = false) {
        const now = nowMs();
        const { data: existing, error: existingError } = await supabase
            .from('event_players')
            .select('event_id, user_id, is_host')
            .eq('event_id', eventId)
            .eq('user_id', user.id)
            .maybeSingle();
        if (existingError) throw existingError;

        if (!existing) {
            const { error } = await supabase
                .from('event_players')
                .insert({
                    event_id: eventId,
                    user_id: user.id,
                    display_name: user.pseudo,
                    is_host: Boolean(isHost),
                    joined_at: now
                });
            if (error) throw error;
            return;
        }

        const { error } = await supabase
            .from('event_players')
            .update({
                display_name: user.pseudo,
                is_host: Boolean(existing.is_host || isHost)
            })
            .eq('event_id', eventId)
            .eq('user_id', user.id);
        if (error) throw error;
    }

    async function addPlayerStats(eventId, userId, delta) {
        if (!userId) return;
        const { data, error } = await supabase
            .from('event_players')
            .select('wins, losses, points')
            .eq('event_id', eventId)
            .eq('user_id', userId)
            .maybeSingle();
        if (error) throw error;
        if (!data) return;

        const { error: updateError } = await supabase
            .from('event_players')
            .update({
                wins: Number(data.wins || 0) + Number(delta.wins || 0),
                losses: Number(data.losses || 0) + Number(delta.losses || 0),
                points: Number(data.points || 0) + Number(delta.points || 0)
            })
            .eq('event_id', eventId)
            .eq('user_id', userId);
        if (updateError) throw updateError;
    }

    async function applyGlobalMatchResult(winnerUserId, loserUserId) {
        if (!winnerUserId || !loserUserId) return;

        const winner = await getUserById(winnerUserId);
        const loser = await getUserById(loserUserId);
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

        const { error: winnerError } = await supabase
            .from('users')
            .update({
                elo: winnerElo,
                level: levelFromElo(winnerElo),
                games_played: winnerGames,
                wins_total: winnerWins,
                updated_at: nowMs()
            })
            .eq('id', winnerUserId);
        if (winnerError) throw winnerError;

        const { error: loserError } = await supabase
            .from('users')
            .update({
                elo: loserElo,
                level: levelFromElo(loserElo),
                games_played: loserGames,
                losses_total: loserLosses,
                updated_at: nowMs()
            })
            .eq('id', loserUserId);
        if (loserError) throw loserError;
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

    async function createRoundMatches(eventId, roundNumber, playerIds) {
        let participants = [...playerIds];
        if (participants.length % 2 !== 0) {
            participants.push(null);
        }

        const now = nowMs();
        const batch = [];
        let slotIndex = 1;
        for (let i = 0; i < participants.length; i += 2) {
            const playerA = participants[i];
            const playerB = participants[i + 1];
            if (playerA != null && playerB != null) {
                batch.push({
                    event_id: eventId,
                    round_number: roundNumber,
                    slot_index: slotIndex,
                    player_a_user_id: playerA,
                    player_b_user_id: playerB,
                    winner_user_id: null,
                    status: 'pending',
                    score_a: 0,
                    score_b: 0,
                    created_at: now,
                    updated_at: now
                });
            } else {
                const winnerUserId = playerA == null ? playerB : playerA;
                batch.push({
                    event_id: eventId,
                    round_number: roundNumber,
                    slot_index: slotIndex,
                    player_a_user_id: playerA,
                    player_b_user_id: playerB,
                    winner_user_id: winnerUserId,
                    status: 'completed',
                    score_a: 0,
                    score_b: 0,
                    created_at: now,
                    updated_at: now
                });
                if (winnerUserId != null) {
                    await addPlayerStats(eventId, winnerUserId, { wins: 1, points: 1 });
                }
            }
            slotIndex += 1;
        }

        if (batch.length > 0) {
            const { error } = await supabase.from('matches').insert(batch);
            if (error) throw error;
        }
    }

    async function ensureCompetitionProgress(eventId) {
        while (true) {
            const { data: eventRow, error: eventError } = await supabase
                .from('events')
                .select('id, status')
                .eq('id', eventId)
                .maybeSingle();
            if (eventError) throw eventError;
            if (!eventRow || String(eventRow.status) !== 'started') return;

            const { data: latestRoundRows, error: latestRoundError } = await supabase
                .from('matches')
                .select('round_number')
                .eq('event_id', eventId)
                .order('round_number', { ascending: false })
                .limit(1);
            if (latestRoundError) throw latestRoundError;
            if (!latestRoundRows || latestRoundRows.length === 0) return;

            const maxRound = Number(latestRoundRows[0].round_number || 0);
            if (maxRound < 1) return;

            const { count: pendingCount, error: pendingError } = await supabase
                .from('matches')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', eventId)
                .eq('round_number', maxRound)
                .eq('status', 'pending');
            if (pendingError) throw pendingError;
            if (Number(pendingCount || 0) > 0) return;

            const { data: winnerRows, error: winnersError } = await supabase
                .from('matches')
                .select('winner_user_id, slot_index')
                .eq('event_id', eventId)
                .eq('round_number', maxRound)
                .order('slot_index', { ascending: true });
            if (winnersError) throw winnersError;

            const winners = (winnerRows || [])
                .map((row) => (row.winner_user_id == null ? null : Number(row.winner_user_id)))
                .filter((value) => value != null);

            if (winners.length <= 1) {
                const winnerUserId = winners.length === 1 ? winners[0] : null;
                const { error: finishError } = await supabase
                    .from('events')
                    .update({
                        status: 'finished',
                        winner_user_id: winnerUserId,
                        updated_at: nowMs()
                    })
                    .eq('id', eventId);
                if (finishError) throw finishError;
                return;
            }

            await createRoundMatches(eventId, maxRound + 1, winners);
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

        if (!isEmailValid(email)) throw createHttpError(400, 'Email invalide.');
        if (!isPasswordValid(password)) throw createHttpError(400, 'Mot de passe trop court (minimum 8 caracteres).');
        if (!pseudo || pseudo.length < 2) throw createHttpError(400, 'Pseudo invalide.');

        const now = nowMs();
        const { saltHex, hashHex } = createPasswordHash(password);
        const { data, error } = await supabase
            .from('users')
            .insert({
                email,
                password_hash: hashHex,
                password_salt: saltHex,
                pseudo,
                role: 'player',
                avatar_url: sanitizeAvatarUrl(body.avatarUrl),
                country_code: sanitizeCountryCode(body.country),
                level: 1,
                elo: 1200,
                games_played: 0,
                wins_total: 0,
                losses_total: 0,
                auth_provider: 'password',
                auth_provider_user_id: null,
                created_at: now,
                updated_at: now
            })
            .select('id, email, pseudo, role, avatar_url, country_code, level, elo, games_played, wins_total, losses_total, auth_provider, created_at')
            .single();
        if (error) {
            if (isUniqueViolation(error)) {
                throw createHttpError(409, 'Email ou pseudo deja utilise.');
            }
            throw error;
        }

        const token = await issueSessionToken(data.id);
        sendJson(res, 201, { ok: true, token, user: toSafeUser(data) }, corsHeaders);
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

        const { data: row, error } = await supabase
            .from('users')
            .select('id, email, pseudo, role, avatar_url, country_code, level, elo, games_played, wins_total, losses_total, auth_provider, created_at, password_hash, password_salt')
            .eq('email', email)
            .maybeSingle();
        if (error) throw error;
        if (!row) throw createHttpError(401, 'Email ou mot de passe invalide.');

        const candidateHash = hashPassword(password, row.password_salt);
        if (!secureCompareHex(candidateHash, row.password_hash)) {
            throw createHttpError(401, 'Email ou mot de passe invalide.');
        }

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
        const tokenHash = hashToken(token);
        const { error } = await supabase.from('sessions').delete().eq('token_hash', tokenHash);
        if (error) throw error;
        sendJson(res, 200, { ok: true }, corsHeaders);
    }

    async function handleAuthOAuthMobile(req, res, corsHeaders, userIp) {
        if (hitAuthRateLimit(userIp)) {
            apiError(res, 429, 'Trop de tentatives. Reessayez plus tard.', corsHeaders);
            return;
        }
        const body = await readJsonBody(req);
        const provider = String(body.provider || '').trim().toLowerCase();
        const accessToken = String(body.accessToken || body.access_token || '').trim();
        const requestedPseudo = sanitizePseudo(body.pseudo);
        const avatarUrl = sanitizeAvatarUrl(body.avatarUrl || body.avatar_url);
        const countryCode = sanitizeCountryCode(body.country || body.countryCode || body.country_code);

        if (!OAUTH_PROVIDERS.has(provider)) {
            throw createHttpError(400, 'Provider OAuth non supporte.');
        }
        if (!accessToken) {
            throw createHttpError(400, 'accessToken requis.');
        }

        const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
        if (authError) {
            throw createHttpError(401, 'Token OAuth invalide.');
        }
        const authUser = authData?.user;
        if (!authUser || !authUser.id) {
            throw createHttpError(401, 'Utilisateur OAuth introuvable.');
        }

        const providerIdentity = (Array.isArray(authUser.identities) ? authUser.identities : [])
            .find((identity) => String(identity?.provider || '').toLowerCase() === provider);
        const providerUserId = String(providerIdentity?.id || authUser.id || '').trim();
        const email = sanitizeEmail(authUser.email);
        if (!email) {
            throw createHttpError(400, 'Compte OAuth sans email.');
        }

        let user = await getUserByOAuthProvider(provider, providerUserId);
        if (!user) {
            user = await getUserByEmail(email);
        }

        if (!user) {
            const pseudoFromMeta = sanitizePseudo(authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.user_metadata?.preferred_username);
            const pseudo = await ensureUniquePseudo(requestedPseudo || pseudoFromMeta || email.split('@')[0] || 'joueur');
            const generatedSecret = crypto.randomBytes(24).toString('hex');
            const { saltHex, hashHex } = createPasswordHash(generatedSecret);
            const now = nowMs();
            const { data: inserted, error: insertError } = await supabase
                .from('users')
                .insert({
                    email,
                    password_hash: hashHex,
                    password_salt: saltHex,
                    pseudo,
                    role: 'player',
                    avatar_url: avatarUrl,
                    country_code: countryCode,
                    level: 1,
                    elo: 1200,
                    games_played: 0,
                    wins_total: 0,
                    losses_total: 0,
                    auth_provider: provider,
                    auth_provider_user_id: providerUserId,
                    created_at: now,
                    updated_at: now
                })
                .select('id, email, pseudo, role, avatar_url, country_code, level, elo, games_played, wins_total, losses_total, auth_provider, auth_provider_user_id, created_at')
                .single();
            if (insertError) {
                if (isUniqueViolation(insertError)) {
                    throw createHttpError(409, 'Conflit de creation utilisateur OAuth.');
                }
                throw insertError;
            }
            user = inserted;
        } else {
            const updatePatch = {
                updated_at: nowMs()
            };
            if (!user.auth_provider || user.auth_provider === 'password') {
                updatePatch.auth_provider = provider;
            }
            if (!user.auth_provider_user_id) {
                updatePatch.auth_provider_user_id = providerUserId;
            }
            if (!user.avatar_url && avatarUrl) {
                updatePatch.avatar_url = avatarUrl;
            }
            if (!user.country_code && countryCode) {
                updatePatch.country_code = countryCode;
            }
            if (Object.keys(updatePatch).length > 1) {
                const { error: updateError } = await supabase
                    .from('users')
                    .update(updatePatch)
                    .eq('id', user.id);
                if (updateError) throw updateError;
                user = await getUserById(user.id);
            }
        }

        if (!user) {
            throw createHttpError(500, 'Creation utilisateur OAuth impossible.');
        }

        const token = await issueSessionToken(user.id);
        sendJson(res, 200, { ok: true, token, user: toSafeUser(user) }, corsHeaders);
    }

    async function handleProfileMe(req, res, corsHeaders, parsedUrl) {
        const user = await requireUser(req);
        if (!user) throw createHttpError(401, 'Session invalide.');
        const historyLimit = parsedUrl.searchParams.get('historyLimit') || '20';
        const history = await getUserMatchHistory(user.id, historyLimit);
        sendJson(
            res,
            200,
            {
                ok: true,
                user,
                history,
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
        const user = await requireUser(req);
        if (!user) throw createHttpError(401, 'Session invalide.');

        const body = await readJsonBody(req);
        const patch = {};
        if (typeof body.pseudo === 'string') {
            const pseudo = sanitizePseudo(body.pseudo);
            if (pseudo.length < 2) {
                throw createHttpError(400, 'Pseudo invalide.');
            }
            patch.pseudo = pseudo;
        }
        if (typeof body.avatarUrl === 'string' || typeof body.avatar_url === 'string') {
            patch.avatar_url = sanitizeAvatarUrl(body.avatarUrl || body.avatar_url);
        }
        if (typeof body.country === 'string' || typeof body.countryCode === 'string' || typeof body.country_code === 'string') {
            patch.country_code = sanitizeCountryCode(body.country || body.countryCode || body.country_code);
        }

        if (Object.keys(patch).length === 0) {
            throw createHttpError(400, 'Aucune modification fournie.');
        }
        patch.updated_at = nowMs();

        const { error } = await supabase
            .from('users')
            .update(patch)
            .eq('id', user.id);
        if (error) {
            if (isUniqueViolation(error)) {
                throw createHttpError(409, 'Pseudo deja utilise.');
            }
            throw error;
        }

        const updated = await getUserById(user.id);
        sendJson(res, 200, { ok: true, user: toSafeUser(updated) }, corsHeaders);
    }

    async function handleAdminUpdateRole(req, res, corsHeaders, userId) {
        const requester = await requireUser(req);
        if (!requester) throw createHttpError(401, 'Session invalide.');
        if (requester.role !== 'admin') {
            throw createHttpError(403, 'Action reservee aux admins.');
        }

        const body = await readJsonBody(req);
        const role = sanitizeRole(body.role);
        if (!ROLE_SET.has(role)) {
            throw createHttpError(400, 'Role invalide.');
        }

        const { error } = await supabase
            .from('users')
            .update({ role, updated_at: nowMs() })
            .eq('id', userId);
        if (error) throw error;

        const updated = await getUserById(userId);
        if (!updated) throw createHttpError(404, 'Utilisateur introuvable.');
        sendJson(res, 200, { ok: true, user: toSafeUser(updated) }, corsHeaders);
    }

    async function handleEventsList(res, corsHeaders, parsedUrl) {
        const statusFilter = String(parsedUrl.searchParams.get('status') || '').trim().toLowerCase();
        const max = clampNumber(Number.parseInt(parsedUrl.searchParams.get('limit') || '20', 10), 1, 100);

        let query = supabase
            .from('events')
            .select(`
                id, code, name, description, mode, status, max_players, created_by, winner_user_id,
                starts_at, created_at, updated_at,
                owner:users!events_created_by_fkey(pseudo),
                winner:users!events_winner_user_id_fkey(pseudo)
            `)
            .order('created_at', { ascending: false })
            .limit(max);
        if (statusFilter) {
            query = query.eq('status', statusFilter);
        }

        const { data, error } = await query;
        if (error) throw error;

        const events = [];
        for (const row of (data || [])) {
            events.push(await toEventPayload(normalizeEventRow(row), { includeMatches: false }));
        }
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

        const code = await generateEventCode();
        const now = nowMs();
        const { error } = await supabase
            .from('events')
            .insert({
                code,
                name,
                description,
                mode,
                status: 'lobby',
                max_players: maxEventPlayers,
                created_by: user.id,
                starts_at: null,
                created_at: now,
                updated_at: now
            });
        if (error) throw error;

        const event = await requireEventByCodeOrThrow(code);
        await upsertEventPlayer(event.id, user, true);
        const updated = await requireEventByCodeOrThrow(code);
        sendJson(res, 201, { ok: true, event: await toEventPayload(updated) }, corsHeaders);
    }

    async function handleEventDetail(res, corsHeaders, code) {
        const event = await requireEventByCodeOrThrow(code);
        sendJson(res, 200, { ok: true, event: await toEventPayload(event) }, corsHeaders);
    }

    async function handleEventJoin(req, res, corsHeaders, code) {
        const user = await requireUser(req);
        if (!user) throw createHttpError(401, 'Authentification requise.');

        const event = await requireEventByCodeOrThrow(code);
        if (String(event.status) !== 'lobby') {
            throw createHttpError(409, 'Le salon est deja lance.');
        }

        const { data: joined, error: joinedError } = await supabase
            .from('event_players')
            .select('user_id')
            .eq('event_id', event.id)
            .eq('user_id', user.id)
            .maybeSingle();
        if (joinedError) throw joinedError;
        if (!joined && !(await hasAvailableSeats(event))) {
            throw createHttpError(409, 'Salon complet.');
        }

        await upsertEventPlayer(event.id, user, false);
        const updated = await requireEventByCodeOrThrow(code);
        sendJson(res, 200, { ok: true, event: await toEventPayload(updated) }, corsHeaders);
    }

    async function handleEventLeave(req, res, corsHeaders, code) {
        const user = await requireUser(req);
        if (!user) throw createHttpError(401, 'Authentification requise.');

        const event = await requireEventByCodeOrThrow(code);
        if (String(event.status) !== 'lobby') {
            throw createHttpError(409, 'Impossible de quitter: partie deja lancee.');
        }
        if (await userIsEventHost(event.id, user.id)) {
            throw createHttpError(409, 'L hote ne peut pas quitter. Supprimez puis recreez le salon.');
        }

        const { error } = await supabase
            .from('event_players')
            .delete()
            .eq('event_id', event.id)
            .eq('user_id', user.id);
        if (error) throw error;

        const updated = await requireEventByCodeOrThrow(code);
        sendJson(res, 200, { ok: true, event: await toEventPayload(updated) }, corsHeaders);
    }

    async function handleEventStart(req, res, corsHeaders, code) {
        const user = await requireUser(req);
        if (!user) throw createHttpError(401, 'Authentification requise.');

        const event = await requireEventByCodeOrThrow(code);
        if (!(await userIsEventHost(event.id, user.id))) {
            throw createHttpError(403, 'Seul l hote peut lancer la competition.');
        }
        if (String(event.status) !== 'lobby') {
            throw createHttpError(409, 'Competition deja lancee.');
        }

        const entrants = (await getEventPlayers(event.id)).map((player) => player.userId);
        if (entrants.length < 2) {
            throw createHttpError(409, 'Au moins 2 joueurs sont requis.');
        }

        await createRoundMatches(event.id, 1, shuffleArray(entrants));
        const { error } = await supabase
            .from('events')
            .update({
                status: 'started',
                starts_at: nowMs(),
                updated_at: nowMs()
            })
            .eq('id', event.id)
            .eq('status', 'lobby');
        if (error) throw error;

        await ensureCompetitionProgress(event.id);
        const updated = await requireEventByCodeOrThrow(code);
        sendJson(res, 200, { ok: true, event: await toEventPayload(updated) }, corsHeaders);
    }

    async function handleMatchResult(req, res, corsHeaders, code, matchId) {
        const user = await requireUser(req);
        if (!user) throw createHttpError(401, 'Authentification requise.');

        const event = await requireEventByCodeOrThrow(code);
        if (!(await userIsEventHost(event.id, user.id))) {
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

        const { data: match, error: matchError } = await supabase
            .from('matches')
            .select('id, player_a_user_id, player_b_user_id, status')
            .eq('id', matchId)
            .eq('event_id', event.id)
            .maybeSingle();
        if (matchError) throw matchError;
        if (!match) throw createHttpError(404, 'Match introuvable.');
        if (String(match.status) !== 'pending') throw createHttpError(409, 'Ce match est deja valide.');

        const playerA = match.player_a_user_id == null ? null : Number(match.player_a_user_id);
        const playerB = match.player_b_user_id == null ? null : Number(match.player_b_user_id);
        if (winnerUserId !== playerA && winnerUserId !== playerB) {
            throw createHttpError(400, 'Le gagnant doit etre dans le match.');
        }
        const loserUserId = winnerUserId === playerA ? playerB : playerA;

        const { error } = await supabase
            .from('matches')
            .update({
                winner_user_id: winnerUserId,
                status: 'completed',
                score_a: scoreA,
                score_b: scoreB,
                updated_at: nowMs()
            })
            .eq('id', match.id)
            .eq('event_id', event.id)
            .eq('status', 'pending');
        if (error) throw error;

        await addPlayerStats(event.id, winnerUserId, { wins: 1, points: 3 });
        if (loserUserId != null) {
            await addPlayerStats(event.id, loserUserId, { losses: 1, points: 0 });
            await applyGlobalMatchResult(winnerUserId, loserUserId);
        }

        await ensureCompetitionProgress(event.id);
        const updated = await requireEventByCodeOrThrow(code);
        sendJson(res, 200, { ok: true, event: await toEventPayload(updated) }, corsHeaders);
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
            await handleAuthMe(req, res, corsHeaders);
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

        const adminRoleRoute = pathName.match(/^\/api\/admin\/users\/([0-9]+)\/role$/i);
        if (adminRoleRoute && method === 'POST') {
            await handleAdminUpdateRole(req, res, corsHeaders, Number.parseInt(adminRoleRoute[1], 10));
            return;
        }

        if (pathName === '/api/events' && method === 'GET') {
            await handleEventsList(res, corsHeaders, parsedUrl);
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

        const actionRoute = pathName.match(/^\/api\/events\/([a-z0-9]{4,10})(?:\/([a-z-]+))?$/i);
        if (actionRoute) {
            const code = actionRoute[1];
            const action = actionRoute[2] || '';
            if (!action && method === 'GET') {
                await handleEventDetail(res, corsHeaders, code);
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
        try {
            return `supabase:${new URL(supabaseUrl).host}`;
        } catch (_error) {
            return 'supabase';
        }
    }

    function onTick() {
        purgeExpiredSessions().catch(() => {});
        pruneAuthRate();
    }

    return {
        getDbPath,
        handleHttp,
        onTick
    };
}

module.exports = {
    createCompetitionApiSupabase
};
