# Cookies Clique

Jeu incrémental (type Cookie Clicker) sur une île déserte : le clic rapporte des pièces, les bâtiments
produisent des pièces par seconde et attirent des habitants ; la population fait passer des paliers.
Projet pour apprendre et s’amuser. Le propriétaire est débutant en code : expliquer simplement, en français.

## Fichiers
- `index.html` : structure de la page, aucun CSS ni JS dedans.
- `style.css` : apparence ; couleurs en variables dans `:root`.
- `art.js` : tous les dessins en pixel art (grilles de lettres + palette `PALETTE`), l’île dessinée
  pixel par pixel (`drawIsland`) et les emplacements des bâtiments. Expose `window.PixelArt`.
- `game.js` : toute la logique, dans une seule fonction `(function(){ "use strict"; … })();`.
  Les données d’équilibrage sont en haut : `BUILDINGS`, `UPGRADES` (+ `BUILDING_UPGRADES`), `STAGES`,
  les réglages des événements (`BOTTLE`, `BOAT`, `FRENZY`, `GOLD_CLICK`) et de l’économie
  (`SYNERGIES`, `JOBS`, `RESOURCES`, `MARKET`, `BANK`, `TABS`).
- La boutique a des onglets : Construire, Métiers, Marché, Coffre (débloqués au fil de la partie).

## Technique
- HTML/CSS/JS sans framework ni npm.
- Direction artistique : pixel art, une seule palette (celle d’`art.js`), police « Jersey 10 », contours
  pixel (`--outline` dans `style.css`), aplats sans dégradé doux. **Pas d’emoji** dans l’interface :
  utiliser `icon("nom")` (game.js) et ajouter le dessin dans `art.js` si besoin.
- Sauvegarde dans `localStorage` (clé `cookies-clique-save`) toutes les 10 s et quand on quitte la page ;
  gains hors ligne plafonnés à 8 h. Si on change la forme de `state`, garder la compatibilité avec
  les anciennes sauvegardes (`load()` complète avec `newState()`).
- Lancer en local : `python3 -m http.server 8765` puis http://localhost:8765.

## Conventions
- Textes du jeu en français (guillemets « », apostrophe ’). Messages de commit en anglais, à l’impératif.
- Doit rester jouable sur téléphone (390 px de large, pas de défilement horizontal).
