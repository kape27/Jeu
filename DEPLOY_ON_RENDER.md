# 🚀 Déployer sur Render

Voici les étapes pour déployer votre jeu (Serveur de Signalisation + API Compétition) sur **Render.com**.

## 1. Choix du Plan

### Option A : Plan Gratuit (MVP / Test)
*   **Performance** : Suffisante pour ~20 joueurs simultanés.
*   **Sleep** : Le serveur s'éteint après 15 min d'inactivité (réveil en ~30s).
*   **Base de données** : Utilisez **Supabase** pour la persistance (le disque SQLite de Render Free est effacé à chaque redémarrage).

### Option B : Plan Starter (7$/mois)
*   **Performance** : CPU dédié, pas de sleep.
*   **Persistance** : Vous pouvez utiliser un **Disk** persistent pour SQLite (/data/jeu.sqlite).

---

## 2. Configuration Render (Service Web)

1.  Connectez-vous à [Render.com](https://render.com).
2.  Créez un **New Web Service**.
3.  Liez votre dépôt GitHub.
4.  **Configuration** :
    *   **Runtime** : `Node`
    *   **Build Command** : `npm install`
    *   **Start Command** : `node signaling-server.js`

## 3. Variables d'Environnement (ENVS)

Allez dans l'onglet **Environment** de votre service Render et ajoutez :

| Clé | Valeur | Description |
|-----|--------|-------------|
| `PORT` | `10000` | Port d'écoute interne de Render |
| `WS_PATH` | `/ws` | Chemin du WebSocket |
| `SUPABASE_URL` | *VOTRE_URL* | URL de votre projet Supabase (pour la persistance) |
| `SUPABASE_SERVICE_ROLE_KEY` | *VOTRE_KEY* | Clé API de service (NE PAS partager!) |
| `ALLOWED_ORIGINS` | `https://*.netlify.app,https://*.github.io` | Domaines autorisés à se connecter |
| `NODE_VERSION` | `22.13.1` | Version de Node recommandés |

---

## 4. Persistance (Important)

Si vous n'utilisez pas Supabase, Render Free **effacera** votre base de données SQLite à chaque déploiement. 

**Recommandation** : Utilisez le mode **Supabase** en remplissant les variables `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`. L'API détectera automatiquement ces variables et migrera vos données vers Postgres.

## 5. Mise à jour de l'URL Frontend

Si votre interface (`index.html`) est hébergée sur Netlify ou GitHub Pages, assurez-vous de mettre à jour la constante `COMP_API_BASE` dans `index.html` (ligne ~10985) pour pointer vers l'URL Render (ex: `https://votre-app.onrender.com`).

Si vous hébergez tout sur Render (Monolithe), laissez tel quel : il détectera automatiquement l'URL de production.

---

## 🏗️ Déploiement via render.yaml (Option Pro)

Le fichier `render.yaml` est déjà présent à la racine. Vous pouvez simplement créer votre service via le bouton **Blueprints** sur Render pour appliquer toute la config automatiquement.
