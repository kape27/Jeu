# Analyse du Mode Multijoueur En Ligne

## Vue d'Ensemble

Le jeu implémente **deux systèmes multijoueur distincts** :

1. **Mode WebRTC (Bluetooth)** : Connexion peer-to-peer pour parties rapides 2-4 joueurs
2. **Mode Compétition** : Système de tournois avec authentification et classement ELO

---

## 1. Mode WebRTC (Bluetooth) - Peer-to-Peer

### Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│  Joueur A   │◄───────►│  Serveur Signal  │◄───────►│  Joueur B   │
│  (Hôte)     │         │  (WebSocket)     │         │  (Invité)   │
└─────────────┘         └──────────────────┘         └─────────────┘
       │                                                      │
       └──────────────────────────────────────────────────────┘
                    Connexion WebRTC DataChannel
                    (Communication directe P2P)
```

### Fonctionnement

#### Phase 1 : Signalisation (WebSocket)
- **Serveur** : `signaling-server.js` sur port 8080 (ou variable `PORT`)
- **Endpoint** : `ws://HOST:PORT/ws`
- **Rôles** :
  - `host` : Crée une session avec un code à 6 caractères
  - `guest` : Rejoint une session existante avec le code

#### Phase 2 : Établissement WebRTC
1. L'hôte crée un `RTCPeerConnection` et un `DataChannel`
2. Génère une offre SDP (Session Description Protocol)
3. Envoie l'offre via WebSocket au serveur de signalisation
4. L'invité reçoit l'offre, crée sa propre connexion
5. Génère une réponse SDP et la renvoie
6. Échange de candidats ICE pour trouver le meilleur chemin réseau
7. Connexion directe établie via le DataChannel

#### Phase 3 : Jeu (DataChannel)
- **Communication** : 100% peer-to-peer, le serveur n'est plus utilisé
- **Messages synchronisés** :
  - Coups de jeu (`move`)
  - État de la grille
  - Scores
  - Événements (carré complété, fin de partie)

### Caractéristiques Techniques

#### Gestion des Salles (Rooms)
```javascript
// Structure d'une room
{
  host: WebSocket,           // Socket de l'hôte
  guests: Map<peerId, ws>,   // Map des invités
  maxPeers: 4,               // Maximum 4 joueurs
  nextGuestIndex: 1          // Compteur pour IDs uniques
}
```

#### Sécurité et Limites
- **Rate Limiting** :
  - Messages : 180/minute par IP
  - Tentatives de connexion : 30/minute par IP
  - Authentification : 25/minute par IP
- **Payload max** : 16 KB par message WebSocket
- **CORS** : Origines autorisées configurables
- **Heartbeat** : Ping/pong toutes les 30 secondes

#### Reconnexion Automatique
- Jusqu'à 4 tentatives de reconnexion
- Délai exponentiel entre tentatives
- Restauration de l'état de jeu après reconnexion
- Indicateur visuel de qualité de connexion

### Avantages
✅ Latence ultra-faible (communication directe)  
✅ Pas de coût serveur pour les données de jeu  
✅ Fonctionne même si le serveur tombe après connexion  
✅ Support de 2 à 4 joueurs simultanés  
✅ Reconnexion automatique  

### Limitations
❌ Nécessite HTTPS (ou localhost) pour WebRTC  
❌ Peut échouer derrière certains firewalls/NAT stricts  
❌ Pas de persistance (partie perdue si tous déconnectés)  
❌ Pas de classement ou historique  

---

## 2. Mode Compétition - Tournois avec Backend

### Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│  Frontend   │◄───────►│  API REST        │◄───────►│  Base de    │
│  (Browser)  │  HTTPS  │  Node.js         │         │  Données    │
└─────────────┘         └──────────────────┘         └─────────────┘
                              │
                              ├─ SQLite (local/dev)
                              ├─ Supabase PostgreSQL (prod)
                              └─ Railway PostgreSQL (prod)
```

### Base de Données

#### Tables Principales

**users** - Profils joueurs
```sql
- id, email, pseudo (unique)
- password_hash, password_salt
- role (player/organizer/admin)
- avatar_url, country_code
- level, elo (classement)
- games_played, wins_total, losses_total
- auth_provider (password/oauth)
```

**events** - Tournois/Compétitions
```sql
- id, code (6 caractères unique)
- name, description, mode
- status (lobby/started/finished)
- max_players (2-64)
- created_by, winner_user_id
- starts_at, created_at, updated_at
```

**event_players** - Participants
```sql
- event_id, user_id (clé composite)
- display_name, is_host
- wins, losses, points
- joined_at
```

**matches** - Matchs individuels
```sql
- id, event_id, round_number, slot_index
- player_a_user_id, player_b_user_id
- winner_user_id, status
- score_a, score_b
- created_at, updated_at
```

**sessions** - Authentification
```sql
- token_hash (clé primaire)
- user_id, expires_at
- created_at, last_seen_at
```

### API REST

#### Endpoints Authentification
```
POST /api/auth/register
  Body: { email, password, pseudo, avatarUrl?, country? }
  Response: { ok, token, user }

POST /api/auth/login
  Body: { email, password }
  Response: { ok, token, user }

GET /api/auth/me
  Headers: Authorization: Bearer <token>
  Response: { ok, user }

POST /api/auth/logout
  Headers: Authorization: Bearer <token>
  Response: { ok }
```

#### Endpoints Événements
```
POST /api/events
  Headers: Authorization: Bearer <token>
  Body: { name, description?, mode?, maxPlayers? }
  Response: { ok, event }

GET /api/events/:code
  Response: { ok, event, players, matches }

POST /api/events/:code/join
  Headers: Authorization: Bearer <token>
  Response: { ok, event }

POST /api/events/:code/start
  Headers: Authorization: Bearer <token>
  Response: { ok, event }

POST /api/events/:code/matches/:matchId/result
  Headers: Authorization: Bearer <token>
  Body: { winnerUserId, scoreA, scoreB }
  Response: { ok, match, event }

DELETE /api/events/:code
  Headers: Authorization: Bearer <token>
  Response: { ok }
```

#### Endpoints Utilisateur
```
GET /api/users/:userId
  Response: { ok, user }

GET /api/users/:userId/history
  Query: ?limit=20
  Response: { ok, matches: [...] }

GET /api/leaderboard
  Query: ?limit=100
  Response: { ok, users: [...] }
```

### Système de Classement ELO

#### Calcul
```javascript
// Formule ELO standard
expectedWinner = 1 / (1 + 10^((loserElo - winnerElo) / 400))
winnerDelta = K * (1 - expectedWinner)
loserDelta = K * (0 - expectedLoser)

// K-factor = 24 (standard)
```

#### Niveaux
```javascript
level = Math.floor((elo - 800) / 120) + 1
// Niveau 1 : 800-919 ELO
// Niveau 2 : 920-1039 ELO
// Niveau 3 : 1040-1159 ELO
// etc.
```

### Format de Tournoi

#### Bracket à Élimination Simple
1. **Lobby** : Les joueurs rejoignent avec le code
2. **Démarrage** : L'hôte lance quand tous sont prêts
3. **Round 1** : Appariements aléatoires
4. **Progression** : Les gagnants passent au round suivant
5. **BYE automatique** : Si nombre impair de joueurs
6. **Finale** : Dernier match, désignation du champion

#### Gestion Automatique
- Création automatique des rounds suivants
- Détection de fin de round (tous matchs complétés)
- Mise à jour des stats joueurs en temps réel
- Attribution du gagnant final

### Sécurité

#### Authentification
- Tokens SHA-256 (64 caractères hex)
- Mots de passe : scrypt avec salt aléatoire
- Sessions : TTL de 7 jours (configurable)
- Comparaison timing-safe pour éviter timing attacks

#### Rate Limiting
- 25 tentatives auth/minute par IP
- 180 messages/minute par IP
- 30 joins/minute par IP
- Fenêtre glissante de 60 secondes

#### CORS
- Origines configurables via `ALLOWED_ORIGINS`
- Support wildcards : `https://*.onrender.com`
- Validation stricte des origines

### Déploiement

#### Options de Base de Données (Priorité)
1. **Railway PostgreSQL** : `DATABASE_URL` détecté automatiquement
2. **Supabase PostgreSQL** : `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
3. **SQLite local** : Fallback pour développement

#### Variables d'Environnement
```bash
# Serveur
PORT=8080
HOST=0.0.0.0
WS_PATH=/ws
MAX_PLAYERS=4

# Base de données (choisir une option)
DATABASE_URL=postgresql://...           # Railway
SUPABASE_URL=https://...                # Supabase
SUPABASE_SERVICE_ROLE_KEY=...           # Supabase
DB_PATH=./data/jeu.sqlite               # SQLite

# Sécurité
ALLOWED_ORIGINS=https://example.com,https://*.netlify.app
ALLOW_EMPTY_ORIGIN=false
RATE_LIMIT_MAX_MESSAGES=180
RATE_LIMIT_MAX_JOINS=30
RATE_LIMIT_MAX_AUTH=25

# Limites
MAX_WS_PAYLOAD_BYTES=16384
SESSION_TTL_MS=604800000  # 7 jours
```

### Avantages
✅ Persistance complète des données  
✅ Système de classement ELO  
✅ Historique des matchs  
✅ Tournois organisés avec brackets  
✅ Authentification sécurisée  
✅ Support multi-plateforme (PostgreSQL/SQLite)  

### Limitations
❌ Nécessite un serveur backend  
❌ Coûts d'hébergement  
❌ Latence réseau (API REST)  
❌ Complexité de déploiement  

---

## Comparaison des Deux Modes

| Critère | WebRTC (Bluetooth) | Compétition |
|---------|-------------------|-------------|
| **Latence** | Ultra-faible (P2P) | Moyenne (API REST) |
| **Coût serveur** | Minimal (signaling only) | Élevé (backend + DB) |
| **Persistance** | ❌ Aucune | ✅ Complète |
| **Classement** | ❌ Non | ✅ ELO + niveaux |
| **Joueurs max** | 4 | 64 (tournoi) |
| **Authentification** | ❌ Non | ✅ Oui |
| **Historique** | ❌ Non | ✅ Oui |
| **Complexité** | Faible | Élevée |
| **Cas d'usage** | Parties rapides entre amis | Tournois compétitifs |

---

## Recommandations

### Pour Parties Rapides
➡️ **Utiliser le mode WebRTC**
- Idéal pour jouer entre amis
- Pas besoin de compte
- Latence minimale
- Gratuit à héberger

### Pour Compétitions
➡️ **Utiliser le mode Tournoi**
- Classement et progression
- Historique des matchs
- Organisation d'événements
- Communauté de joueurs

### Optimisations Possibles

#### Mode WebRTC
1. **Ajouter WebRTC Mesh** pour 3-4 joueurs (actuellement star topology)
2. **Implémenter TURN server** pour NAT traversal garanti
3. **Compression des messages** pour réduire la bande passante
4. **Chiffrement E2E** des données de jeu

#### Mode Compétition
1. **Cache Redis** pour réduire la charge DB
2. **WebSocket pour live updates** (actuellement polling)
3. **Matchmaking automatique** basé sur ELO
4. **Spectateur mode** pour regarder les matchs
5. **Replay system** pour revoir les parties

---

## Limites Actuelles

### Render.com (Plan Gratuit)
- **RAM** : 512 MB
- **Utilisateurs simultanés** : ~20-30 recommandé
- **Parties actives** : ~10-15 max
- **Spin-down** : Après 15 min d'inactivité

### Solutions
1. **Upgrade Render** : $7/mois pour 512 MB garantis
2. **Railway** : $5/mois avec meilleure performance
3. **Supabase Realtime** : Décharger la sync temps réel
4. **Cache agressif** : Réduire les requêtes DB

---

## Conclusion

Le jeu dispose d'une **architecture multijoueur hybride sophistiquée** :

- **WebRTC** pour l'expérience utilisateur optimale (latence, gratuité)
- **Backend REST** pour la persistance et la compétition

Cette approche offre le meilleur des deux mondes : parties rapides sans friction ET système de tournois complet avec classement.

L'implémentation est **production-ready** avec :
- Sécurité robuste (rate limiting, CORS, auth)
- Gestion d'erreurs complète
- Reconnexion automatique
- Support multi-DB (SQLite/PostgreSQL/Supabase)
- Déploiement flexible (local/Render/Railway/Netlify)
