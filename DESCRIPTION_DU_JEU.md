# Jeu des Points

## Présentation

**Jeu des Points** est un jeu de stratégie au tour par tour dans lequel les joueurs posent des points sur une grille pour former des carrés. Chaque carré complété rapporte des points. Le joueur avec le meilleur score à la fin de la partie l'emporte.

Le jeu est jouable directement dans le navigateur, sans installation. Il se présente sous la forme d'une application web unique (`index.html`) avec une interface moderne, des animations fluides et un thème sombre disponible.

---

## Règles du Jeu

### Objectif

Capturer le plus de carrés possible en posant stratégiquement ses points sur la grille.

### Déroulement

1. **Tour par tour** — Chaque joueur, à son tour, pose un point sur une intersection libre de la grille.
2. **Formation d'un carré** — Un carré est validé lorsque ses 4 coins appartiennent au même joueur. Le carré est alors marqué à la couleur du joueur, et celui-ci gagne 1 point.
3. **Coups multiples** — Un seul point posé peut compléter plusieurs carrés simultanément, rapportant autant de points que de carrés formés.
4. **Fin de partie** — La partie se termine lorsque toutes les intersections sont occupées (ou qu'aucun carré supplémentaire n'est réalisable). Le joueur avec le score le plus élevé gagne.
5. **Égalité** — En cas de scores identiques, la partie est déclarée ex æquo.

---

## Modes de Jeu

### Mode Local (2, 3 ou 4 joueurs)

Plusieurs joueurs partagent le même écran. Chaque joueur a un nom et une couleur personnalisables. Le panneau de tour indique clairement à qui revient le coup.

### Mode Contre IA

Un joueur humain affronte une intelligence artificielle. Quatre niveaux de difficulté sont proposés :

| Niveau | Comportement |
|--------|-------------|
| **Facile** | L'IA joue de manière aléatoire |
| **Moyen** | L'IA bloque les menaces évidentes et saisit les opportunités simples |
| **Difficile** | L'IA utilise un algorithme Minimax avec élagage pour optimiser chaque coup |
| **Très Difficile** | L'IA explore plus profondément l'arbre de jeu avec une heuristique avancée |

### Mode En Ligne (WebRTC)

Deux joueurs s'affrontent à distance via une connexion WebRTC peer-to-peer. Le système utilise un serveur de signalisation WebSocket pour établir la connexion initiale, puis les coups sont synchronisés directement entre les navigateurs.

- **Héberger** : le joueur génère un code de session à 6 caractères et le partage.
- **Rejoindre** : le second joueur entre le code pour se connecter.
- **Lien d'invitation** : un lien direct peut être copié et partagé.
- **Reconnexion automatique** : en cas de déconnexion, le jeu tente de se reconnecter automatiquement (jusqu'à 4 tentatives).
- **Lobby interactif** : un décompte de lancement synchronisé s'affiche quand les deux joueurs sont prêts.
- **Indicateur de latence** : la qualité de la connexion est affichée en temps réel.

---

## Modes Avancés

Ces modes peuvent être activés indépendamment ou combinés pour créer des variantes uniques.

### ⬇️ Gravity Shift

La gravité change de direction tous les 10 coups, faisant glisser tous les points et carrés existants dans la nouvelle direction (haut, bas, gauche, droite). Cela bouleverse le terrain de jeu et peut créer — ou détruire — des opportunités de carrés.

- Un indicateur visuel affiche la direction actuelle et le nombre de coups restants avant le prochain shift.
- Un effet de tremblement de grille accompagne chaque changement gravitationnel.

### ⚡ Hyper-Nexus

Quand un carré est complété, le système vérifie automatiquement si les carrés adjacents peuvent être complétés en chaîne. Cela crée des réactions en chaîne spectaculaires qui peuvent rapporter plusieurs points d'un seul coup.

### 🚧 Obstacles

Des points bloqués apparaissent aléatoirement sur la grille au début de la partie. Ces cases sont inaccessibles : aucun joueur ne peut y poser de point, et aucun carré ne peut les utiliser comme coin.

- **Densité configurable** : trois niveaux disponibles :
  - **Peu** (~10% des cases intérieures)
  - **Moyen** (~20% des cases intérieures)
  - **Beaucoup** (~35% des cases intérieures)
- **Distribution équilibrée** : les obstacles sont répartis par quadrants pour garantir un terrain de jeu équitable.
- **Visuels animés** : les obstacles apparaissent avec une animation en cascade et pulsent doucement de manière continue.
- **Compteur en jeu** : un badge dans le panneau de progression affiche le nombre total d'obstacles.
- **Tooltip** : au survol d'un obstacle, une infobulle indique « 🚫 Case bloquée ».

---

## Rythme de Jeu

| Rythme | Description |
|--------|-------------|
| **Classique** | Aucune limite de temps. Chaque joueur réfléchit à son rythme. |
| **Blitz** | Chaque joueur dispose d'un temps limité par tour (5 à 20 secondes, configurable). Un timer visuel s'affiche et un son d'alerte retentit quand le temps est presque écoulé. |

---

## Configuration de la Partie

| Paramètre | Options |
|-----------|---------|
| **Taille de grille** | 6×6, 8×8, 10×10, 12×12 |
| **Nombre de joueurs** | 2, 3 ou 4 (local), 2 (IA et WebRTC) |
| **Nom du joueur** | Personnalisable (max 20 caractères) |
| **Couleur du joueur** | Choix libre via sélecteur de couleur |
| **Difficulté IA** | Facile, Moyen, Difficile, Très Difficile |
| **Modes avancés** | Gravity Shift, Hyper-Nexus, Obstacles (combinables) |
| **Densité obstacles** | Peu, Moyen, Beaucoup |
| **Rythme** | Classique ou Blitz |

Les préférences sont automatiquement sauvegardées localement et restaurées à la prochaine visite.

---

## Interface et Expérience

- **Thème clair / sombre** : basculement instantané via un bouton en haut à droite.
- **Design responsive** : s'adapte à toutes les tailles d'écran (mobile, tablette, desktop).
- **Animations** : confettis à chaque carré complété, effets de pulsation sur les scores, transitions fluides.
- **Effets sonores** : clics, complétion de carré, alertes, combos — désactivables à tout moment.
- **Panneau de progression** : affiche en temps réel le nombre de points posés, le pourcentage d'avancement et le nombre d'obstacles actifs.
- **Indicateur de tour** : le nom et la couleur du joueur actif sont toujours visibles.
- **Notifications toast** : messages contextuels pour les actions importantes (carré complété, erreur réseau, etc.).
- **Annulation de coup** : permet de revenir en arrière (désactivé en mode WebRTC).
- **Rappel des règles** : accessible à tout moment via un bouton en bas de l'écran.
- **Écran de fin de partie** : classement animé avec badge du gagnant et scores détaillés.

---

## Architecture Technique

| Composant | Technologie | Fichier |
|-----------|-------------|---------|
| **Front-end** | HTML / CSS / JavaScript vanilla | `index.html` |
| **Serveur de signalisation** | Node.js, WebSocket (`ws`) | `signaling-server.js` |

### Caractéristiques techniques

- **Application mono-fichier** : tout le front-end (structure, styles, logique, IA) est contenu dans `index.html`.
- **Aucun framework** : pas de React, Vue ou autre — JavaScript natif pour des performances maximales.
- **État côté client** : tout l'état de jeu est géré dans le navigateur, avec snapshot/restore pour l'annulation.
- **IA intégrée** : algorithme Minimax avec élagage alpha-beta, heuristiques de position et évaluation des menaces.
- **WebRTC DataChannel** : synchronisation peer-to-peer des coups en temps réel, sans serveur intermédiaire pour les données de jeu.
- **Serveur de signalisation léger** : sert uniquement à l'échange initial d'offres/réponses SDP et de candidats ICE. Inclut un heartbeat et un endpoint `/health`.

---

## Déploiement

| Service | Plateforme | URL |
|---------|------------|-----|
| **Front-end** | Netlify | Site statique, déploiement automatique depuis GitHub |
| **Serveur de signalisation** | Render | Web service Node.js, plan gratuit |

Le front-end détecte automatiquement son environnement : en local il se connecte à `ws://localhost:8080/ws`, sur Netlify il utilise le serveur Render configuré.

---

## Fichiers du Projet

| Fichier | Description |
|---------|-------------|
| `index.html` | Application complète (HTML + CSS + JS) |
| `signaling-server.js` | Serveur de signalisation WebRTC (Node.js) |
| `package.json` | Dépendances et scripts npm |
| `netlify.toml` | Configuration de déploiement Netlify |
| `render.yaml` | Configuration de déploiement Render |
| `DESCRIPTION_DU_JEU.md` | Ce fichier |
| `REGLES_DU_JEU.md` | Règles détaillées du jeu |
| `MODE_WEBRTC.md` | Documentation du mode en ligne |
