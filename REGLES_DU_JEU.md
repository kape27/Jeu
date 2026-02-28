# Regles du jeu

## Objectif
Marquer le plus de points en completant des carres sur la grille.

## Mise en place
- La taille de grille est configurable (6x6, 8x8, 10x10, 12x12 cases).
- Le nombre de points disponibles depend de la taille choisie.
- Le jeu se joue en 2, 3 ou 4 joueurs, contre IA, ou en WebRTC.
- Chaque joueur a une couleur.

## Deroulement d un tour
1. Le joueur actif place un point sur une position libre.
2. Si ce point termine un ou plusieurs carres valides, le joueur marque des points.
3. Le tour passe ensuite au joueur suivant.

## Comment marquer un point
- Un carre rapporte 1 point.
- Un carre est valide si ses 4 coins appartiennent au meme joueur.
- Un joueur peut marquer plusieurs points sur un seul coup si plusieurs carres sont completes en meme temps.

## Fin de partie
- La partie se termine quand toutes les positions sont remplies.
- Le gagnant est le joueur avec le score le plus eleve.
- En cas d egalite, la partie est declaree ex aequo.

## Modes de jeu
- Local: 2 a 4 joueurs sur le meme ecran.
- IA: 1 joueur contre l IA (facile, moyen, difficile).
- WebRTC: 2 joueurs entre navigateurs distants (avec code de session).

## Commandes utiles
- Annuler: revient au coup precedent (indisponible en WebRTC).
- Regles: ouvre un rappel des regles.
- Son: active ou coupe les effets sonores.
- Nouvelle partie: redemarre la partie.

## Conseils
- Surveillez les zones presque completes.
- Essayez de preparer des coups qui ferment plusieurs carres.
