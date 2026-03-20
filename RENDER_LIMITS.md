# Limitations Render Free Tier & Capacité du Système

## 📊 Limitations Render Free Tier

### Ressources Serveur
- **RAM** : 512 MB
- **CPU** : Partagé (limité)
- **Stockage** : Éphémère (redémarre = perte de données en mémoire)
- **Bande passante** : 100 GB/mois
- **Temps d'inactivité** : Le serveur s'endort après 15 minutes d'inactivité
- **Temps de réveil** : 30-60 secondes pour redémarrer
- **Durée de vie** : Redémarre automatiquement toutes les ~24h

### Limitations Base de Données (Supabase Free)
- **Stockage** : 500 MB
- **Bande passante** : 2 GB/mois
- **Connexions simultanées** : ~60 connexions
- **Requêtes** : Illimitées (mais throttling possible)

## 🎮 Capacité Estimée pour Jeu des Points

### Scénario Conservateur (Recommandé)

#### Utilisateurs Simultanés
- **Maximum théorique** : 50-100 utilisateurs connectés
- **Recommandé** : 20-30 utilisateurs actifs simultanés
- **Raison** : 
  - 512 MB RAM partagée entre Node.js, connexions WebSocket, cache
  - Chaque utilisateur actif ≈ 5-10 MB RAM (connexion + état)
  - Besoin de marge pour les pics de charge

#### Compétitions Simultanées
- **Maximum théorique** : 10-15 tournois actifs
- **Recommandé** : 5-8 tournois simultanés
- **Calcul** :
  - Chaque tournoi : 2-8 joueurs
  - État du tournoi en mémoire : ~2-5 MB
  - Matchmaking et logique : ~1-2 MB par tournoi

#### Parties de Jeu Simultanées
- **Maximum** : 15-25 parties en cours
- **Recommandé** : 10-15 parties
- **Détails** :
  - Chaque partie : 2 joueurs
  - État de la grille : ~100 KB
  - Historique des coups : ~50 KB
  - WebSocket par joueur : ~1 MB

### Scénario Optimiste (Risqué)

Si le code est très optimisé :
- **Utilisateurs** : 100-150 simultanés
- **Tournois** : 15-20 actifs
- **Parties** : 30-40 simultanées

⚠️ **Attention** : Risque de crashes, lenteurs, timeouts

## 📈 Calculs Détaillés

### Consommation Mémoire par Composant

```
Base Node.js + Express          : ~50 MB
Supabase Client                 : ~20 MB
WebSocket Server (Socket.io)    : ~30 MB
Cache en mémoire                : ~50 MB
-------------------------------------------
Base système                    : ~150 MB
Mémoire disponible              : ~350 MB
```

### Par Utilisateur Connecté

```
Session utilisateur             : ~2 MB
Connexion WebSocket             : ~3 MB
État du profil en cache         : ~0.5 MB
-------------------------------------------
Total par utilisateur           : ~5.5 MB

350 MB / 5.5 MB = ~63 utilisateurs max
Avec marge de sécurité (30%)    : ~44 utilisateurs
```

### Par Tournoi Actif

```
Métadonnées du tournoi          : ~1 MB
Liste des joueurs (8 max)       : ~0.5 MB
Bracket/Matchs                  : ~2 MB
État en temps réel              : ~1.5 MB
-------------------------------------------
Total par tournoi               : ~5 MB

100 MB alloués / 5 MB = ~20 tournois max
Recommandé (50% marge)          : ~10 tournois
```

### Par Partie Active

```
État de la grille (8x8)         : ~100 KB
Historique des coups            : ~50 KB
Timers et métadonnées           : ~50 KB
-------------------------------------------
Total par partie                : ~200 KB

50 MB alloués / 0.2 MB = ~250 parties max
Limité par WebSocket            : ~25 parties réalistes
```

## 🚀 Optimisations Possibles

### 1. Réduire la Consommation Mémoire

```javascript
// Nettoyer les sessions inactives
setInterval(() => {
    cleanupInactiveSessions(15 * 60 * 1000); // 15 min
}, 5 * 60 * 1000); // Toutes les 5 min

// Limiter le cache
const LRU = require('lru-cache');
const cache = new LRU({
    max: 100, // Max 100 entrées
    maxAge: 1000 * 60 * 10 // 10 minutes
});

// Compression des données
const compression = require('compression');
app.use(compression());
```

### 2. Pagination et Lazy Loading

```javascript
// Limiter les requêtes
app.get('/api/events', (req, res) => {
    const limit = Math.min(req.query.limit || 20, 50);
    // Ne charger que ce qui est nécessaire
});
```

### 3. Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // Max 100 requêtes par IP
});

app.use('/api/', limiter);
```

### 4. Décharger vers Supabase

```javascript
// Utiliser Supabase Realtime au lieu de WebSocket custom
// Réduire la charge sur le serveur Node.js
```

## 📊 Monitoring Recommandé

### Métriques à Surveiller

```javascript
// Ajouter dans le serveur
const os = require('os');

app.get('/api/health', (req, res) => {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    res.json({
        memory: {
            used: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
            total: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
            percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100) + '%'
        },
        uptime: process.uptime(),
        activeConnections: getActiveConnectionsCount(),
        activeTournaments: getActiveTournamentsCount()
    });
});
```

### Alertes

```javascript
// Alerte si mémoire > 80%
if (memUsage.heapUsed / memUsage.heapTotal > 0.8) {
    console.warn('⚠️ Mémoire critique : ' + 
        Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100) + '%');
    // Nettoyer le cache, fermer connexions inactives
}
```

## 🎯 Recommandations par Scénario

### Petit Groupe d'Amis (< 20 personnes)
✅ **Render Free est parfait**
- Pas de problème de performance
- Coût : 0€
- Configuration : Minimale

### Communauté Moyenne (20-50 personnes)
⚠️ **Render Free limite**
- Fonctionne mais peut être lent aux heures de pointe
- Réveil du serveur gênant
- Recommandation : Passer à Render Starter ($7/mois)

### Grande Communauté (50-200 personnes)
❌ **Render Free insuffisant**
- Crashes fréquents
- Expérience utilisateur dégradée
- Recommandation : Render Standard ($25/mois) + Supabase Pro ($25/mois)

### Très Grande Échelle (200+ personnes)
❌ **Infrastructure dédiée requise**
- Render Pro ($85/mois)
- Supabase Pro ou Team
- CDN pour les assets statiques
- Load balancing

## 💰 Comparaison des Plans

### Render

| Plan | Prix | RAM | CPU | Utilisateurs |
|------|------|-----|-----|--------------|
| Free | 0€ | 512 MB | Partagé | 20-30 |
| Starter | $7/mois | 512 MB | Dédié | 50-100 |
| Standard | $25/mois | 2 GB | Dédié | 200-500 |
| Pro | $85/mois | 4 GB | Dédié | 1000+ |

### Supabase

| Plan | Prix | Stockage | Bande passante | Connexions |
|------|------|----------|----------------|------------|
| Free | 0€ | 500 MB | 2 GB/mois | 60 |
| Pro | $25/mois | 8 GB | 50 GB/mois | 200 |
| Team | $599/mois | 100 GB | 250 GB/mois | 400 |

## 🔧 Configuration Optimale par Budget

### Budget 0€ (Free Tier)
```
Render Free + Supabase Free
- 20-30 utilisateurs max
- 5-8 tournois simultanés
- Parfait pour tester/MVP
```

### Budget ~30€/mois
```
Render Starter ($7) + Supabase Pro ($25)
- 100-150 utilisateurs
- 15-20 tournois simultanés
- Bon pour communauté moyenne
```

### Budget ~100€/mois
```
Render Standard ($25) + Supabase Pro ($25) + Cloudflare CDN (gratuit)
- 500-1000 utilisateurs
- 50+ tournois simultanés
- Production stable
```

## 📝 Checklist Avant de Scaler

- [ ] Implémenter le monitoring (RAM, CPU, connexions)
- [ ] Ajouter le rate limiting
- [ ] Optimiser les requêtes DB (index, cache)
- [ ] Compresser les réponses HTTP
- [ ] Nettoyer les sessions inactives
- [ ] Tester la charge avec des outils (Artillery, k6)
- [ ] Prévoir un plan de migration si succès
- [ ] Documenter les limites aux utilisateurs

## 🎮 Estimation Réaliste pour Votre Jeu

### Configuration Actuelle (Render Free + Supabase Free)

**Capacité Recommandée** :
- ✅ 25 utilisateurs connectés simultanément
- ✅ 6-8 tournois actifs en même temps
- ✅ 12-15 parties de jeu simultanées
- ✅ 100-200 utilisateurs inscrits au total

**Limitations** :
- ⏱️ Réveil du serveur (30-60s) après inactivité
- 🐌 Peut ralentir si > 30 utilisateurs
- 💾 Données en mémoire perdues au redémarrage
- 📊 Pas de métriques avancées

**Idéal pour** :
- MVP et tests
- Petit groupe d'amis
- Démonstration
- Phase de développement

## 🚨 Signes qu'il Faut Upgrader

1. **Serveur qui crash régulièrement**
2. **Temps de réponse > 2 secondes**
3. **Erreurs "Out of Memory"**
4. **Plaintes des utilisateurs sur la lenteur**
5. **Plus de 30 utilisateurs actifs régulièrement**
6. **Tournois qui ne se lancent pas**
7. **Déconnexions fréquentes**

## 💡 Alternatives Gratuites

Si Render Free est insuffisant :

1. **Railway** (Free Tier)
   - 512 MB RAM
   - $5 de crédit gratuit/mois
   - Pas de sleep automatique

2. **Fly.io** (Free Tier)
   - 256 MB RAM (3 instances)
   - Meilleure distribution géographique
   - Pas de sleep

3. **Vercel** (Free)
   - Serverless (pas de limite RAM fixe)
   - Excellent pour le frontend
   - Limité pour WebSocket

4. **Heroku** (Eco $5/mois)
   - 512 MB RAM
   - Pas de sleep
   - Meilleure stabilité que Free

## 📞 Support et Communauté

Si vous atteignez les limites :
1. Optimiser le code d'abord
2. Implémenter le cache agressif
3. Utiliser Supabase Realtime
4. Considérer un upgrade progressif
5. Monitorer et ajuster

---

**Conclusion** : Avec Render Free + Supabase Free, vous pouvez confortablement supporter **20-30 utilisateurs actifs** et **5-8 tournois simultanés**. C'est parfait pour démarrer, mais prévoyez un upgrade si votre jeu décolle ! 🚀
