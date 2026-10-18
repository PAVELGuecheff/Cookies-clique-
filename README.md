# Cookies Clique — L’île déserte 🏝️

Un petit jeu du type *Cookie Clicker*, en français, qui marche sur ordinateur et sur téléphone.

## Le principe
- Touchez l’île pour gagner des **pièces**.
- Construisez des bâtiments (huttes, cabanes de pêcheur, port, hôtel…) : ils produisent des pièces
  tout seuls et attirent des **habitants**.
- Faites grandir votre îlot désert jusqu’à une **île-nation**.
- La partie est sauvegardée automatiquement dans le navigateur. Les bâtiments continuent de produire
  pendant votre absence (jusqu’à 8 h).

## Lancer le jeu sur son ordinateur
Dans le dossier du projet :

```
python3 -m http.server 8765
```

puis ouvrir http://localhost:8765 dans le navigateur.

## Fichiers
- `index.html` : la page
- `style.css` : l’apparence
- `art.js` : les dessins en pixel art
- `game.js` : les règles du jeu (prix, bâtiments, paliers en haut du fichier)
