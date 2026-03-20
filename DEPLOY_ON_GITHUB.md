# 📦 Déployer sur GitHub Pages

GitHub Pages est idéal pour héberger l'**Interface (Frontend)** du jeu gratuitement. Cependant, comme il s'agit d'un hébergement **statique**, il ne peut pas faire tourner votre serveur Node.js (Signaling + API).

## 🚀 Stratégie Recommandée : Architecture Hybride

1.  **Backend (Signaling + API)** : Hébergé sur **Render** (ou Railway).
2.  **Frontend (Le Jeu)** : Hébergé sur **GitHub Pages**.

---

## 🛠️ Étapes de Configuration

### 1. Pointer vers le serveur de production
Allez dans votre fichier `index.html` (ligne ~10985) et remplacez l'URL automatique par votre URL **Render** :

```javascript
// index.html
const COMP_API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:8080' 
    : 'https://VOTRE-APP-SUR-RENDER.onrender.com'; // REMPLACEZ CETTE URL
```

> [!IMPORTANT]
> N'oubliez pas de mettre à jour également l'URL de **Signaling WebRTC** si elle est codée en dur (elle utilise généralement `window.location` par défaut, ce qui fonctionnera si vous hébergez tout sur Render. Mais sur GitHub Pages, vous devrez spécifier l'URL Render).

### 2. Activer les Actions GitHub
Le fichier `.github/workflows/static.yml` est déjà présent. Pour activer le déploiement automatique :
1.  Poussez votre code sur GitHub (`git push origin main`).
2.  Allez dans l'onglet **Settings** > **Pages** de votre dépôt GitHub.
3.  Sous **Build and deployment** > **Source**, sélectionnez `GitHub Actions`.
4.  Le déploiement se fera à chaque "push" sur la branche `main`.

### 3. Autoriser les Origin (CORS)
Sur votre serveur **Render**, vous devez autoriser GitHub Pages à se connecter à votre API :
1.  Dans les variables d'environnement de Render, réglez `ALLOWED_ORIGINS` sur :
    `https://VOTRE_PSEUDO.github.io,http://localhost:8080`

---

## ❓ Pourquoi utiliser GitHub Pages ?
*   **Rapidité** : Le frontend charge instantanément via le CDN de GitHub.
*   **Domaine Custom** : Très facile d'ajouter un nom de domaine personnalisé (`jeu.mondomaine.com`).
*   **Uptime** : GitHub Pages ne "dort" jamais, contrairement au plan gratuit de Render. (C'est votre backend sur Render qui dormira, mais l'interface sera toujours accessible).
