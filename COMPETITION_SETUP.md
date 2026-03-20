# Configuration du Mode Compétition

Le mode compétition nécessite un serveur backend pour gérer l'authentification et les tournois.

## Option 1 : Utiliser Supabase (Recommandé)

### 1. Créer un projet Supabase

1. Allez sur [https://supabase.com](https://supabase.com)
2. Créez un compte gratuit
3. Créez un nouveau projet

### 2. Configurer les variables d'environnement

1. Copiez `.env.supabase.example` vers `.env.supabase`
2. Dans votre projet Supabase, allez dans **Settings > API**
3. Copiez les valeurs suivantes dans `.env.supabase` :
   - `SUPABASE_URL` : URL du projet
   - `SUPABASE_ANON_KEY` : Clé anonyme
   - `SUPABASE_SERVICE_ROLE_KEY` : Clé de service (⚠️ Ne jamais commiter!)

### 3. Créer les tables dans Supabase

Exécutez le script SQL suivant dans l'éditeur SQL de Supabase :

```sql
-- Table des utilisateurs
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    password_salt TEXT,
    pseudo TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'player',
    avatar_url TEXT DEFAULT '',
    country_code TEXT DEFAULT '',
    level INTEGER DEFAULT 1,
    elo INTEGER DEFAULT 1200,
    games_played INTEGER DEFAULT 0,
    wins_total INTEGER DEFAULT 0,
    losses_total INTEGER DEFAULT 0,
    auth_provider TEXT DEFAULT 'password',
    auth_provider_user_id TEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- Table des sessions
CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    last_seen_at BIGINT NOT NULL
);

-- Table des événements/tournois
CREATE TABLE events (
    id BIGSERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    mode TEXT DEFAULT 'classic',
    status TEXT DEFAULT 'lobby',
    max_players INTEGER DEFAULT 8,
    created_by BIGINT NOT NULL REFERENCES users(id),
    winner_user_id BIGINT REFERENCES users(id),
    starts_at BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- Table des joueurs dans les événements
CREATE TABLE event_players (
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    is_host BOOLEAN DEFAULT FALSE,
    joined_at BIGINT NOT NULL,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    points INTEGER DEFAULT 0,
    PRIMARY KEY (event_id, user_id)
);

-- Table des matchs
CREATE TABLE matches (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    slot_index INTEGER NOT NULL,
    player_a_user_id BIGINT REFERENCES users(id),
    player_b_user_id BIGINT REFERENCES users(id),
    winner_user_id BIGINT REFERENCES users(id),
    status TEXT DEFAULT 'pending',
    score_a INTEGER DEFAULT 0,
    score_b INTEGER DEFAULT 0,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- Index pour améliorer les performances
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_matches_event ON matches(event_id);
```

### 4. Démarrer le serveur

```bash
npm install
npm run server
```

Le serveur démarrera sur `http://localhost:3000`

### 5. Mettre à jour l'URL de l'API dans le frontend

Dans `index.html`, changez :
```javascript
const COMP_API_BASE = 'https://jeu-points.onrender.com';
```

En :
```javascript
const COMP_API_BASE = 'http://localhost:3000';
```

## Option 2 : Utiliser PostgreSQL

Si vous préférez utiliser PostgreSQL directement :

1. Installez PostgreSQL localement
2. Créez une base de données
3. Définissez `DATABASE_URL` dans vos variables d'environnement :
   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/jeu_points
   ```
4. Exécutez le même script SQL que ci-dessus

## Déploiement en production

Pour déployer sur Render.com ou Railway :

1. Créez un nouveau service Web
2. Connectez votre repository GitHub
3. Ajoutez les variables d'environnement Supabase
4. Le serveur démarrera automatiquement

## Problèmes courants

### "Impossible de créer un compte"
- Vérifiez que le serveur est démarré
- Vérifiez que les variables d'environnement sont correctement configurées
- Vérifiez les logs du serveur pour voir les erreurs

### "Erreur CORS"
- Assurez-vous que l'origine du frontend est autorisée dans le serveur
- Vérifiez la configuration CORS dans `server/competition-api.js`

### "Erreur de connexion"
- Vérifiez que l'URL de l'API est correcte dans `index.html`
- Vérifiez que le serveur est accessible
