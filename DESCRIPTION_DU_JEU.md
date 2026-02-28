# Description du jeu

## Resume
Jeu des Points est un jeu de strategie rapide ou les joueurs posent des points sur une grille pour former des carres.  
Chaque carre valide rapporte des points, et le meilleur score gagne a la fin.

## Concept
- Type: jeu de grille, reflexion et anticipation.
- Objectif: capturer le plus de carres possible.
- Rythme: tours courts, decisions simples, impact tactique immediat.

## Modes disponibles
- Local: 2, 3 ou 4 joueurs sur le meme ecran.
- IA: affrontement contre une intelligence artificielle (facile, moyen, difficile).
- WebRTC: partie a 2 joueurs entre navigateurs distants (via serveur de signalisation).

## Experience utilisateur
- Interface moderne et lisible avec panneau de tour et progression en direct.
- Tableau des scores colore par joueur.
- Feedback visuel sur la grille et notifications d actions (toasts).
- Controles rapides: annuler, afficher les regles, activer/couper le son, relancer une partie.

## Public vise
- Joueurs occasionnels qui veulent une partie courte.
- Joueurs competitifs qui aiment optimiser chaque coup.
- Groupes d amis pour des sessions locales rapides.

## Duree et rejouabilite
- Une partie est courte et dynamique.
- La rejouabilite est elevee grace aux differents modes et styles de jeu.

## Base technique
- Application web front-end en fichier unique (`index.html`).
- Interface en HTML/CSS.
- Logique de jeu et IA en JavaScript.
- Etat de partie gere cote client.
- Synchronisation reseau en WebRTC DataChannel.
- Serveur de signalisation Node.js (`signaling-server.js`) via WebSocket.

## Documentation associee
- Regles detaillees: `REGLES_DU_JEU.md`
