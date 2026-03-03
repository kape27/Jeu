#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.supabase' });

const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

function decodeJwtPayload(token) {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    try {
        return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch (_error) {
        return null;
    }
}

function fail(message) {
    console.error(`ERROR: ${message}`);
    process.exit(1);
}

if (!supabaseUrl) {
    fail('SUPABASE_URL is missing in .env.supabase');
}
if (!serviceRoleKey) {
    fail('SUPABASE_SERVICE_ROLE_KEY is missing in .env.supabase');
}

const payload = decodeJwtPayload(serviceRoleKey);
const keyRole = String(payload?.role || '').trim();
if (keyRole !== 'service_role') {
    fail(`SUPABASE_SERVICE_ROLE_KEY must have role=service_role (current: ${keyRole || 'unknown'})`);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testDatabase() {
    console.log('Supabase connectivity test\n');
    console.log(`URL: ${supabaseUrl}`);
    console.log(`Key role: ${keyRole}\n`);

    const checks = [
        { table: 'users', label: 'users table access' },
        { table: 'sessions', label: 'sessions table access' },
        { table: 'events', label: 'events table access' },
        { table: 'event_players', label: 'event_players table access' },
        { table: 'matches', label: 'matches table access' }
    ];

    for (const check of checks) {
        const { error } = await supabase
            .from(check.table)
            .select('*')
            .limit(0);

        if (error) {
            fail(`${check.label} failed: ${error.message}`);
        }
        console.log(`OK: ${check.label}`);
    }

    const { count: usersCount, error: usersCountError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
    if (usersCountError) {
        fail(`users count failed: ${usersCountError.message}`);
    }

    const { count: eventsCount, error: eventsCountError } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true });
    if (eventsCountError) {
        fail(`events count failed: ${eventsCountError.message}`);
    }

    console.log(`\nOK: users count = ${usersCount}`);
    console.log(`OK: events count = ${eventsCount}`);
    console.log('\nDONE: Supabase configuration looks valid.');
}

testDatabase().catch((error) => {
    console.error(`ERROR: unexpected failure: ${error.message}`);
    process.exit(1);
});
