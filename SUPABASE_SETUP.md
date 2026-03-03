# Supabase Setup - Jeu des Points

## Purpose
This file explains how to configure Supabase safely for the competition API.

## Required secrets
Set these values in Render (server only):

- `SUPABASE_URL=https://<project-ref>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY=<real_service_role_key>`

Important:
- `SUPABASE_SERVICE_ROLE_KEY` must be the token with JWT role `service_role`.
- Do not use `anon` key as service role key.

## Local development
1. Copy `.env.supabase.example` to `.env.supabase`.
2. Fill real values locally.
3. Run `npm run test:supabase`.

## Database schema
Apply this script in Supabase SQL editor:

- `supabase/schema.sql`

## Security checklist
1. Rotate keys if they were exposed.
2. Never commit `.env.supabase`.
3. Keep `SUPABASE_SERVICE_ROLE_KEY` only on backend/runtime secrets.
4. Optional after MVP: enable RLS and move to end-user JWT auth.

## Quick validation
Expected outputs after setup:
- `npm run test:supabase` passes.
- API returns JSON on `GET /api/health`.
- Register -> create event -> join -> start works in `competition.html`.
