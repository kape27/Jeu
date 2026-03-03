# Mode WebRTC (2 navigateurs distants)

## Principe
- Les coups transitent en pair-a-pair via WebRTC DataChannel.
- Un serveur de signalisation WebSocket sert uniquement a etablir la connexion.
- Les joueurs se rejoignent avec un code de session (6 caracteres).

## Demarrage du serveur de signalisation
1. Installer les dependances:
   - `npm install`
   - (Windows PowerShell avec restriction) `npm.cmd install`
2. Lancer le serveur:
   - `npm run start:signaling`
   - (Windows PowerShell avec restriction) `npm.cmd run start:signaling`
3. Le serveur ecoute par defaut sur:
   - `ws://localhost:8080/ws`

## Connexion de deux navigateurs
1. Ouvrir le jeu sur les deux navigateurs.
2. Choisir `En ligne (WebRTC)`.
3. Renseigner `Serveur de signalisation` (ex: `ws://IP_DU_SERVEUR:8080/ws`).
4. Navigateur A:
   - cliquer `Heberger une partie`
   - partager le code de session affiche.
   - attendre que l adversaire soit pret: la manche demarre automatiquement avec un decompte de 3 secondes sur la grille.
5. Navigateur B:
   - saisir le code de session
   - cliquer `Rejoindre une partie`.

## Astuces UX ajoutees
- Cote hote: bouton `Copier le code` pour partager rapidement.
- Cote hote: bouton `Copier le lien` pour partager une URL pre-remplie (session uniquement).
- Le champ serveur de signalisation est memorise localement dans le navigateur.
- Les parametres URL `?mode=bluetooth&role=join&session=XXXXXX` ouvrent directement l ecran de jonction pre-rempli.
- La resynchronisation de partie est automatique et continue pendant toute la session WebRTC.

## Notes reseau
- Les deux navigateurs doivent pouvoir joindre le serveur de signalisation.
- En production, preferer `wss://` (TLS) au lieu de `ws://`.
- Si la connexion chute, le client tente une reprise automatique.
- Le parametre URL `signal` est ignore pour eviter l injection d un serveur de signalisation tiers.

## Durcissement serveur (Render)
Variables d environnement recommandees:
- `ALLOWED_ORIGINS` (liste CSV des origines autorisees)
- `ALLOW_EMPTY_ORIGIN=false`
- `MAX_WS_PAYLOAD_BYTES=16384`
- `RATE_LIMIT_WINDOW_MS=60000`
- `RATE_LIMIT_MAX_MESSAGES=180`
- `RATE_LIMIT_MAX_JOINS=30`
- `RATE_LIMIT_MAX_AUTH=25`
- `SESSION_TTL_MS=604800000` (7 jours)
- `SUPABASE_URL=https://<project>.supabase.co` (recommande)
- `SUPABASE_SERVICE_ROLE_KEY=<service_role_key>` (secret)
- `DB_PATH=/opt/render/project/data/jeu.sqlite` (fallback local si Supabase non configure)

## Setup Supabase
1. Creer un projet Supabase.
2. Ouvrir SQL Editor et executer:
   - `supabase/schema.sql`
3. Dans Render, definir:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Redemarrer le service: l API utilisera Supabase automatiquement.

## API Comptes + Competitions (MVP)
Le meme serveur expose maintenant une API REST:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/events`
- `POST /api/events`
- `GET /api/events/:code`
- `POST /api/events/:code/join`
- `POST /api/events/:code/leave`
- `POST /api/events/:code/start`
- `POST /api/events/:code/matches/:matchId/result`

Format auth:
- Header `Authorization: Bearer <token>`

Page de test rapide:
- Ouvrir `competition.html` dans le navigateur pour gerer comptes, salons et bracket.
