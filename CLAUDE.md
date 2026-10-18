# Cookies Clique

Jeu incrémental (type Cookie Clicker) sur une île déserte : le clic rapporte des pièces, les bâtiments
produisent des pièces par seconde et attirent des habitants ; la population fait passer des paliers.
Projet pour apprendre et s’amuser. Le propriétaire est débutant en code : expliquer simplement, en français.

## Fichiers
- `index.html` : structure de la page, aucun CSS ni JS dedans.
- `style.css` : apparence ; couleurs en variables dans `:root`.
- `game.js` : toute la logique, dans une seule fonction `(function(){ "use strict"; … })();`.
  Les données d’équilibrage sont en haut : `BUILDINGS`, `UPGRADES` (+ `BUILDING_UPGRADES`), `STAGES`,
  et les réglages des événements (`BOTTLE`, `BOAT`, `FRENZY`, `GOLD_CLICK`).

## Technique
- HTML/CSS/JS sans framework ni npm. Dessins = emojis.
- Sauvegarde dans `localStorage` (clé `cookies-clique-save`) toutes les 10 s et quand on quitte la page ;
  gains hors ligne plafonnés à 8 h. Si on change la forme de `state`, garder la compatibilité avec
  les anciennes sauvegardes (`load()` complète avec `newState()`).
- Lancer en local : `python3 -m http.server 8765` puis http://localhost:8765.

## Conventions
- Textes du jeu en français (guillemets « », apostrophe ’). Messages de commit en anglais, à l’impératif.
- Doit rester jouable sur téléphone (390 px de large, pas de défilement horizontal).
