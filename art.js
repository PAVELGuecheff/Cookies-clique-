// Dessins du jeu en pixel art.
// Chaque dessin est une grille de lettres : une lettre = un pixel de la couleur indiquée dans PALETTE,
// « . » = transparent. Pour modifier un dessin, il suffit de changer les lettres.
(function () {
  "use strict";

  const PALETTE = {
    k: "#3a2433", // contour
    i: "#ffffff", // blanc
    w: "#fff4dc", // crème, écume
    s: "#f6d68a", // sable
    S: "#e2b469", // sable ombré
    d: "#b9823f", // paille foncée, sable mouillé
    y: "#ffd45a", // jaune, or
    Y: "#d99a26", // or foncé
    o: "#f39a3c", // orange
    r: "#e85d4a", // corail
    R: "#a8383a", // rouge foncé
    b: "#a86a3c", // bois
    B: "#6e432c", // bois foncé
    g: "#79c46a", // vert
    G: "#3f8a4f", // vert foncé
    t: "#5fd3cf", // turquoise
    T: "#2b97a8", // lagon profond
    n: "#1f5f7a", // bleu nuit
    e: "#7cc0ee", // bleu clair
    E: "#3f79c0", // bleu
    m: "#b4bccb", // gris clair
    M: "#6b7389", // gris
    p: "#f6c39c", // peau claire
    q: "#c57c56", // peau mate
    Q: "#8a5238", // peau foncée
    h: "#4a2f28", // cheveux bruns
    H: "#e8b44a", // cheveux blonds
    u: "#9b72cf", // violet
    U: "#6a4a9c", // violet foncé
    l: "#f3a6b8", // rose
  };

  const SPRITES = {
    // ---- Bâtiments (16 × 16) ----
    hutte: [
      "................",
      ".......kk.......",
      "......kyyk......",
      ".....kyddyk.....",
      "....kyyddyyk....",
      "...kyydyydyyk...",
      "..kyydyyyydyyk..",
      ".kddddddddddddk.",
      "..kbbbbbbbbbbk..",
      "..kbBbbbbbbBbk..",
      "..kbBbkkkkbBbk..",
      "..kbBbkBBkbBbk..",
      "..kbBbkBBkbBbk..",
      "..kbBbkBykbBbk..",
      "..kkkkkkkkkkkk..",
      "................",
    ],
    pecheur: [
      "................",
      "....kkkkkkkk....",
      "...kEEEEEEEEk...",
      "..kEeeeeeeeeEk..",
      ".kkkkkkkkkkkkkk.",
      "..kbbbbbbbbbbk..",
      "..kbkkkbbbbbbk..",
      "..kbkekbbkkkbk..",
      "..kbkkkbbkBkbk..",
      "..kbbbbbbkBkbk..",
      "..kbbbbbbkBkbk..",
      "..kkkkkkkkkkkk..",
      "...kBk....kBk.k.",
      "...kBk....kBkkrk",
      "...kkk....kkk.k.",
      "................",
    ],
    cocos: [
      "................",
      ".....kkk.kkk....",
      "...kkgggkgggkk..",
      "..kggGGgggGGggk.",
      ".kgGkkgBBgkkGgk.",
      ".kGk.kgBbgk.kGk.",
      "..k...kbbk...k..",
      ".......kbk......",
      ".......kbk......",
      "......kbBk......",
      "......kbBk......",
      "......kbBk......",
      ".....kbBk.......",
      ".....kbBk.......",
      "....kdddddk.....",
      "................",
    ],
    port: [
      "................",
      "...k............",
      "...krrk.........",
      "...krrrk........",
      "...kRRk.........",
      "...k....kkkkkk..",
      "...k....kbbbbk..",
      "...k....kbBBbk..",
      ".kkkkkk.kbbbbk..",
      ".kbbbbk.kkkkkk..",
      ".kbBBbk.kMmmMk..",
      ".kbbbbk.kMmmMk..",
      "kkkkkkkkkkkkkkkk",
      "kbBbBbBbBbBbBbBk",
      "kkkkkkkkkkkkkkkk",
      ".kBk...kBk..kBk.",
    ],
    marche: [
      "................",
      ".kkkkkkkkkkkkkk.",
      "kriririririririk",
      "kriririririririk",
      ".kRkRkRkRkRkRkk.",
      "..k..........k..",
      "..k..........k..",
      "..k.kok.kgk..k..",
      "..k.kyk.kgk..k..",
      ".kkkkkkkkkkkkkk.",
      ".kbbbbbbbbbbbbk.",
      ".kbBBBBBBBBBBbk.",
      ".kbbbbbbbbbbbbk.",
      ".kbk........kbk.",
      ".kkk........kkk.",
      "................",
    ],
    hotel: [
      "......kkkk......",
      "....kkEEEEkk....",
      "..kkEEeeeeEEkk..",
      ".kkkkkkkkkkkkkk.",
      ".kllllllllllllk.",
      ".kleelleelleelk.",
      ".klEEllEEllEElk.",
      ".kllllllllllllk.",
      ".kleelleelleelk.",
      ".klEEllEEllEElk.",
      ".kllllllllllllk.",
      ".kleellkkleeelk.",
      ".klEEllkBllEElk.",
      ".klllllkBlllllk.",
      ".kkkkkkkkkkkkkk.",
      "................",
    ],
    aero: [
      "................",
      "................",
      "..........kk....",
      ".........kEk....",
      "........kEEk....",
      ".kk....kkkkk....",
      ".kEk..kiiiiikkk.",
      ".kEEkkiieieieiik",
      ".kkiiiiiiiiiiiik",
      "..kmmmmmmmmmmmk.",
      "...kkkkkkkkkkk..",
      "......kkiik.....",
      ".......kmmk.....",
      "........kk......",
      "................",
      "................",
    ],

    // ---- Repères du centre de l’île, un par palier ----
    tente: [
      "................",
      "................",
      "................",
      ".......kk.......",
      "......krok......",
      ".....krrook.....",
      "....krrroook....",
      "...krrrkkoook...",
      "..krrrkBBkoook..",
      ".krrrrkBBkooook.",
      "kkkkkkkkkkkkkkkk",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    puits: [
      "................",
      "...kkkkkkkkkk...",
      "..kRRRRRRRRRRk..",
      ".kRrrrrrrrrrrRk.",
      ".kkkkkkkkkkkkkk.",
      "...kBk....kBk...",
      "...kBk.kk.kBk...",
      "...kBk.kk.kBk...",
      "...kBk.kk.kBk...",
      ".kkkkkkkkkkkkkk.",
      ".kmmMmmMmmMmmmk.",
      ".kMmmmMmmmMmmMk.",
      ".kmmMmmmMmmmmmk.",
      ".kkkkkkkkkkkkkk.",
      "................",
      "................",
    ],
    clocher: [
      ".......kk.......",
      "......kyyk......",
      ".......kk.......",
      "......kRRk......",
      ".....kRrrRk.....",
      "....kRrrrrRk....",
      "...kkkkkkkkkk...",
      "....kwwwwwwk....",
      "....kwkyykwk....",
      "....kwkYYkwk....",
      "....kwwwwwwk....",
      "..kkkkkkkkkkkk..",
      "..kwwwwwwwwwwk..",
      "..kwkekwwkekwk..",
      "..kwkEkwwkEkwk..",
      "..kwwwwkkwwwwk..",
      "..kwwwwkBkwwwk..",
      "..kwwwwkBkwwwk..",
      "..kkkkkkkkkkkk..",
    ],
    phare: [
      ".......kk.......",
      "......kRRk......",
      ".....kkkkkk.....",
      ".....kyiiyk.....",
      ".....kyiiyk.....",
      "....kkkkkkkk....",
      ".....kwwwwk.....",
      ".....krrrrk.....",
      ".....krrrrk.....",
      "....kwwwwwwk....",
      "....kwwwwwwk....",
      "....krrrrrrk....",
      "....krrrrrrk....",
      "...kwwwwwwwwk...",
      "...kwwwkkwwwk...",
      "...krrrkBkrrk...",
      "...krrrkBkrrk...",
      "..kkkkkkkkkkkk..",
    ],
    palais: [
      ".......k........",
      ".......krrk.....",
      ".......krrrk....",
      ".......k........",
      "......kyk.......",
      ".....kyyyk......",
      "....kkkkkkk.....",
      "..kkwwwwwwwkk...",
      ".kwwwwwwwwwwwk..",
      "kkkkkkkkkkkkkkk.",
      ".kwkwkwkwkwkwk..",
      ".kwkwkwkwkwkwk..",
      ".kwkwkwkwkwkwk..",
      ".kwkwkwkkwkwkk..",
      ".kwkwkwkBkwkwk..",
      "kkkkkkkkkkkkkkk.",
      "kmmmmmmmmmmmmmk.",
      "kkkkkkkkkkkkkkk.",
    ],

    // ---- Habitant (les couleurs changent d’un habitant à l’autre) ----
    habitant: [
      "..kkk..",
      ".khhhk.",
      ".khppk.",
      ".kpppk.",
      "..kpk..",
      ".kccck.",
      "kpcccpk",
      ".kccck.",
      ".klklk.",
      ".kk.kk.",
    ],

    // ---- Améliorations (16 × 16) ----
    machette: [
      "................",
      "............kk..",
      "...........kmik.",
      "..........kmmik.",
      ".........kmmik..",
      "........kmmik...",
      ".......kmmik....",
      "......kmmik.....",
      ".....kmmik......",
      "....kkkkk.......",
      "...kBbk.........",
      "..kBbk..........",
      ".kBbk...........",
      ".kkk............",
      "................",
      "................",
    ],
    pirogue: [
      "................",
      "............k...",
      "...........kbk..",
      "..........kbk...",
      ".........kbk....",
      "........kbk.....",
      ".......kbk......",
      "......kbk.......",
      "kk...kbk......kk",
      "kbkkkkkkkkkkkkbk",
      "kbbbbbbbbbbbbbbk",
      ".kbBBBBBBBBBBbk.",
      "..kkkkkkkkkkkk..",
      ".....kkk........",
      "....kbbk........",
      ".....kk.........",
    ],
    intendant: [
      "................",
      ".....kkkkkk.....",
      "...kkkmmmmkkk...",
      "..kbbkkkkkkbbk..",
      "..kbwwwwwwwwbk..",
      "..kbwkkkwwwwbk..",
      "..kbwwwwwwwwbk..",
      "..kbwGkwkkkwbk..",
      "..kbwkGwwwwwbk..",
      "..kbwwwwwwwwbk..",
      "..kbwGkwkkkwbk..",
      "..kbwkGwwwwwbk..",
      "..kbwwwwwwwwbk..",
      "..kbbbbbbbbbbk..",
      "..kkkkkkkkkkkk..",
      "................",
    ],
    mairie: [
      "................",
      ".......kk.......",
      ".....kkEEkk.....",
      "...kkEEEEEEkk...",
      ".kkEEEEEEEEEEkk.",
      "kkkkkkkkkkkkkkkk",
      ".kwwwwwwwwwwwwk.",
      ".kwkkwkkwkkwkkk.",
      ".kwkkwkkwkkwkkk.",
      ".kwkkwkkwkkwkkk.",
      ".kwkkwkkwkkwkkk.",
      ".kwkkwkkwkkwkkk.",
      ".kwwwwwwwwwwwwk.",
      "kkkkkkkkkkkkkkkk",
      "kmmmmmmmmmmmmmmk",
      "kkkkkkkkkkkkkkkk",
    ],
    boussole: [
      "................",
      ".....kkkkkk.....",
      "...kkYyyyyYkk...",
      "..kYywwwwwwyYk..",
      ".kYwwwwrwwwwwYk.",
      ".kywwwwrrwwwwyk.",
      "kYwwwwrrrwwwwwYk",
      "kywwwwwkwwwwwwyk",
      "kywwwwwwmwwwwwyk",
      "kYwwwwwmmmwwwwYk",
      ".kywwwwmmwwwwyk.",
      ".kYwwwwmwwwwwYk.",
      "..kYywwwwwwyYk..",
      "...kkYyyyyYkk...",
      ".....kkkkkk.....",
      "................",
    ],

    // ---- Ressources, métiers et coffre ----
    poisson: [
      "...kkkkk....",
      ".kkEEEEEk.kk",
      "keikEEEEEkEk",
      "keeeeeeeeEEk",
      ".kmmmmmmk.kk",
      "..kkkkkk....",
    ],
    noix: [
      "...kkkk...",
      ".kkBBBBkk.",
      "kBBbBBBBBk",
      "kBbBBkBBBk",
      "kBBBBBkBBk",
      "kBBBBBBBBk",
      "kBBBBBBBBk",
      ".kBBBBBBk.",
      "..kkkkkk..",
    ],
    bois: [
      ".kkkkkkkkkkk..",
      "kbbbBbbbbbksk.",
      "kbBbbbbBbksdsk",
      "kbbbbBbbbksdsk",
      "kBbbbbbbBksdsk",
      "kbbBbbbbbbksk.",
      ".kkkkkkkkkkk..",
    ],
    marteau: [
      ".kkkkkkkk...",
      "kmmmmmmmmk..",
      "kMMMMMMMMk..",
      ".kkkkbkkk...",
      "....kbk.....",
      "....kbk.....",
      "....kbk.....",
      "....kBk.....",
      "....kBk.....",
      "....kBk.....",
      "....kkk.....",
    ],
    sac: [
      "....kkkk....",
      "....kbbk....",
      ".....kk.....",
      "...kkSSkk...",
      "..kSSSSSSk..",
      ".kSSSSSSSSk.",
      "kSSSkyykSSSk",
      "kSSSkyYkSSSk",
      "kSSSSkkSSSSk",
      "kdSSSSSSSSdk",
      ".kddddddddk.",
      "..kkkkkkkk..",
    ],
    coffre: [
      "..kkkkkkkkkkkk..",
      ".kbbbbbbbbbbbbk.",
      "kbbbbbbbbbbbbbbk",
      "kYbbbbbbbbbbbbYk",
      "kkkkkkkkkkkkkkkk",
      "kYbbbbbkkbbbbbYk",
      "kYbbbbkyykbbbbYk",
      "kYbbbbkyYkbbbbYk",
      "kYbbbbbkkbbbbbYk",
      "kYbbbbbbbbbbbbYk",
      "kYBBBBBBBBBBBBYk",
      "kkkkkkkkkkkkkkkk",
    ],
    balance: [
      ".......kk.......",
      "......kYYk......",
      ".kkkkkkYYkkkkkk.",
      ".kYYYYYYYYYYYYk.",
      ".kkkkkkYYkkkkkk.",
      ".k....kYYk....k.",
      "k.k...kYYk...k.k",
      "k..k..kYYk..k..k",
      "kkkkk.kYYk.kkkkk",
      "kyyyk.kYYk.kyyyk",
      ".kkk..kYYk..kkk.",
      "......kYYk......",
      "....kkkYYkkk....",
      "...kYYYYYYYYk...",
      "...kkkkkkkkkk...",
      "................",
    ],
    trophee: [
      "..kkkkkkkkkk..",
      "kkkyyyyyyyYkkk",
      "kyky.yyyyyYkyk",
      "kyky.yyyyyYkyk",
      ".kyk.yyyyYkyk.",
      "..kkyyyyyYkk..",
      "....kyyyYk....",
      ".....kyYk.....",
      "......kk......",
      ".....kYYk.....",
      "....kkkkkk....",
      "...kbbbbbbk...",
      "...kBBBBBBk...",
      "...kkkkkkkk...",
    ],
    roue: [
      "....kkkkkk....",
      "..kkrrwwyykk..",
      ".krrrrwwyyyyk.",
      ".krrrkwwkyyyk.",
      "kttttkkkkggggk",
      "kttttkiikggggk",
      "kttttkiikggggk",
      "kttttkkkkggggk",
      ".kooukkkkulllk",
      ".koooukkulllk.",
      "..kkoouullkk..",
      "....kkkkkk....",
    ],
    etoile: [
      "...k...",
      "..kyk..",
      "kkkyykk",
      "kyyyyyk",
      ".kyyyk.",
      ".kykyk.",
      ".kk.kk.",
    ],
    livre: [
      ".kkkkkkkkkk.",
      "kEEEEEEEEEEk",
      "kEyyyyyyyyEk",
      "kEEEEEEEEEEk",
      "kEEyyyyyyEEk",
      "kEEEEEEEEEEk",
      "kEEEEEEEEEEk",
      "kwwwwwwwwwwk",
      "kmmmmmmmmmmk",
      ".kkkkkkkkkk.",
    ],
    totem: [
      "..kkkkkk..",
      ".kggggggk.",
      "kgkiggikgk",
      "kggggggggk",
      ".kgrrrrgk.",
      "..kkkkkk..",
      ".kooooook.",
      "kokikkikok",
      "kooooooook",
      ".kokkkkok.",
      "..kkkkkk..",
      ".kbbbbbbk.",
      "kbkibbikbk",
      "kbbbbbbbbk",
      ".kbbrrbbk.",
      "..kkkkkk..",
    ],
    volcan: [
      "......kkkk......",
      ".....krrook.....",
      ".....kroork.....",
      "....kMkrrkMk....",
      "....kMMkkMMk....",
      "...kMMMMMMMMk...",
      "...kMmMMMMmMk...",
      "..kMMMMrMMMMMk..",
      "..kMmMMrMMmMMk..",
      ".kMMMMMoMMMMMMk.",
      ".kMmMMMMMMMmMMk.",
      "kMMMMMMMMMMMMMMk",
      "kGgGgGgGgGgGgGgk",
      "kkkkkkkkkkkkkkkk",
    ],
    hausse: [
      "...k...",
      "..kgk..",
      ".kgggk.",
      "kgggggk",
      "kkkkkkk",
    ],
    baisse: [
      "kkkkkkk",
      "krrrrrk",
      ".krrrk.",
      "..krk..",
      "...k...",
    ],

    // ---- Objets et décor ----
    piece: [
      "..kkkk..",
      ".kyyyyk.",
      "kyywyyYk",
      "kyywyyYk",
      "kyyyyyYk",
      "kyyyyyYk",
      ".kYYYYk.",
      "..kkkk..",
    ],
    bouteille: [
      ".....kk.....",
      ".....kbk....",
      "....kkkk....",
      "....kttk....",
      "...kttitk...",
      "..kttwwttk..",
      "..ktwkkwtk..",
      "..ktwwwwtk..",
      "..ktwkkwtk..",
      "..kttwwttk..",
      "..kTttttTk..",
      "...kkkkkk...",
    ],
    bateau: [
      "......k.........",
      "......kk........",
      "......kwk.......",
      "......kwwk......",
      "......kwwwk.....",
      "......kwrwwk....",
      "......kwwrwwk...",
      "......kwwwwwwk..",
      "......kkkkkkkkk.",
      "......k.........",
      "kk....k.......kk",
      "kRkkkkkkkkkkkkRk",
      "kRrrrrrrrrrrrrRk",
      ".kRiRiRiRiRiRRk.",
      "..kkkkkkkkkkkk..",
      "................",
    ],
    soleil: [
      ".......kk.......",
      "...k...ky...k...",
      "....k.......k...",
      ".....kkkkkk.....",
      "....kyyyyyyk....",
      "...kyyyyyyyYk...",
      "kk.kyyyyyyyYk.kk",
      "yy.kyyyyyyyYk.yy",
      "...kyyyyyyyYk...",
      "...kyyyyyyYYk...",
      "....kYYYYYYk....",
      ".....kkkkkk.....",
      "....k.......k...",
      "...k...yk...k...",
      ".......kk.......",
      "................",
    ],
    lune: [
      "....kkkk....",
      "..kkwwwwk...",
      ".kwwwwkk....",
      ".kwwwk......",
      "kwwwk.......",
      "kwwwk.......",
      "kwwwk.......",
      "kwwwwk......",
      ".kwwwwkk....",
      ".kmwwwwwkk..",
      "..kkmmwwwwk.",
      "....kkkkkk..",
    ],
    nuage: [
      "..........kkkk..........",
      "........kkwwwwkk........",
      "...kkkkkwwwwwwwwk.......",
      "..kwwwwwwwwwwwwwwkkkk...",
      ".kwwwwwwwwwwwwwwwwwwwk..",
      "kwwwwwwwwwwwwwwwwwwwwwk.",
      "kmwwwwwwwwwwwwwwwwwwwmk.",
      ".kmmmmwwwwwwwwwwmmmmmk..",
      "..kkkkmmmmmmmmmmkkkkk...",
      "......kkkkkkkkkk........",
    ],
    vague: [
      "................",
      "................",
      "....iiii........",
      "..ii....ii......",
      ".i........i.....",
      "................",
    ],
    engrenage: [
      "....kk..",
      ".kk.kmk.",
      "kmkkmmk.",
      ".kmmMmmk",
      "kmmM.Mmk",
      ".kmmMmk.",
      "..kmkkk.",
      "...k....",
    ],
  };

  // Variante dorée du poisson (pêche à la ligne), obtenue en changeant ses couleurs.
  SPRITES.poisson_dore = SPRITES.poisson.map((row) => row.replace(/E/g, "Y").replace(/e/g, "y").replace(/m/g, "w"));

  // Couleurs des habitants : cheveux (h), peau (p), haut (c), short (l).
  const VILLAGER_LOOKS = [
    { h: "h", p: "p", c: "r", l: "E" },
    { h: "H", p: "p", c: "t", l: "B" },
    { h: "h", p: "q", c: "y", l: "n" },
    { h: "k", p: "Q", c: "g", l: "b" },
    { h: "R", p: "p", c: "u", l: "M" },
    { h: "h", p: "q", c: "o", l: "E" },
    { h: "k", p: "q", c: "l", l: "G" },
    { h: "H", p: "Q", c: "e", l: "R" },
  ];

  const cache = {};

  function draw(rows, swap) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(...rows.map((r) => r.length));
    canvas.height = rows.length;
    const ctx = canvas.getContext("2d");
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        let ch = row[x];
        if (ch === ".") continue;
        if (swap && swap[ch]) ch = swap[ch];
        ctx.fillStyle = PALETTE[ch] || "#ff00ff"; // rose vif = lettre inconnue
        ctx.fillRect(x, y, 1, 1);
      }
    });
    return canvas;
  }

  // Image d’un dessin (adresse utilisable dans <img src>). look = n° de tenue pour les habitants.
  function url(name, look) {
    const key = name + "|" + (look === undefined ? "" : look);
    if (!cache[key]) {
      const swap = look === undefined ? null : VILLAGER_LOOKS[look % VILLAGER_LOOKS.length];
      cache[key] = draw(SPRITES[name], swap).toDataURL();
    }
    return cache[key];
  }

  function size(name) {
    const rows = SPRITES[name];
    return { w: Math.max(...rows.map((r) => r.length)), h: rows.length };
  }

  // ---- L’île, dessinée pixel par pixel ----
  const ISLAND = { w: 112, h: 80, cx: 56, cy: 38, rx: 50, ry: 28, side: 5 };

  function seeded(seed) {
    return () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
  }

  const inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

  function drawIsland(canvas) {
    const { w, h, cx, cy, rx, ry, side } = ISLAND;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    const rand = seeded(42);
    const px = (x, y, ch) => { ctx.fillStyle = PALETTE[ch]; ctx.fillRect(x, y, 1, 1); };

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const top = inEllipse(x + 0.5, y + 0.5, cx, cy, rx, ry);
        const edge = top && !inEllipse(x + 0.5, y + 0.5, cx, cy, rx - 1.5, ry - 1.5);
        const cliff = !top && inEllipse(x + 0.5, y + 0.5, cx, cy + side, rx, ry);
        const foam = !top && !cliff && inEllipse(x + 0.5, y + 0.5, cx, cy + side, rx + 3, ry + 3);
        const shallow = !top && !cliff && !foam && inEllipse(x + 0.5, y + 0.5, cx, cy + side, rx + 9, ry + 8);
        if (edge) px(x, y, "w");
        else if (top) px(x, y, rand() < 0.06 ? "S" : "s");
        else if (cliff) px(x, y, y > cy + ry + side - 2 ? "B" : rand() < 0.15 ? "b" : "d");
        else if (foam) { if ((x + y) % 3 !== 0) px(x, y, "w"); }
        else if (shallow) px(x, y, "t");
      }
    }
    // Touffes d’herbe et petits cailloux
    [[24, 24, 9, 5], [86, 28, 7, 4], [40, 52, 6, 3], [74, 50, 8, 4]].forEach(([gx, gy, grx, gry]) => {
      for (let y = gy - gry; y <= gy + gry; y++) {
        for (let x = gx - grx; x <= gx + grx; x++) {
          if (inEllipse(x + 0.5, y + 0.5, gx, gy, grx, gry) && inEllipse(x, y, cx, cy, rx - 4, ry - 4)) {
            px(x, y, rand() < 0.25 ? "G" : "g");
          }
        }
      }
    });
    for (let n = 0; n < 14; n++) {
      const x = Math.round(cx + (rand() - 0.5) * rx * 1.6);
      const y = Math.round(cy + (rand() - 0.5) * ry * 1.6);
      if (inEllipse(x, y, cx, cy, rx - 4, ry - 4)) px(x, y, n % 3 ? "S" : "M");
    }
  }

  // Emplacements des bâtiments sur l’île, du centre vers le bord (le centre est réservé au repère).
  function buildingSlots() {
    const { cx, cy, rx, ry } = ISLAND;
    const slots = [];
    for (let y = cy - ry + 14; y <= cy + ry - 2; y += 9) {
      const shift = ((y - cy) / 9) % 2 ? 6 : 0;
      for (let x = cx - rx + 10 + shift; x <= cx + rx - 10; x += 13) {
        const inside = inEllipse(x, y - 4, cx, cy, rx - 9, ry - 6);
        const center = Math.abs(x - cx) < 13 && y > cy - 10 && y < cy + 12;
        if (inside && !center) slots.push({ x, y });
      }
    }
    return slots.sort((a, b) => Math.hypot(a.x - cx, (a.y - cy) * 1.7) - Math.hypot(b.x - cx, (b.y - cy) * 1.7));
  }

  // Le dessin sous forme de canvas (pour le dessiner dans un autre canvas, comme la roue).
  const canvasOf = (name, look) =>
    draw(SPRITES[name], look === undefined ? null : VILLAGER_LOOKS[look % VILLAGER_LOOKS.length]);

  window.PixelArt = { PALETTE, SPRITES, VILLAGER_LOOKS, ISLAND, url, size, canvasOf, drawIsland, buildingSlots, inEllipse, seeded };
})();
