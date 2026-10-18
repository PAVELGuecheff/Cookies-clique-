(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // 1. Données du jeu — modifier ici pour équilibrer
  // ---------------------------------------------------------------------------

  // cost : prix de départ, cps : pièces par seconde, pop : habitants attirés
  const BUILDINGS = [
    { id: "hutte",   name: "Hutte de palmes",    cost: 15,       cps: 0.1,  pop: 1 },
    { id: "pecheur", name: "Cabane de pêcheur",  cost: 100,      cps: 1,    pop: 2 },
    { id: "cocos",   name: "Cocoteraie",         cost: 1100,     cps: 8,    pop: 5 },
    { id: "port",    name: "Petit port",         cost: 12000,    cps: 47,   pop: 15 },
    { id: "marche",  name: "Marché",             cost: 130000,   cps: 260,  pop: 40 },
    { id: "hotel",   name: "Hôtel de plage",     cost: 1400000,  cps: 1400, pop: 120 },
    { id: "aero",    name: "Aéroport",           cost: 20000000, cps: 7800, pop: 400 },
  ];
  const PRICE_GROWTH = 1.15; // +15 % à chaque achat

  // unlock : condition pour voir l’amélioration (earned = pièces gagnées au total, pop = habitants,
  // building + owned = nombre d’exemplaires d’un bâtiment).
  // effect : click (clic ×), clickFromProd (part de la production ajoutée au clic),
  // building (production de ce bâtiment ×2), auto (achat automatique), popBonus (bonus par habitant).
  const UPGRADES = [
    { id: "machette",  icon: "machette", name: "Machette",  info: "Clic ×2", cost: 100, unlock: { earned: 50 }, effect: { click: 2 } },
    { id: "pirogue",   icon: "pirogue", name: "Pirogue",   info: "Clic ×2", cost: 1000, unlock: { earned: 500 }, effect: { click: 2 } },
    { id: "intendant", icon: "intendant", name: "Intendant", info: "Débloque l’achat automatique", cost: 5000, unlock: { earned: 2000 }, effect: { auto: true } },
    { id: "mairie",    icon: "mairie", name: "Mairie",    info: "+1 % de production par 10 habitants", cost: 25000, unlock: { pop: 100 }, effect: { popBonus: 0.001 } },
    { id: "negociant", icon: "balance", name: "Négociant", info: "Vend au marché tout seul (commission 10 %)", cost: 500000, unlock: { earned: 200000 }, effect: { autoSell: true } },
    { id: "boussole",  icon: "boussole", name: "Boussole",  info: "+1 % de la prod. par clic", cost: 50000, unlock: { earned: 20000 }, effect: { clickFromProd: 0.01 } },
  ];

  // Deux améliorations par bâtiment : sa production ×2 à 10 exemplaires, puis encore ×2 à 25.
  const BUILDING_UPGRADES = {
    hutte:   ["Toits tressés", "Hamacs"],
    pecheur: ["Filets renforcés", "Chalutier"],
    cocos:   ["Engrais de corail", "Presse à coco"],
    port:    ["Grue", "Phare"],
    marche:  ["Étals couverts", "Grande foire"],
    hotel:   ["Piscine", "Spa"],
    aero:    ["Piste longue", "Vols charters"],
  };
  const BUILDING_UPGRADE_STEPS = [{ owned: 10, costMult: 20 }, { owned: 25, costMult: 200 }];
  BUILDINGS.forEach((b) => {
    BUILDING_UPGRADES[b.id].forEach((name, tier) => {
      const step = BUILDING_UPGRADE_STEPS[tier];
      UPGRADES.push({
        id: `${b.id}-${tier + 1}`, icon: b.id, badge: "×2", name, info: `${b.name} : production ×2`,
        cost: b.cost * step.costMult, unlock: { building: b.id, owned: step.owned }, effect: { building: b.id },
      });
    });
  });
  UPGRADES.sort((a, b) => a.cost - b.cost);
  const MAX_AUTO_BUYS_PER_SECOND = 20;
  const MAX_UPGRADES_SHOWN = 6;

  const STAGES = [
    { pop: 0,      landmark: "cocos", title: "Îlot désert" },
    { pop: 10,     landmark: "tente", title: "Campement" },
    { pop: 100,    landmark: "puits", title: "Village" },
    { pop: 1000,   landmark: "clocher", title: "Bourg" },
    { pop: 10000,  landmark: "phare", title: "Ville" },
    { pop: 100000, landmark: "palais", title: "Île-nation" },
  ];

  const SAVE_KEY = "cookies-clique-save";
  const SAVE_EVERY_MS = 10000;
  const OFFLINE_MAX_S = 8 * 3600;

  // Événements qui n’arrivent que quand le joueur est sur la page (délais en secondes).
  const BOTTLE = { firstDelay: 20, minDelay: 40, maxDelay: 90, lifetime: 10 };
  const BOAT = { firstDelay: 60, minDelay: 120, maxDelay: 240 };
  const FRENZY = { mult: 7, seconds: 30 };      // production ×7 pendant 30 s
  const GOLD_CLICK = { mult: 10, seconds: 15 }; // clic ×10 pendant 15 s
  const COMBO_WINDOW_MS = 400; // délai max entre deux clics pour garder le combo
  const COMBO_MAX = 50;        // 50 clics rapides = clic ×2
  // Série de bouteilles : en attraper 3 d’affilée (sans en rater) déclenche une super-frénésie.
  const BOTTLE_STREAK = { needed: 3, mult: 20, seconds: 20 };

  // Roue du jour : un tour gratuit par jour. weight = chances relatives de tomber sur la case.
  const WHEEL = [
    { id: "tresor",   name: "Trésor : 30 min de production",  icon: "piece",     weight: 30 },
    { id: "frenesie", name: "Frénésie ×7 pendant 60 s",       icon: "bouteille", weight: 20 },
    { id: "clicor",   name: "Clic d’or ×10 pendant 30 s",     icon: "machette",  weight: 15 },
    { id: "stocks",   name: "Tous les stocks remplis",        icon: "poisson",   weight: 15 },
    { id: "gros",     name: "Gros trésor : 2 h de production", icon: "coffre",    weight: 8 },
    { id: "super",    name: "Super-frénésie ×20 pendant 30 s", icon: "soleil",    weight: 7 },
  ];

  // Succès : chacun débloqué donne +1 % de production pour toujours.
  const ACHIEVEMENT_BONUS = 0.01;
  const ACHIEVEMENTS = [
    { id: "clic1",      name: "Premier pas",         desc: "Toucher l’île une fois",                test: () => state.stats.clicks >= 1 },
    { id: "clic1000",   name: "Main de fer",          desc: "Toucher l’île 1 000 fois",              test: () => state.stats.clicks >= 1000 },
    { id: "combo",      name: "Frénétique",           desc: "Atteindre un combo ×2",                 test: () => state.stats.bestCombo >= COMBO_MAX },
    { id: "hutte25",    name: "Quartier de huttes",   desc: "Avoir 25 huttes",                       test: () => (state.owned.hutte || 0) >= 25 },
    { id: "pecheur25",  name: "Flotte de pêche",      desc: "Avoir 25 cabanes de pêcheur",           test: () => (state.owned.pecheur || 0) >= 25 },
    { id: "cocos25",    name: "Palmeraie",            desc: "Avoir 25 cocoteraies",                  test: () => (state.owned.cocos || 0) >= 25 },
    { id: "port10",     name: "Armateur",             desc: "Avoir 10 ports",                        test: () => (state.owned.port || 0) >= 10 },
    { id: "tous",       name: "Bâtisseur complet",    desc: "Avoir au moins un bâtiment de chaque",  test: () => BUILDINGS.every((b) => (state.owned[b.id] || 0) > 0) },
    { id: "village",    name: "Village",              desc: "Atteindre 100 habitants",               test: () => population() >= 100 },
    { id: "ville",      name: "Ville",                desc: "Atteindre 10 000 habitants",            test: () => population() >= 10000 },
    { id: "nation",     name: "Île-nation",           desc: "Atteindre 100 000 habitants",           test: () => population() >= 100000 },
    { id: "million",    name: "Millionnaire",         desc: "Gagner 1 million de pièces",            test: () => state.totalEarned >= 1e6 },
    { id: "milliard",   name: "Milliardaire",         desc: "Gagner 1 milliard de pièces",           test: () => state.totalEarned >= 1e9 },
    { id: "bouteilles", name: "Collectionneur",       desc: "Attraper 10 bouteilles",                test: () => state.stats.bottles >= 10 },
    { id: "serie",      name: "Trois d’affilée",      desc: "Déclencher une super-frénésie",         test: () => (state.stats.superFrenzies || 0) >= 1 },
    { id: "touristes",  name: "Accueil des touristes", desc: "Accueillir 10 bateaux de touristes",   test: () => state.stats.boats >= 10 },
    { id: "commandes",  name: "Fournisseur officiel", desc: "Livrer 5 commandes",                    test: () => (state.stats.orders || 0) >= 5 },
    { id: "commerce",   name: "Commerçant",           desc: "Gagner 100 000 pièces au marché",       test: () => (state.stats.sources.marche || 0) >= 1e5 },
    { id: "ventre",     name: "Ventre plein",         desc: "Avoir des habitants bien nourris",      test: () => foodActive() && state.satiety >= 80 },
    { id: "emploi",     name: "Plein emploi",         desc: "Donner un métier à tous les habitants", test: () => freeShare() < 0.001 },
    { id: "coffre",     name: "Coffre rempli",        desc: "Remplir le coffre",                     test: () => state.bank >= bankCapacity() - 1 },
    { id: "nuit",       name: "Nuit blanche",         desc: "Jouer entre 20 h et 7 h",               test: () => document.documentElement.classList.contains("night") },
    { id: "dore",       name: "Pêche miraculeuse",    desc: "Attraper un poisson doré",              test: () => (state.stats.goldFish || 0) >= 1 },
    { id: "voyageur",   name: "Grand voyageur",       desc: "Réussir 5 expéditions",                 test: () => (state.stats.expeditions || 0) >= 5 },
    { id: "niveau",     name: "Chef-d’œuvre",         desc: "Monter un bâtiment au niveau 5",        test: () => BUILDINGS.some((b) => level(b) >= LEVELS.max) },
    { id: "celebre",    name: "Tapis rouge",          desc: "Accueillir un habitant célèbre",        test: () => (state.stats.celebs || 0) >= 1 },
    { id: "vip",        name: "Salon VIP",            desc: "Garder 3 habitants célèbres",           test: () => state.celebs.length >= CELEBS.slots },
    { id: "chance",     name: "Chanceux",             desc: "Tourner la roue 7 fois",                test: () => (state.stats.spins || 0) >= 7 },
  ];

  // Synergies : chaque exemplaire de « from » augmente la production de « to ».
  const SYNERGIES = [
    { from: "cocos",  to: "hutte",   bonus: 0.03 }, // l’ombre des cocotiers : huttes +3 % par cocoteraie
    { from: "port",   to: "pecheur", bonus: 0.05 },
    { from: "marche", to: "cocos",   bonus: 0.04 },
    { from: "hotel",  to: "port",    bonus: 0.03 },
    { from: "aero",   to: "hotel",   bonus: 0.02 },
    { from: "aero",   to: "marche",  bonus: 0.02 },
  ];

  // Métiers : on répartit les habitants par tranches de 10 %. effect = bonus quand 100 % y travaillent.
  const JOBS = [
    { id: "pecheurs",   name: "Pêcheurs",   icon: "poisson", effect: 0.5,  info: "production de pièces" },
    { id: "cueilleurs", name: "Cueilleurs", icon: "noix",    effect: 2,    info: "récolte de ressources" },
    { id: "batisseurs", name: "Bâtisseurs", icon: "marteau", effect: -0.3, info: "prix des bâtiments" },
    { id: "marchands",  name: "Marchands",  icon: "sac",     effect: 1.5,  info: "ventes au marché et intérêts du coffre" },
  ];
  const JOB_STEP = 10;

  // Ressources : récoltées par un bâtiment, stockées (stock limité) puis vendues au marché.
  const RESOURCES = [
    { id: "bois",    name: "Bois flotté",  plural: "bois flotté",  from: "hutte",   perSecond: 0.05, price: 2 },
    { id: "poisson", name: "Poisson",      plural: "poissons",     from: "pecheur", perSecond: 0.2,  price: 6 },
    { id: "noix",    name: "Noix de coco", plural: "noix de coco", from: "cocos",   perSecond: 0.3,  price: 12 },
  ];
  const STORAGE = { base: 50, perBuilding: 25 };
  const MARKET = { changeEvery: 30, min: 0.4, max: 2.2 }; // les prix varient de ×0,4 à ×2,2
  const DEMAND_PER_HABITANT = 0.01; // +1 % de prix de vente par habitant (plus d’acheteurs)
  // Vendeur automatique (amélioration « Négociant ») : il vend quand le prix atteint le seuil choisi,
  // ou quand le stock est plein, et garde une commission.
  const AUTO_SELL = { commission: 0.1, thresholds: [1, 1.2, 1.5, 1.8], keeps: [0, 0.25, 0.5] };

  // Nourriture : dès la première cabane de pêcheur, chaque habitant mange du poisson, puis des noix
  // de coco s’il n’y a plus de poisson. La satiété rejoint la part de besoins couverts en ~1 minute.
  const FOOD = { perHabitantPerMinute: 1, foods: ["poisson", "noix"], catchUpSeconds: 60 };
  const SATIETY_LEVELS = [
    { min: 80, mult: 0.1,  label: "bien nourris", effect: "production +10\u00a0%" },
    { min: 30, mult: 0,    label: "rassasiés",    effect: "pas de bonus" },
    { min: 0,  mult: -0.2, label: "affamés",      effect: "production −20\u00a0%" },
  ];

  // Niveaux de bâtiment : à partir de 10 exemplaires, on améliore tout un type (niveau 1 à 5).
  // Chaque niveau multiplie la production de ce type par 1,5. Prix = prix de départ × costMult.
  const LEVELS = { max: 5, mult: 1.5, unlockCount: 10, costMult: [100, 1000, 10000, 100000] };

  // Habitants célèbres : un visiteur passe de temps en temps ; on peut en garder 3 à la fois.
  const CELEBS = { minPop: 50, firstDelay: 180, minDelay: 480, maxDelay: 900, decide: 120, slots: 3 };
  const CELEBRITIES = [
    { id: "capitaine",  name: "Capitaine Marlin",  look: 0, info: "Bateaux de touristes ×2",            effect: { boat: 1 } },
    { id: "inventrice", name: "Ada l’inventrice",  look: 4, info: "Production +15\u00a0%",               effect: { prod: 0.15 } },
    { id: "chef",       name: "Chef Coco",         look: 2, info: "Les habitants mangent 30\u00a0% de moins", effect: { food: -0.3 } },
    { id: "marchande",  name: "Marchande Perle",   look: 6, info: "Prix de vente +25\u00a0%",           effect: { sell: 0.25 } },
    { id: "architecte", name: "Archi Bâtisse",     look: 5, info: "Bâtiments 10\u00a0% moins chers",     effect: { price: -0.1 } },
    { id: "vieuxloup",  name: "Vieux Loup",        look: 3, info: "Pêche ×2",                            effect: { fish: 1 } },
    { id: "banquiere",  name: "Banquière Doublon", look: 7, info: "Capacité du coffre ×2",               effect: { bank: 1 } },
    { id: "chanteuse",  name: "Lola la chanteuse", look: 1, info: "Bouteilles 40\u00a0% plus fréquentes", effect: { bottle: -0.4 } },
  ];

  // Pêche à la ligne : un mini-jeu de réflexe, utilisable toutes les 45 secondes.
  const FISHING = {
    cooldown: 45,
    zoneWidth: 0.2,       // zone verte : 20 % de la barre
    goldWidth: 0.06,      // centre doré : 6 %
    speed: 0.9,           // le curseur traverse la barre en un peu plus d’une seconde
    goldPriceMult: 100,   // poisson doré = 100 fois le prix d’un poisson
    silverStock: 0.3,     // poisson argenté = un banc qui remplit 30 % du stock
  };

  // Routes commerciales : on envoie tout le stock d’une ressource vers une autre île.
  const ROUTES = [
    { id: "cotiere",   name: "Route côtière",  minutes: 10,  risk: 0,    mult: 1.5 },
    { id: "large",     name: "Grand large",    minutes: 30,  risk: 0.15, mult: 3 },
    { id: "lointaine", name: "Îles lointaines", minutes: 120, risk: 0.3,  mult: 6 },
  ];
  const EXPEDITION_MIN_LOAD = 10;

  // Commandes des navires marchands : livrer une quantité avant la fin du délai, payée 2 à 3 fois le prix.
  const ORDERS = { firstDelay: 90, minDelay: 180, maxDelay: 360, duration: 300, minMult: 2, maxMult: 3 };

  // Coffre : les pièces placées rapportent des intérêts, jusqu’à une heure de production.
  const BANK = { ratePerMinute: 0.01, capacityHours: 1, minCapacity: 1000 };

  // Onglets de la boutique et ce qu’il faut pour les débloquer.
  const TABS = [
    { id: "build",  name: "Construire" },
    { id: "jobs",   name: "Métiers", unlockText: "à 10 habitants", unlocked: () => population() >= 10 },
    { id: "market", name: "Marché",  unlockText: "avec une cabane de pêcheur", unlocked: () => (state.owned.pecheur || 0) > 0 },
    { id: "bank",   name: "Coffre",  unlockText: "après 5 000 pièces gagnées", unlocked: () => state.totalEarned >= 5000 },
    { id: "stats",  name: "Stats" },
  ];

  // Sources de pièces suivies dans l’onglet Stats.
  const SOURCES = [
    { id: "batiments",  name: "Bâtiments",             icon: "hutte" },
    { id: "clics",      name: "Clics",                 icon: "piece" },
    { id: "marche",     name: "Marché",                icon: "sac" },
    { id: "evenements", name: "Bouteilles et bateaux", icon: "bouteille" },
    { id: "commandes",  name: "Commandes livrées",     icon: "bateau" },
    { id: "expeditions", name: "Routes commerciales",  icon: "boussole" },
    { id: "peche",      name: "Pêche à la ligne",      icon: "poisson_dore" },
    { id: "coffre",     name: "Intérêts du coffre",    icon: "coffre" },
  ];

  // ---------------------------------------------------------------------------
  // 2. État de la partie
  // ---------------------------------------------------------------------------

  function newState() {
    return {
      coins: 0, totalEarned: 0, owned: {}, upgrades: {}, stage: 0, savedAt: Date.now(),
      auto: {},   // bâtiments en achat automatique
      buyMode: 1, // achat par 1, 10 ou "max"
      jobs: { pecheurs: 0, cueilleurs: 0, batisseurs: 0, marchands: 0 }, // en %
      res: { bois: 0, poisson: 0, noix: 0 },
      market: { bois: { f: 1, trend: 0 }, poisson: { f: 1, trend: 0 }, noix: { f: 1, trend: 0 } },
      bank: 0,
      autoSell: {
        bois: { on: false, min: 1.2, keep: 0 }, poisson: { on: false, min: 1.2, keep: 0 }, noix: { on: false, min: 1.2, keep: 0 },
      },
      satiety: 100, // en %
      bottleStreak: 0,    // bouteilles attrapées d’affilée
      lastSpin: "",       // date du dernier tour de roue
      achievements: {},   // succès débloqués
      fishReadyAt: 0,     // pêche à la ligne de nouveau possible à partir de (Date.now)
      expedition: null,   // bateau en route : { route, res, qty, value, returnAt }
      expeditionRes: "poisson", // ressource choisie pour la prochaine expédition
      levels: {},     // niveau de chaque type de bâtiment (1 par défaut)
      celebs: [],     // habitants célèbres présents (identifiants)
      visitor: null,  // visiteur célèbre en attente : { id, expiresAt }
      order: null,  // commande en cours : { res, qty, reward, expiresAt }
      autoSellTotal: 0,
      autoMode: "cheap", // l’intendant achète le moins cher ("cheap") ou le plus rentable ("best")
      stats: {
        sources: { batiments: 0, clics: 0, marche: 0, evenements: 0, commandes: 0, coffre: 0 },
        clicks: 0, bestCombo: 0, bottles: 0, boats: 0, orders: 0, playTime: 0, superFrenzies: 0, spins: 0, goldFish: 0, expeditions: 0, shipwrecks: 0, celebs: 0,
      },
      tabsSeen: { build: true },
    };
  }
  let state = newState();

  // Bonus temporaires : ils ne sont pas sauvegardés.
  const buffs = { prod: { mult: 1, until: 0 }, click: { mult: 1, until: 0 } };
  let combo = 0;
  let lastClickAt = 0;

  // ---------------------------------------------------------------------------
  // 3. Calculs
  // ---------------------------------------------------------------------------

  const count = (b) => state.owned[b.id] || 0;
  const jobShare = (id) => (state.jobs[id] || 0) / 100;
  const jobEffect = (id) => jobShare(id) * JOBS.find((j) => j.id === id).effect;
  // Somme d’un effet des habitants célèbres présents (ex. celebEffect("sell") = +0,25 avec la marchande).
  const celebEffect = (key) => state.celebs.reduce((sum, id) => {
    const celeb = CELEBRITIES.find((c) => c.id === id);
    return sum + ((celeb && celeb.effect[key]) || 0);
  }, 0);
  const level = (b) => state.levels[b.id] || 1;
  const levelCost = (b) => b.cost * LEVELS.costMult[level(b) - 1];
  const freeShare = () => 1 - JOBS.reduce((sum, j) => sum + jobShare(j.id), 0);
  // Les bâtisseurs font baisser les prix.
  const unitPrice = (b, extra) =>
    Math.ceil(b.cost * Math.pow(PRICE_GROWTH, count(b) + extra) * (1 + jobEffect("batisseurs")) * (1 + celebEffect("price")));
  const population = () => BUILDINGS.reduce((sum, b) => sum + b.pop * count(b), 0);
  const ownedUpgrades = () => UPGRADES.filter((u) => state.upgrades[u.id]);

  // Prix total pour acheter qty bâtiments d’un coup (chaque exemplaire coûte 15 % de plus).
  function priceFor(b, qty) {
    let total = 0;
    for (let k = 0; k < qty; k++) total += unitPrice(b, k);
    return total;
  }

  // Combien d’exemplaires on peut s’offrir avec les pièces actuelles.
  function maxAffordable(b) {
    let qty = 0;
    let total = 0;
    while (qty < 1000 && total + unitPrice(b, qty) <= state.coins) total += unitPrice(b, qty++);
    return qty;
  }

  const buyQty = (b) => (state.buyMode === "max" ? Math.max(1, maxAffordable(b)) : state.buyMode);

  // Production d’un exemplaire, avec ses améliorations (×2 chacune).
  const synergyBonus = (b) => SYNERGIES.reduce((sum, syn) =>
    sum + (syn.to === b.id ? syn.bonus * (state.owned[syn.from] || 0) : 0), 0);
  const buildingCps = (b) =>
    b.cps * ownedUpgrades().reduce((m, u) => (u.effect.building === b.id ? m * 2 : m), 1) * (1 + synergyBonus(b))
    * Math.pow(LEVELS.mult, level(b) - 1);
  const popBonus = () => ownedUpgrades().reduce((sum, u) => sum + (u.effect.popBonus || 0), 0) * population();
  const perSecond = () => BUILDINGS.reduce((sum, b) => sum + buildingCps(b) * count(b), 0)
    * (1 + popBonus()) * (1 + jobEffect("pecheurs")) * (1 + satietyMult()) * (1 + achievementBonus())
    * (1 + celebEffect("prod"));
  const achievementBonus = () => ACHIEVEMENTS.filter((a) => state.achievements[a.id]).length * ACHIEVEMENT_BONUS;

  // Nourriture
  const foodActive = () => (state.owned.pecheur || 0) > 0;
  const foodNeed = () => (population() * FOOD.perHabitantPerMinute * (1 + celebEffect("food"))) / 60; // par seconde
  const satietyLevel = () => SATIETY_LEVELS.find((level) => state.satiety >= level.min);
  const satietyMult = () => (foodActive() ? satietyLevel().mult : 0);

  // Ressources : la récolte suit les améliorations et synergies de son bâtiment.
  const buildingOf = (r) => BUILDINGS.find((b) => b.id === r.from);
  function resourceRate(r) {
    const b = buildingOf(r);
    return r.perSecond * count(b) * (buildingCps(b) / b.cps) * (1 + jobEffect("cueilleurs"))
      * (r.id === "poisson" ? 1 + celebEffect("fish") : 1);
  }
  const storage = (r) => STORAGE.base + STORAGE.perBuilding * count(buildingOf(r));
  const sellPrice = (r) => r.price * state.market[r.id].f * (1 + population() * DEMAND_PER_HABITANT)
    * (1 + jobEffect("marchands")) * (1 + celebEffect("sell"));

  const bankCapacity = () => Math.max(BANK.minCapacity, perSecond() * 3600 * BANK.capacityHours) * (1 + celebEffect("bank"));
  const bankRatePerMinute = () => BANK.ratePerMinute * (1 + jobEffect("marchands"));

  // Récolte et intérêts sur une durée donnée (aussi utilisé pour l’absence).
  function updateEconomy(seconds) {
    RESOURCES.forEach((r) => {
      state.res[r.id] = Math.min(storage(r), state.res[r.id] + resourceRate(r) * seconds);
    });
    feedVillagers(seconds);
    const capacity = bankCapacity();
    if (state.bank > 0 && state.bank < capacity) {
      const grown = Math.min(capacity, state.bank * Math.pow(1 + bankRatePerMinute(), seconds / 60));
      state.stats.sources.coffre += grown - state.bank;
      state.bank = grown;
    }
  }

  // Les habitants mangent ; la satiété se rapproche de la part de leurs besoins couverte.
  function feedVillagers(seconds) {
    if (!foodActive() || seconds <= 0) return;
    const need = foodNeed() * seconds;
    let eaten = 0;
    FOOD.foods.forEach((id) => {
      const take = Math.min(state.res[id], need - eaten);
      state.res[id] -= take;
      eaten += take;
    });
    const fed = need > 0 ? eaten / need : 1;
    const before = satietyLevel();
    state.satiety += (fed * 100 - state.satiety) * Math.min(1, seconds / FOOD.catchUpSeconds);
    const after = satietyLevel();
    if (after !== before && typeof toast === "function") {
      toast(`${icon("poisson")} Vos habitants sont ${after.label} : ${after.effect}`);
    }
  }

  const buffMult = (buff) => (performance.now() < buff.until ? buff.mult : 1);
  const productionRate = () => perSecond() * buffMult(buffs.prod);
  const comboMult = () => 1 + Math.min(combo, COMBO_MAX) / COMBO_MAX;

  function clickValue() {
    let value = 1;
    ownedUpgrades().forEach((u) => {
      if (u.effect.click) value *= u.effect.click;
      if (u.effect.clickFromProd) value += perSecond() * u.effect.clickFromProd;
    });
    return value * buffMult(buffs.click) * comboMult();
  }

  // Gain de production d’un achat : on l’essaie, on mesure, puis on annule (rien n’est acheté).
  function productionGain(tryIt) {
    const before = perSecond();
    const undo = tryIt();
    const after = perSecond();
    undo();
    return after - before;
  }

  // Temps (en secondes) pour qu’un achat soit remboursé par ce qu’il rapporte.
  function buildingPayback(b, qty) {
    const gain = productionGain(() => {
      state.owned[b.id] = count(b) + qty;
      return () => { state.owned[b.id] = count(b) - qty; };
    });
    return gain > 0 ? priceFor(b, qty) / gain : Infinity;
  }

  // Seules les améliorations qui augmentent la production ont un temps de remboursement.
  function upgradePayback(u) {
    if (!u.effect.building && !u.effect.popBonus) return Infinity;
    const gain = productionGain(() => {
      state.upgrades[u.id] = true;
      return () => { delete state.upgrades[u.id]; };
    });
    return gain > 0 ? u.cost / gain : Infinity;
  }

  const hasAutomation = () => ownedUpgrades().some((u) => u.effect.auto);
  const hasAutoSell = () => ownedUpgrades().some((u) => u.effect.autoSell);

  function isUnlocked(u) {
    const need = u.unlock;
    if (need.earned && state.totalEarned < need.earned) return false;
    if (need.pop && population() < need.pop) return false;
    if (need.building && (state.owned[need.building] || 0) < need.owned) return false;
    return true;
  }

  function stageIndex() {
    const pop = population();
    let i = 0;
    while (i + 1 < STAGES.length && pop >= STAGES[i + 1].pop) i++;
    return i;
  }

  function earn(amount, source) {
    state.coins += amount;
    state.totalEarned += amount;
    const key = source || "batiments";
    state.stats.sources[key] = (state.stats.sources[key] || 0) + amount; // || 0 : anciennes sauvegardes
  }

  // ---------------------------------------------------------------------------
  // 4. Affichage
  // ---------------------------------------------------------------------------

  const $ = (id) => document.getElementById(id);
  const art = window.PixelArt; // les dessins (art.js)
  const icon = (name, look, className) =>
    `<img class="${className || "px"}" src="${art.url(name, look)}" alt="" draggable="false">`;
  const COIN = icon("piece", undefined, "px coin-icon");
  const PEOPLE = icon("habitant", 1, "px people-icon");
  const intFmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
  const decFmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
  const dec2Fmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
  const BIG = [[1e12, "Bn"], [1e9, "Md"], [1e6, "M"]];

  function format(n, decimals) {
    for (const [size, unit] of BIG) {
      if (n >= size) return decFmt.format(Math.floor(n / size * 10) / 10) + " " + unit;
    }
    if (decimals && n < 1) return dec2Fmt.format(Math.floor(n * 100) / 100); // petites valeurs : 2 décimales
    if (decimals && n < 100) return decFmt.format(Math.floor(n * 10) / 10);
    return intFmt.format(Math.floor(n));
  }

  // Les boutons sont créés une fois, puis seuls leurs textes sont mis à jour.
  function buildShop() {
    $("buildings").innerHTML = BUILDINGS.map((b) => `
      <div class="row" data-row="${b.id}" hidden>
        <button class="item" type="button" data-building="${b.id}">
          <span class="best-badge" hidden>Meilleur achat</span>
          <span class="item-icon">${icon(b.id)}</span>
          <span class="item-text">
            <span class="item-name">${b.name} <span class="level-tag" hidden></span></span>
            <span class="item-info">+<span class="cps"></span> ${COIN}/s · +${b.pop} ${PEOPLE}</span>
            <span class="item-synergy" hidden></span>
            <span class="payback"></span>
            <span class="item-price"><span class="cost"></span> ${COIN}<span class="qty"></span></span>
          </span>
          <span class="item-count"></span>
        </button>
        <span class="row-side">
          <button class="auto-toggle" type="button" data-auto="${b.id}" aria-pressed="false" hidden
            aria-label="Achat automatique : ${b.name}">${icon("engrenage")}<span>Auto</span></button>
          <button class="level-up" type="button" data-level="${b.id}" hidden aria-label="Monter le niveau : ${b.name}">
            ${icon("etoile")}<span class="level-next"></span><span class="level-cost"></span>
          </button>
        </span>
      </div>`).join("");

    $("upgrades").innerHTML = UPGRADES.map((u) => `
      <button class="item upgrade" type="button" data-upgrade="${u.id}" hidden>
        <span class="best-badge" hidden>Meilleur achat</span>
        <span class="item-icon">${icon(u.icon)}${u.badge ? `<span class="badge">${u.badge}</span>` : ""}</span>
        <span class="item-text">
          <span class="item-name">${u.name}</span>
          <span class="item-info">${u.info}</span>
          <span class="payback"></span>
          <span class="item-price">${format(u.cost)} ${COIN}</span>
        </span>
      </button>`).join("");

    $("mystery-text").innerHTML = `Gagnez encore <span id="mystery-amount"></span> ${COIN} pour le découvrir`;
  }

  function render() {
    $("coins").textContent = format(state.coins);
    $("per-second").textContent = format(productionRate(), true);
    $("population").textContent = format(population());
    $("click-value").textContent = "+" + format(clickValue(), true);
    $("combo").textContent = combo >= 5 ? `Combo ×${format(comboMult(), true)}` : "";
    $("streak").textContent = state.bottleStreak > 0 ? `Série ${state.bottleStreak}/${BOTTLE_STREAK.needed}` : "";
    $("wheel-open").hidden = state.lastSpin === todayKey();

    const active = [];
    const now = performance.now();
    if (now < buffs.prod.until) {
      const label = buffs.prod.mult >= BOTTLE_STREAK.mult ? "Super-frénésie" : "Frénésie";
      active.push(`${label} : production ×${buffs.prod.mult} · ${Math.ceil((buffs.prod.until - now) / 1000)} s`);
    }
    if (now < buffs.click.until) active.push(`Clic d’or : clic ×${GOLD_CLICK.mult} · ${Math.ceil((buffs.click.until - now) / 1000)} s`);
    $("buffs").textContent = active.join(" · ");
    $("buffs").hidden = active.length === 0;

    const stage = STAGES[stageIndex()];
    const next = STAGES[stageIndex() + 1];
    $("stage-title").textContent = stage.title;
    const pop = population();
    $("stage-next").textContent = next
      ? `${format(pop)} / ${format(next.pop)} habitants → ${next.title}`
      : "Votre île est devenue une nation !";
    const progress = next ? (pop - stage.pop) / (next.pop - stage.pop) : 1;
    $("progress-fill").style.width = Math.min(100, progress * 100) + "%";
    renderScene();

    // Un bâtiment apparaît quand on a gagné la moitié de son prix (le premier est toujours visible).
    const automation = hasAutomation();
    BUILDINGS.forEach((b, i) => {
      document.querySelector(`[data-row="${b.id}"]`).hidden =
        !(i === 0 || count(b) > 0 || state.totalEarned >= b.cost / 2);
      const el = document.querySelector(`[data-building="${b.id}"]`);
      const qty = buyQty(b);
      const cost = priceFor(b, qty);
      el.disabled = state.coins < cost;
      el.querySelector(".cps").textContent = format(buildingCps(b), true);
      el.querySelector(".cost").textContent = format(cost);
      el.querySelector(".qty").textContent = qty > 1 ? ` ×${qty}` : "";
      const synergy = synergyHtml(b);
      const synergyEl = el.querySelector(".item-synergy");
      if (synergyEl.dataset.key !== synergy) {
        synergyEl.dataset.key = synergy;
        synergyEl.innerHTML = synergy;
        synergyEl.hidden = !synergy;
      }
      el.querySelector(".item-count").textContent = count(b) || "";

      // Niveau : visible à partir de 10 exemplaires.
      const lv = level(b);
      const tag = el.querySelector(".level-tag");
      tag.hidden = lv < 2;
      tag.textContent = "Niv. " + lv;
      const levelButton = document.querySelector(`[data-level="${b.id}"]`);
      levelButton.hidden = count(b) < LEVELS.unlockCount;
      levelButton.disabled = lv >= LEVELS.max || state.coins < levelCost(b);
      levelButton.querySelector(".level-next").textContent = lv >= LEVELS.max ? "Niv. max" : `Niv. ${lv + 1}`;
      levelButton.querySelector(".level-cost").textContent = lv >= LEVELS.max ? "" : format(levelCost(b));

      const toggle = document.querySelector(`[data-auto="${b.id}"]`);
      toggle.hidden = !automation;
      toggle.setAttribute("aria-pressed", String(!!state.auto[b.id]));
    });
    // Le prochain bâtiment pas encore découvert reste caché derrière un « ? ».
    const nextLocked = BUILDINGS.find((b) => count(b) === 0 && state.totalEarned < b.cost / 2);
    $("mystery").hidden = !nextLocked;
    if (nextLocked) {
      $("mystery-amount").textContent = format(nextLocked.cost / 2 - state.totalEarned);
    }
    document.querySelectorAll("#buy-mode button").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.qty === String(state.buyMode)));
    });
    const bonus = popBonus();
    $("pop-bonus").hidden = bonus === 0;
    $("pop-bonus").textContent = `Mairie : +${format(bonus * 100, true)} % de production grâce aux habitants`;

    // On ne montre que les améliorations disponibles les moins chères, pour garder la boutique lisible.
    let shown = 0;
    UPGRADES.forEach((u) => {
      const el = document.querySelector(`[data-upgrade="${u.id}"]`);
      const visible = !state.upgrades[u.id] && isUnlocked(u) && shown < MAX_UPGRADES_SHOWN;
      if (visible) shown++;
      el.hidden = !visible;
      el.disabled = state.coins < u.cost;
    });
    $("upgrades-block").hidden = shown === 0;
    renderPaybacks();
    $("auto-mode").hidden = !automation;
    document.querySelectorAll("#auto-mode [data-mode]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.mode === state.autoMode));
    });
    renderPanels();
  }

  // « Remboursé en 2 min 30 » sur chaque carte, et un badge sur l’achat le plus rentable.
  function renderPaybacks() {
    const cards = [];
    BUILDINGS.forEach((b) => {
      const el = document.querySelector(`[data-building="${b.id}"]`);
      if (!el.closest(".row").hidden) cards.push({ el, time: buildingPayback(b, buyQty(b)) });
    });
    UPGRADES.forEach((u) => {
      const el = document.querySelector(`[data-upgrade="${u.id}"]`);
      if (!el.hidden) cards.push({ el, time: upgradePayback(u) });
    });
    const best = cards.reduce((a, c) => (c.time < (a ? a.time : Infinity) ? c : a), null);
    document.querySelectorAll(".item .payback").forEach((p) => { p.textContent = ""; });
    document.querySelectorAll(".best-badge").forEach((badge) => { badge.hidden = true; });
    cards.forEach((c) => {
      if (c.time === Infinity) return;
      c.el.querySelector(".payback").textContent = "Remboursé en " + formatDuration(c.time);
      c.el.querySelector(".best-badge").hidden = c !== best;
    });
  }

  function formatDuration(seconds) {
    if (seconds < 60) return Math.ceil(seconds) + " s";
    if (seconds < 3600) {
      const m = Math.floor(seconds / 60);
      const rest = Math.floor(seconds % 60);
      return m + " min" + (m < 10 && rest ? " " + String(rest).padStart(2, "0") : "");
    }
    if (seconds < 86400) {
      const h = Math.floor(seconds / 3600);
      return h + " h " + String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    }
    return format(seconds / 86400) + " j";
  }

  // « Synergie +15 % · Booste [cabane] +5 % »
  function synergyHtml(b) {
    const parts = [];
    const received = synergyBonus(b);
    if (received > 0) parts.push(`<span class="syn-in">Synergie +${pct(received)}</span>`);
    SYNERGIES.filter((syn) => syn.from === b.id).forEach((syn) => {
      parts.push(`Booste ${icon(syn.to, undefined, "px mini-icon")} +${pct(syn.bonus)}`);
    });
    return parts.join(" · ");
  }

  let toastTimer;
  function toast(message) {
    const el = $("toast");
    el.innerHTML = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3500);
  }

  function floatText(x, y, text) {
    const el = document.createElement("span");
    el.className = "float";
    el.innerHTML = text;
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.addEventListener("animationend", () => el.remove());
    document.body.appendChild(el);
  }

  function checkStage() {
    const i = stageIndex();
    if (i > state.stage) {
      state.stage = i;
      toast(`${icon(STAGES[i].landmark)} Votre île devient : ${STAGES[i].title} !`);
      confetti();
    }
  }

  // ---------------------------------------------------------------------------
  // Le village dessiné sur l’île
  // ---------------------------------------------------------------------------

  const ISLAND = art.ISLAND;
  const SLOTS = art.buildingSlots();
  const MAX_SCENE_BUILDINGS = Math.min(16, SLOTS.length);
  const MAX_SCENE_VILLAGERS = 10;

  // Taille de l’île : un nombre entier de pixels écran par pixel dessiné, pour des pixels bien nets.
  function sizeIsland() {
    const available = Math.min($("island-zone").clientWidth, 600);
    const scale = Math.max(2, Math.floor(available / ISLAND.w));
    const island = $("island");
    island.style.width = ISLAND.w * scale + "px";
    island.style.height = ISLAND.h * scale + "px";
    island.style.setProperty("--s", scale);
  }

  // Un dessin posé sur l’île : (x, y) = position de ses pieds, en pixels de l’île.
  function placeSprite(name, x, y, className, look, extraStyle) {
    const size = art.size(name);
    const left = Math.round(x - size.w / 2);
    const top = Math.round(y - size.h);
    return `<img class="${className}" src="${art.url(name, look)}" alt="" draggable="false" style="` +
      `left:${(left / ISLAND.w) * 100}%;top:${(top / ISLAND.h) * 100}%;width:${(size.w / ISLAND.w) * 100}%;` +
      `z-index:${Math.round(y)};${extraStyle || ""}">`;
  }

  // Redessine seulement quand le palier, le nombre de bâtiments ou d’habitants change.
  let sceneKey = "";
  function renderScene() {
    const pop = population();
    const villagers = Math.min(MAX_SCENE_VILLAGERS, Math.round(Math.sqrt(pop) * 1.2));
    const key = stageIndex() + "|" + BUILDINGS.map((b) => count(b) + ":" + level(b)).join(",") + "|" + villagers + "|" + state.celebs.join(",");
    if (key === sceneKey) return;
    sceneKey = key;

    const html = [placeSprite(STAGES[stageIndex()].landmark, ISLAND.cx, ISLAND.cy + 9, "landmark")];
    let slot = 0;
    BUILDINGS.forEach((b) => {
      for (let n = 0; n < Math.min(count(b), 3) && slot < MAX_SCENE_BUILDINGS; n++) {
        const place = SLOTS[slot++];
        html.push(placeSprite(b.id, place.x, place.y, "scene-building"));
        // Une étoile au-dessus des bâtiments de niveau 2 et plus.
        if (level(b) >= 2) html.push(placeSprite("etoile", place.x, place.y - art.size(b.id).h + 1, "scene-star"));
      }
    });
    // Les habitants ont toujours la même place de départ, puis se promènent à leur rythme.
    const rand = art.seeded(7);
    for (let i = 0; i < villagers; i++) {
      let x, y;
      do {
        x = ISLAND.cx + (rand() - 0.5) * (ISLAND.rx * 1.6);
        y = ISLAND.cy + (rand() - 0.5) * (ISLAND.ry * 1.4) + 4;
      } while (!art.inEllipse(x, y - 4, ISLAND.cx, ISLAND.cy, ISLAND.rx - 8, ISLAND.ry - 6));
      const walk = `--dx:${(i % 2 ? 1 : -1) * (4 + (i % 3) * 3)};--dur:${3 + (i % 4)}s`;
      html.push(placeSprite("habitant", x, y, "villager", i, walk));
    }
    // Les habitants célèbres se tiennent près du repère central, une étoile au-dessus de la tête.
    state.celebs.forEach((id, i) => {
      const celeb = CELEBRITIES.find((c) => c.id === id);
      if (!celeb) return;
      const x = ISLAND.cx - 14 + i * 14;
      const y = ISLAND.cy + 20;
      html.push(placeSprite("habitant", x, y, "villager celeb", celeb.look, "--dx:3;--dur:2s"));
      html.push(placeSprite("etoile", x, y - 10, "scene-star"));
    });
    $("scene").innerHTML = html.join("");
  }

  // Les nouveaux arrivants débarquent par la plage du bas puis montent vers le village.
  function welcome(newcomers) {
    const layer = $("arrivals"); // calque à part : le village peut se redessiner sans les effacer
    const html = [];
    for (let i = 0; i < Math.min(newcomers, 5); i++) {
      const x = ISLAND.cx + (Math.random() - 0.5) * 30;
      html.push(placeSprite("habitant", x, ISLAND.h - 2, "newcomer", Math.floor(Math.random() * 8),
        `animation-delay:${i * 0.15}s;--to-x:${Math.round((Math.random() - 0.5) * 16)}`));
    }
    layer.insertAdjacentHTML("beforeend", html.join(""));
    layer.querySelectorAll(".newcomer").forEach((el) => {
      el.addEventListener("animationend", () => el.remove(), { once: true });
    });
    const rect = $("island").getBoundingClientRect();
    floatText(rect.left + rect.width / 2, rect.top + rect.height * 0.85, `+${newcomers} ${PEOPLE} Bienvenue !`);

    const counter = $("population");
    counter.classList.remove("bump");
    void counter.offsetWidth; // relance l’animation
    counter.classList.add("bump");
  }

  // Confettis en pixels, aux couleurs de la palette.
  function confetti() {
    const colors = ["y", "r", "t", "g", "o", "l", "w"].map((c) => art.PALETTE[c]);
    for (let i = 0; i < 36; i++) {
      const el = document.createElement("span");
      el.className = "confetti";
      el.style.background = colors[i % colors.length];
      el.style.left = Math.random() * 100 + "%";
      el.style.animationDelay = Math.random() * 0.6 + "s";
      el.style.animationDuration = 2 + Math.random() * 1.5 + "s";
      el.addEventListener("animationend", () => el.remove());
      document.body.appendChild(el);
    }
  }

  // Le décor du fond : soleil ou lune, nuages et vagues dessinés en pixels.
  function buildBackdrop() {
    $("backdrop").innerHTML =
      `<img class="sun" src="${art.url("soleil")}" alt=""><img class="moon" src="${art.url("lune")}" alt="">` +
      [1, 2, 3].map((n) => `<img class="cloud c${n}" src="${art.url("nuage")}" alt="">`).join("") +
      `<div class="stars"></div><div class="waves"></div>`;
    document.documentElement.style.setProperty("--wave", `url(${art.url("vague")})`);
    document.querySelectorAll("img[data-sprite]").forEach((img) => {
      img.src = art.url(img.dataset.sprite, img.dataset.look === undefined ? undefined : Number(img.dataset.look));
    });
  }

  // ---------------------------------------------------------------------------
  // 5. Actions du joueur
  // ---------------------------------------------------------------------------

  function onIslandClick(event) {
    const now = performance.now();
    combo = now - lastClickAt <= COMBO_WINDOW_MS ? combo + 1 : 0;
    lastClickAt = now;
    const value = clickValue();
    earn(value, "clics");
    state.stats.clicks++;
    state.stats.bestCombo = Math.max(state.stats.bestCombo, combo);
    // Au clavier, il n’y a pas de position de souris : on vise le centre de l’île.
    const rect = $("island").getBoundingClientRect();
    const x = event.clientX || rect.left + rect.width / 2;
    const y = event.clientY || rect.top + rect.height / 2;
    floatText(x, y, "+" + format(value, true) + " " + COIN);
    coinBurst(x, y);
    render();
  }

  // Quelques pièces jaillissent de l’endroit touché (limitées pour rester fluide).
  function coinBurst(x, y) {
    if (document.querySelectorAll(".coin").length > 24) return;
    for (let i = 0; i < 3; i++) {
      const el = document.createElement("span");
      el.className = "coin";
      el.innerHTML = COIN;
      const angle = Math.random() * Math.PI * 2;
      const distance = 40 + Math.random() * 40;
      el.style.left = x + "px";
      el.style.top = y + "px";
      el.style.setProperty("--tx", Math.cos(angle) * distance + "px");
      el.style.setProperty("--ty", Math.sin(angle) * distance + "px");
      el.addEventListener("animationend", () => el.remove());
      document.body.appendChild(el);
    }
  }

  // Le décor passe en mode nuit de 20 h à 7 h, à l’heure du joueur.
  function updateDayNight() {
    const hour = new Date().getHours();
    document.documentElement.classList.toggle("night", hour >= 20 || hour < 7);
  }

  function buy(b, qty) {
    const cost = priceFor(b, qty);
    if (state.coins < cost) return false;
    state.coins -= cost;
    state.owned[b.id] = count(b) + qty;
    welcome(b.pop * qty);
    checkStage();
    return true;
  }

  // L’intendant passe une fois par seconde. Parmi les bâtiments en mode Auto, il choisit
  // le moins cher, ou le plus rentable (il attend alors d’avoir assez de pièces pour celui-là).
  function autoBuy() {
    if (!hasAutomation()) return;
    const chosen = BUILDINGS.filter((b) => state.auto[b.id]);
    const score = state.autoMode === "best" ? (b) => buildingPayback(b, 1) : (b) => unitPrice(b, 0);
    let newcomers = 0;
    for (let n = 0; n < MAX_AUTO_BUYS_PER_SECOND && chosen.length; n++) {
      const pick = chosen.reduce((best, b) => (score(b) < score(best) ? b : best));
      const cost = unitPrice(pick, 0);
      if (state.coins < cost) break;
      state.coins -= cost;
      state.owned[pick.id] = count(pick) + 1;
      newcomers += pick.pop;
    }
    if (newcomers > 0) {
      welcome(newcomers);
      checkStage();
      render();
    }
  }

  function onAutoModeClick(event) {
    const button = event.target.closest("[data-mode]");
    if (!button) return;
    state.autoMode = button.dataset.mode;
    render();
  }

  function onBuyModeClick(event) {
    const button = event.target.closest("button");
    if (!button) return;
    state.buyMode = button.dataset.qty === "max" ? "max" : Number(button.dataset.qty);
    render();
  }

  function onShopClick(event) {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;

    const building = BUILDINGS.find((b) => b.id === button.dataset.building);
    if (building) buy(building, buyQty(building));

    const leveled = BUILDINGS.find((b) => b.id === button.dataset.level);
    if (leveled && level(leveled) < LEVELS.max && state.coins >= levelCost(leveled)) {
      state.coins -= levelCost(leveled);
      state.levels[leveled.id] = level(leveled) + 1;
      toast(`${icon(leveled.id)} ${leveled.name} niveau ${level(leveled)} : production ×${format(Math.pow(LEVELS.mult, level(leveled) - 1), true)}`);
    }

    if (button.dataset.auto) {
      const id = button.dataset.auto;
      state.auto[id] = !state.auto[id];
      const b = BUILDINGS.find((x) => x.id === id);
      toast(`${icon(id)} ${b.name} : achat automatique ${state.auto[id] ? "activé" : "arrêté"}`);
    }

    const upgrade = UPGRADES.find((u) => u.id === button.dataset.upgrade);
    if (upgrade && !state.upgrades[upgrade.id] && state.coins >= upgrade.cost) {
      state.coins -= upgrade.cost;
      state.upgrades[upgrade.id] = true;
      toast(`${icon(upgrade.icon)} Amélioration achetée : ${upgrade.name} (${upgrade.info})`);
    }
    render();
  }

  // Premier clic : demande de confirmation. Deuxième clic dans les 4 s : la partie est effacée.
  let resetTimer = null;
  function onReset() {
    const button = $("reset");
    if (!resetTimer) {
      button.textContent = "Sûr ? Toucher encore pour tout effacer";
      button.classList.add("confirm");
      resetTimer = setTimeout(cancelReset, 4000);
      return;
    }
    cancelReset();
    state = newState();
    save();
    render();
    toast("Nouvelle partie : retour sur l’îlot désert");
  }
  function cancelReset() {
    clearTimeout(resetTimer);
    resetTimer = null;
    $("reset").textContent = "Recommencer la partie";
    $("reset").classList.remove("confirm");
  }

  // ---------------------------------------------------------------------------
  // 6. Événements : bouteille à la mer et bateau de touristes
  // ---------------------------------------------------------------------------

  const randomBetween = (min, max) => min + Math.random() * (max - min);
  let nextBottleAt = performance.now() + BOTTLE.firstDelay * 1000;
  let nextBoatAt = performance.now() + BOAT.firstDelay * 1000;
  let bottleOnScreen = false;
  let boatOnScreen = false;

  // Petit gain affiché au-dessus de l’objet touché.
  function rewardAt(el, text) {
    const rect = el.getBoundingClientRect();
    floatText(rect.left + rect.width / 2, rect.top, text);
    el.remove();
  }

  function spawnBottle() {
    bottleOnScreen = true;
    const el = document.createElement("button");
    el.type = "button";
    el.className = "bottle";
    el.innerHTML = icon("bouteille");
    el.setAttribute("aria-label", "Bouteille à la mer : touchez-la vite !");
    el.style.left = randomBetween(8, 82) + "%";
    el.style.top = randomBetween(25, 75) + "%";
    const timer = setTimeout(() => {
      el.remove();
      bottleOnScreen = false;
      if (state.bottleStreak > 0) toast(`${icon("bouteille")} Bouteille perdue : la série repart à zéro`);
      state.bottleStreak = 0;
    }, BOTTLE.lifetime * 1000);
    el.addEventListener("click", () => {
      clearTimeout(timer);
      bottleOnScreen = false;
      openBottle(el);
    });
    document.body.appendChild(el);
  }

  function openBottle(el) {
    state.stats.bottles++;
    state.bottleStreak++;
    if (state.bottleStreak >= BOTTLE_STREAK.needed) {
      state.bottleStreak = 0;
      superFrenzy(BOTTLE_STREAK.seconds);
      rewardAt(el, "Super-frénésie ×" + BOTTLE_STREAK.mult);
      toast(`${icon("bouteille")} ${BOTTLE_STREAK.needed} bouteilles d’affilée ! Super-frénésie ×${BOTTLE_STREAK.mult} pendant ${BOTTLE_STREAK.seconds} s`);
      render();
      return;
    }
    const roll = Math.random();
    if (roll < 0.5) {
      const gain = Math.max(clickValue() * 30, Math.min(state.coins * 0.15, perSecond() * 900));
      earn(gain, "evenements");
      rewardAt(el, "+" + format(gain) + " " + COIN);
      toast(`${icon("bouteille")} Un trésor dans la bouteille : +${format(gain)} ${COIN}`);
    } else if (roll < 0.8) {
      frenzy(FRENZY.mult, FRENZY.seconds);
      rewardAt(el, "Frénésie ×" + FRENZY.mult);
      toast(`${icon("bouteille")} Frénésie ! Production ×${FRENZY.mult} pendant ${FRENZY.seconds} s`);
    } else {
      buffs.click = { mult: GOLD_CLICK.mult, until: performance.now() + GOLD_CLICK.seconds * 1000 };
      rewardAt(el, "Clic d’or ×" + GOLD_CLICK.mult);
      toast(`${icon("bouteille")} Clic d’or ! Chaque clic ×${GOLD_CLICK.mult} pendant ${GOLD_CLICK.seconds} s`);
    }
    render();
  }

  function frenzy(mult, seconds) {
    buffs.prod = { mult, until: performance.now() + seconds * 1000 };
  }
  function superFrenzy(seconds) {
    frenzy(BOTTLE_STREAK.mult, seconds);
    state.stats.superFrenzies = (state.stats.superFrenzies || 0) + 1;
  }

  function spawnBoat() {
    boatOnScreen = true;
    const el = document.createElement("button");
    el.type = "button";
    el.className = "boat";
    el.innerHTML = icon("bateau");
    el.setAttribute("aria-label", "Bateau de touristes : touchez-le pour les accueillir");
    el.style.top = randomBetween(18, 60) + "%";
    el.addEventListener("animationend", () => {
      el.remove();
      boatOnScreen = false;
    });
    el.addEventListener("click", () => {
      boatOnScreen = false;
      const gain = Math.max(50, perSecond() * 120 + clickValue() * 25) * (1 + celebEffect("boat"));
      earn(gain, "evenements");
      state.stats.boats++;
      rewardAt(el, "+" + format(gain) + " " + COIN);
      toast(`${icon("bateau")} Des touristes débarquent et dépensent +${format(gain)} ${COIN}`);
      render();
    });
    document.body.appendChild(el);
  }

  function checkEvents(now) {
    if (!bottleOnScreen && now >= nextBottleAt) {
      spawnBottle();
      nextBottleAt = now + randomBetween(BOTTLE.minDelay, BOTTLE.maxDelay) * 1000 * (1 + celebEffect("bottle"));
    }
    if (!boatOnScreen && now >= nextBoatAt) {
      spawnBoat();
      nextBoatAt = now + randomBetween(BOAT.minDelay, BOAT.maxDelay) * 1000;
    }
    if (combo > 0 && now - lastClickAt > COMBO_WINDOW_MS * 2) combo = 0;
    if (now >= nextMarketAt) {
      changePrices();
      nextMarketAt = now + MARKET.changeEvery * 1000;
    }
    checkOrder(now);
    checkExpedition();
    checkVisitor(now);
  }

  // Un navire marchand passe commande de temps en temps (seulement quand le marché est ouvert).
  let nextOrderAt = performance.now() + ORDERS.firstDelay * 1000;
  function checkOrder(now) {
    if (state.order && Date.now() > state.order.expiresAt) {
      state.order = null;
      toast(`${icon("bateau")} Le navire marchand est reparti sans sa commande`);
    }
    if (state.order || now < nextOrderAt || !foodActive()) return;
    nextOrderAt = now + randomBetween(ORDERS.minDelay, ORDERS.maxDelay) * 1000;
    const options = RESOURCES.filter((r) => count(buildingOf(r)) > 0);
    const r = options[Math.floor(Math.random() * options.length)];
    // Une quantité qu’on peut réunir en 2 à 4 minutes de récolte, sans dépasser le stock maximum.
    const qty = Math.min(storage(r), Math.max(20, Math.round(resourceRate(r) * randomBetween(120, 240))));
    const reward = qty * sellPrice(r) * randomBetween(ORDERS.minMult, ORDERS.maxMult);
    state.order = { res: r.id, qty, reward, expiresAt: Date.now() + ORDERS.duration * 1000 };
    toast(`${icon("bateau")} Un navire marchand commande ${format(qty)} ${r.plural} !`);
  }

  function onOrderClick(event) {
    const button = event.target.closest("[data-order]");
    if (!button || button.disabled || !state.order) return;
    const order = state.order;
    if (button.dataset.order === "deliver") {
      if (state.res[order.res] < order.qty) return;
      state.res[order.res] -= order.qty;
      earn(order.reward, "commandes");
      state.stats.orders = (state.stats.orders || 0) + 1;
      const rect = button.getBoundingClientRect();
      floatText(rect.left + rect.width / 2, rect.top, `+${format(order.reward)} ${COIN}`);
      toast(`${icon("bateau")} Commande livrée : +${format(order.reward)} ${COIN}`);
    }
    state.order = null;
    render();
  }

  // ---------------------------------------------------------------------------
  // 6 bis. Onglets de la boutique : métiers, marché et coffre
  // ---------------------------------------------------------------------------

  let activeTab = "build";
  let nextMarketAt = performance.now() + MARKET.changeEvery * 1000;
  const pct = (x) => format(Math.abs(x) * 100, true) + "\u00a0%"; // espace insécable : « % » reste collé au nombre

  // Les cartes sont créées une fois, puis seuls leurs textes sont mis à jour.
  function buildPanels() {
    $("tabs").innerHTML = TABS.map((t) =>
      `<button type="button" role="tab" data-tab="${t.id}" aria-selected="false">${t.name}<span class="tab-dot" hidden></span></button>`
    ).join("");

    $("jobs").innerHTML = JOBS.map((j) => `
      <div class="card job" data-job-row="${j.id}">
        <span class="item-icon">${icon(j.icon)}</span>
        <span class="item-text">
          <span class="item-name">${j.name}</span>
          <span class="item-info"><span class="job-count"></span> ${PEOPLE}</span>
          <span class="item-effect">${j.effect < 0 ? "−" : "+"}<span class="job-effect"></span> ${j.info}</span>
        </span>
        <span class="stepper">
          <button type="button" data-job="${j.id}" data-step="-1" aria-label="Moins de ${j.name.toLowerCase()}">−</button>
          <span class="job-share"></span>
          <button type="button" data-job="${j.id}" data-step="1" aria-label="Plus de ${j.name.toLowerCase()}">+</button>
        </span>
      </div>`).join("");

    $("market").innerHTML = RESOURCES.map((r) => `
      <div class="card resource" data-res-row="${r.id}">
        <span class="item-icon">${icon(r.id)}</span>
        <span class="item-text">
          <span class="item-name">${r.name} <span class="trend"></span></span>
          <span class="item-info">Stock <span class="stock"></span> · +<span class="rate"></span>/s</span>
          <span class="bar"><span class="bar-fill stock-fill"></span></span>
          <span class="item-price"><span class="unit"></span> ${COIN} l’unité</span>
        </span>
        <button type="button" class="sell" data-sell="${r.id}">Vendre<span class="sell-total"></span></button>
        <span class="auto-sell" hidden>
          <button type="button" class="auto-sell-toggle" data-auto-sell="${r.id}" aria-pressed="false">${icon("balance")}<span>Auto</span></button>
          <button type="button" class="auto-sell-min" data-auto-min="${r.id}" aria-label="Changer le prix minimum de vente"></button>
          <button type="button" class="auto-sell-min" data-auto-keep="${r.id}" aria-label="Changer la réserve gardée"></button>
        </span>
      </div>`).join("");
  }

  function renderPanels() {
    TABS.forEach((t) => {
      const button = document.querySelector(`[data-tab="${t.id}"]`);
      const open = !t.unlocked || t.unlocked();
      if (open && t.unlocked && !state.tabsSeen[t.id]) { // les onglets ouverts dès le départ ne sont pas annoncés
        state.tabsSeen[t.id] = true;
        button.classList.add("new");
        toast(`Nouvel onglet débloqué : ${t.name} !`);
      }
      button.disabled = !open;
      button.title = open ? "" : `Se débloque ${t.unlockText}`;
      button.setAttribute("aria-selected", String(t.id === activeTab));
      $("panel-" + t.id).hidden = t.id !== activeTab;
    });
    // Un point signale un stock plein au marché.
    const full = RESOURCES.some((r) => count(buildingOf(r)) > 0 && state.res[r.id] >= storage(r)) ||
      !!state.order || (foodActive() && satietyLevel().mult < 0);
    document.querySelector('[data-tab="market"] .tab-dot').hidden = !full || activeTab === "market";

    if (activeTab === "jobs") {
      renderJobs();
      renderCelebs();
    }
    document.querySelector('[data-tab="jobs"] .tab-dot').hidden = !state.visitor || activeTab === "jobs";
    if (activeTab === "market") renderMarket();
    if (activeTab === "bank") renderBank();
    if (activeTab === "stats") renderStats();
  }

  // Une ligne de statistique : icône, nom, barre proportionnelle, valeur.
  const statRow = (iconName, label, value, share) => `
    <div class="stat-row">
      ${icon(iconName)}
      <span class="stat-row-text"><span>${label}</span><span class="bar"><span class="bar-fill" style="width:${Math.min(100, share * 100)}%"></span></span></span>
      <span class="stat-row-value">${value}</span>
    </div>`;

  function renderStats() {
    const st = state.stats;
    const tracked = SOURCES.reduce((sum, src) => sum + (st.sources[src.id] || 0), 0);
    // Parties commencées avant le suivi : la différence est affichée à part.
    const before = Math.max(0, state.totalEarned - (tracked - st.sources.coffre));
    const total = tracked + before || 1;
    const rows = SOURCES.map((src) => {
      const value = st.sources[src.id] || 0;
      return statRow(src.icon, src.name, format(value), value / total);
    });
    if (before >= 1) rows.push(statRow("puits", "Avant le suivi", format(before), before / total));
    $("stats-sources").innerHTML = rows.join("");

    // Part de chaque bâtiment dans la production actuelle (les bonus globaux s’appliquent à tous pareil).
    const raw = BUILDINGS.reduce((sum, b) => sum + buildingCps(b) * count(b), 0) || 1;
    $("stats-buildings").innerHTML = BUILDINGS.filter((b) => count(b) > 0).map((b) => {
      const share = (buildingCps(b) * count(b)) / raw;
      return statRow(b.id, b.name, format(perSecond() * share, true) + "/s", share);
    }).join("") || `<p class="panel-intro">Aucun bâtiment pour l’instant.</p>`;

    const records = [
      ["Total gagné", format(state.totalEarned)],
      ["Temps de jeu", formatDuration(st.playTime)],
      ["Clics sur l’île", format(st.clicks)],
      ["Meilleur combo", "×" + format(1 + Math.min(st.bestCombo, COMBO_MAX) / COMBO_MAX, true)],
      ["Bouteilles attrapées", format(st.bottles)],
      ["Bateaux accueillis", format(st.boats)],
      ["Commandes livrées", format(st.orders || 0)],
      ["Super-frénésies", format(st.superFrenzies || 0)],
      ["Tours de roue", format(st.spins || 0)],
      ["Poissons dorés", format(st.goldFish || 0)],
      ["Expéditions réussies", format(st.expeditions || 0)],
    ];
    $("stats-records").innerHTML = records.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
    renderAchievements();
  }

  function renderJobs() {
    const pop = population();
    JOBS.forEach((j) => {
      const row = document.querySelector(`[data-job-row="${j.id}"]`);
      row.querySelector(".job-count").textContent = format(pop * jobShare(j.id));
      row.querySelector(".job-effect").textContent = pct(jobEffect(j.id));
      row.querySelector(".job-share").textContent = state.jobs[j.id] + " %";
      row.querySelector('[data-step="-1"]').disabled = state.jobs[j.id] <= 0;
      row.querySelector('[data-step="1"]').disabled = freeShare() * 100 < JOB_STEP - 0.001;
    });
    $("jobs-free").textContent = `${Math.round(freeShare() * 100)} % (${format(pop * freeShare())} habitants)`;
    $("jobs-bar").innerHTML = JOBS.map((j) => `<span class="seg seg-${j.id}" style="width:${state.jobs[j.id]}%"></span>`).join("");
  }

  function renderMarket() {
    RESOURCES.forEach((r) => {
      const row = document.querySelector(`[data-res-row="${r.id}"]`);
      const stock = state.res[r.id];
      const cap = storage(r);
      const m = state.market[r.id];
      row.hidden = count(buildingOf(r)) === 0 && stock < 1;
      row.classList.toggle("full", stock >= cap);
      row.querySelector(".stock").textContent = `${format(stock)} / ${format(cap)}`;
      row.querySelector(".rate").textContent = format(resourceRate(r), true);
      row.querySelector(".stock-fill").style.width = Math.min(100, (stock / cap) * 100) + "%";
      row.querySelector(".unit").textContent = format(sellPrice(r), true);
      const trendKey = m.trend + "|" + m.f.toFixed(2);
      const trendEl = row.querySelector(".trend");
      if (trendEl.dataset.key !== trendKey) {
        trendEl.dataset.key = trendKey;
        trendEl.className = "trend " + (m.trend > 0 ? "up" : m.trend < 0 ? "down" : "");
        trendEl.innerHTML = (m.trend ? icon(m.trend > 0 ? "hausse" : "baisse", undefined, "px trend-icon") : "") +
          ` prix ×${format(m.f, true)}`;
      }
      const whole = Math.floor(stock);
      row.querySelector(".sell-total").textContent = whole >= 1 ? ` +${format(whole * sellPrice(r))}` : "";
      row.querySelector(".sell").disabled = whole < 1;

      const auto = state.autoSell[r.id];
      row.querySelector(".auto-sell").hidden = !hasAutoSell();
      row.querySelector(".auto-sell-toggle").setAttribute("aria-pressed", String(auto.on));
      row.querySelector("[data-auto-min]").textContent = `Prix ≥ ×${format(auto.min, true)}`;
      row.querySelector("[data-auto-keep]").textContent = `Réserve ${Math.round((auto.keep || 0) * 100)}\u00a0%`;
    });
    $("auto-sell-note").hidden = !hasAutoSell();
    $("auto-sell-total").textContent = format(state.autoSellTotal);
    $("market-timer").textContent = Math.max(0, Math.ceil((nextMarketAt - performance.now()) / 1000)) + " s";
    renderSatiety();
    renderOrder();
    renderFishing();
    renderExpedition();
  }

  function renderSatiety() {
    $("satiety").hidden = !foodActive();
    if (!foodActive()) return;
    const level = satietyLevel();
    $("satiety-value").textContent = Math.round(state.satiety) + " %";
    $("satiety-label").textContent = `Habitants ${level.label} : ${level.effect}`;
    $("satiety-label").className = "item-effect" + (level.mult < 0 ? " bad" : "");
    $("satiety-fill").style.width = Math.max(0, Math.min(100, state.satiety)) + "%";
    $("satiety").classList.toggle("full", level.mult < 0);
    $("satiety-need").textContent = format(foodNeed(), true);
  }

  function renderOrder() {
    const order = state.order;
    $("order").hidden = !order;
    if (!order) return;
    const r = RESOURCES.find((x) => x.id === order.res);
    const stock = state.res[r.id];
    $("order-text").innerHTML = `${format(order.qty)} ${r.plural} contre <strong>${format(order.reward)}</strong> ${COIN}`;
    $("order-stock").textContent = `${format(Math.min(stock, order.qty))} / ${format(order.qty)}`;
    $("order-fill").style.width = Math.min(100, (stock / order.qty) * 100) + "%";
    $("order-time").textContent = formatDuration(Math.max(0, (order.expiresAt - Date.now()) / 1000));
    document.querySelector('[data-order="deliver"]').disabled = stock < order.qty;
  }

  function renderBank() {
    const cap = bankCapacity();
    $("bank-amount").textContent = format(state.bank);
    $("bank-rate").textContent = format(bankRatePerMinute() * 100, true);
    $("bank-gain").textContent = state.bank >= cap ? "Coffre plein" : "+" + format(state.bank * bankRatePerMinute(), true);
    $("bank-cap").textContent = format(cap);
    $("bank-fill").style.width = Math.min(100, (state.bank / cap) * 100) + "%";
    const room = cap - state.bank;
    document.querySelectorAll("[data-bank]").forEach((button) => {
      button.disabled = button.dataset.bank === "out" ? state.bank < 1 : room < 1 || state.coins < 1;
    });
  }

  // Les prix bougent au hasard, avec une tendance à revenir vers ×1.
  function changePrices() {
    RESOURCES.forEach((r) => {
      const m = state.market[r.id];
      const next = m.f * (0.75 + Math.random() * 0.5) + (1 - m.f) * 0.15;
      const clamped = Math.min(MARKET.max, Math.max(MARKET.min, next));
      m.trend = clamped > m.f + 0.01 ? 1 : clamped < m.f - 0.01 ? -1 : 0;
      m.f = clamped;
    });
  }

  function onTabClick(event) {
    const button = event.target.closest("[data-tab]");
    if (!button || button.disabled) return;
    activeTab = button.dataset.tab;
    button.classList.remove("new");
    render();
  }

  function onJobClick(event) {
    const button = event.target.closest("[data-job]");
    if (!button || button.disabled) return;
    const id = button.dataset.job;
    const step = Number(button.dataset.step) * JOB_STEP;
    const next = state.jobs[id] + step;
    if (next < 0 || (step > 0 && freeShare() * 100 < step - 0.001)) return;
    state.jobs[id] = next;
    render();
  }

  // Vend le stock d’une ressource sauf « keep » unités ; rate = part du prix gardée (1 = tout).
  function sellAll(r, rate, keep) {
    const qty = Math.floor(state.res[r.id] - (keep || 0));
    if (qty < 1) return 0;
    const gain = qty * sellPrice(r) * rate;
    state.res[r.id] -= qty;
    earn(gain, "marche");
    return gain;
  }

  function onSellClick(event) {
    const auto = event.target.closest("[data-auto-sell]");
    if (auto) {
      const setting = state.autoSell[auto.dataset.autoSell];
      setting.on = !setting.on;
      render();
      return;
    }
    const min = event.target.closest("[data-auto-min]");
    if (min) {
      // Chaque appui passe au seuil suivant : ×1 → ×1,2 → ×1,5 → ×1,8 → ×1…
      const setting = state.autoSell[min.dataset.autoMin];
      const list = AUTO_SELL.thresholds;
      setting.min = list[(list.indexOf(setting.min) + 1) % list.length];
      render();
      return;
    }
    const keep = event.target.closest("[data-auto-keep]");
    if (keep) {
      // Réserve gardée pour nourrir l’île : 0 % → 25 % → 50 % du stock.
      const setting = state.autoSell[keep.dataset.autoKeep];
      const list = AUTO_SELL.keeps;
      setting.keep = list[(list.indexOf(setting.keep || 0) + 1) % list.length];
      render();
      return;
    }
    const button = event.target.closest("[data-sell]");
    if (!button || button.disabled) return;
    const gain = sellAll(RESOURCES.find((x) => x.id === button.dataset.sell), 1);
    if (!gain) return;
    const rect = button.getBoundingClientRect();
    floatText(rect.left + rect.width / 2, rect.top, `+${format(gain)} ${COIN}`);
    render();
  }

  // Le négociant passe une fois par seconde : il vend si le prix est assez haut ou si le stock déborde.
  function autoSell() {
    if (!hasAutoSell()) return;
    RESOURCES.forEach((r) => {
      const setting = state.autoSell[r.id];
      if (!setting.on) return;
      const goodPrice = state.market[r.id].f >= setting.min - 0.001;
      const full = state.res[r.id] >= storage(r);
      // Il garde la réserve choisie, plus ce qu’il faut pour la commande en cours.
      const reserved = (setting.keep || 0) * storage(r) + (state.order && state.order.res === r.id ? state.order.qty : 0);
      if (goodPrice || full) state.autoSellTotal += sellAll(r, 1 - AUTO_SELL.commission, reserved);
    });
  }

  function onBankClick(event) {
    const button = event.target.closest("[data-bank]");
    if (!button || button.disabled) return;
    if (button.dataset.bank === "out") {
      state.coins += state.bank;
      toast(`${icon("coffre")} Vous retirez ${format(state.bank)} ${COIN} du coffre`);
      state.bank = 0;
    } else {
      const room = Math.max(0, bankCapacity() - state.bank);
      const amount = Math.min(state.coins * Number(button.dataset.bank), room);
      if (amount < 1) return;
      state.coins -= amount;
      state.bank += amount;
    }
    render();
  }

  // ---------------------------------------------------------------------------
  // 6 ter. Succès et roue du jour
  // ---------------------------------------------------------------------------

  // Vérifiés une fois par seconde ; un message annonce les nouveaux.
  function checkAchievements() {
    const fresh = ACHIEVEMENTS.filter((a) => !state.achievements[a.id] && a.test());
    fresh.forEach((a) => { state.achievements[a.id] = true; });
    if (fresh.length === 1) {
      toast(`${icon("trophee")} Succès : ${fresh[0].name} ! Production +1\u00a0%`);
    } else if (fresh.length > 1) {
      toast(`${icon("trophee")} ${fresh.length} succès débloqués ! Production +${fresh.length}\u00a0%`);
    }
  }

  function buildAchievements() {
    $("achievements").innerHTML = ACHIEVEMENTS.map((a) => `
      <div class="achievement" data-ach="${a.id}">
        ${icon("trophee")}
        <span class="item-text"><span class="item-name">${a.name}</span><span class="item-info">${a.desc}</span></span>
      </div>`).join("");
  }

  function renderAchievements() {
    const done = ACHIEVEMENTS.filter((a) => state.achievements[a.id]).length;
    $("ach-count").textContent = `${done} / ${ACHIEVEMENTS.length}`;
    $("ach-bonus").textContent = `Bonus des succès : production +${format(achievementBonus() * 100, true)}\u00a0%`;
    ACHIEVEMENTS.forEach((a) => {
      document.querySelector(`[data-ach="${a.id}"]`).classList.toggle("done", !!state.achievements[a.id]);
    });
  }

  const todayKey = () => new Date().toDateString();

  // La roue est dessinée en pixels : 6 parts colorées avec l’icône de chaque gain.
  function drawWheel() {
    const canvas = $("wheel-canvas");
    const size = 72;
    const radius = 34;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const colors = ["y", "t", "o", "g", "l", "e"].map((c) => art.PALETTE[c]);
    const part = (Math.PI * 2) / WHEEL.length;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x + 0.5 - size / 2;
        const dy = y + 0.5 - size / 2;
        const dist = Math.hypot(dx, dy);
        if (dist > radius) continue;
        // Angle mesuré depuis le haut, dans le sens des aiguilles d’une montre.
        const angle = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2);
        const index = Math.floor(angle / part);
        const edge = dist > radius - 2 || Math.abs(angle - Math.round(angle / part) * part) * dist < 0.8;
        ctx.fillStyle = edge || dist < 4 ? art.PALETTE.k : colors[index];
        ctx.fillRect(x, y, 1, 1);
      }
    }
    WHEEL.forEach((w, i) => {
      const icon = art.canvasOf(w.icon);
      const middle = (i + 0.5) * part;
      const cx = size / 2 + Math.sin(middle) * radius * 0.6;
      const cy = size / 2 - Math.cos(middle) * radius * 0.6;
      ctx.drawImage(icon, Math.round(cx - icon.width / 2), Math.round(cy - icon.height / 2));
    });
  }

  let wheelTurns = 0;
  let spinning = false;

  function openWheel() {
    $("wheel-modal").hidden = false;
    const spent = state.lastSpin === todayKey();
    $("wheel-spin").disabled = spent;
    $("wheel-result").textContent = spent ? "Vous avez déjà tourné la roue aujourd’hui. Revenez demain !" : "Un tour gratuit par jour. Bonne chance !";
  }

  function spinWheel() {
    if (spinning || state.lastSpin === todayKey()) return;
    spinning = true;
    state.lastSpin = todayKey();
    state.stats.spins = (state.stats.spins || 0) + 1;
    $("wheel-spin").disabled = true;
    // Tirage au sort selon les chances de chaque case.
    const total = WHEEL.reduce((sum, w) => sum + w.weight, 0);
    let pick = Math.random() * total;
    const index = WHEEL.findIndex((w) => (pick -= w.weight) < 0);
    // 5 tours complets, puis on s’arrête avec la case gagnante sous la flèche.
    const part = 360 / WHEEL.length;
    wheelTurns += 5 * 360 + (360 - ((wheelTurns % 360) + (index + 0.5) * part) % 360);
    const canvas = $("wheel-canvas");
    canvas.style.transform = `rotate(${wheelTurns}deg)`;
    $("wheel-result").textContent = "La roue tourne…";
    const done = () => {
      canvas.removeEventListener("transitionend", done);
      spinning = false;
      $("wheel-result").innerHTML = "Gagné : " + applyWheel(WHEEL[index]);
      render();
    };
    canvas.addEventListener("transitionend", done);
    // Si l’animation est coupée (mouvement réduit), on donne le gain quand même.
    if (getComputedStyle(canvas).transitionDuration === "0s") done();
  }

  function applyWheel(w) {
    const production = Math.max(perSecond(), 1);
    switch (w.id) {
      case "tresor": {
        const gain = Math.max(200, production * 1800);
        earn(gain, "evenements");
        return `+${format(gain)} ${COIN}`;
      }
      case "gros": {
        const gain = Math.max(1000, production * 7200);
        earn(gain, "evenements");
        return `gros trésor, +${format(gain)} ${COIN}`;
      }
      case "frenesie":
        frenzy(FRENZY.mult, 60);
        return `frénésie ×${FRENZY.mult} pendant 60 s`;
      case "clicor":
        buffs.click = { mult: GOLD_CLICK.mult, until: performance.now() + 30000 };
        return `clic d’or ×${GOLD_CLICK.mult} pendant 30 s`;
      case "super":
        superFrenzy(30);
        return `super-frénésie ×${BOTTLE_STREAK.mult} pendant 30 s`;
      default:
        // Stocks remplis (ou un trésor si le marché n’est pas encore ouvert).
        if (!foodActive()) return applyWheel(WHEEL[0]);
        RESOURCES.forEach((r) => { if (count(buildingOf(r)) > 0) state.res[r.id] = storage(r); });
        return "tous les stocks remplis";
    }
  }

  // ---------------------------------------------------------------------------
  // 6 quater. Pêche à la ligne et routes commerciales
  // ---------------------------------------------------------------------------

  const fishingReady = () => Date.now() >= state.fishReadyAt;
  let fishing = null; // partie en cours : { pos, dir, zone, last }

  function openFishing() {
    $("fishing-modal").hidden = false;
    if (!fishingReady()) {
      $("fishing-result").textContent = `Les poissons reviennent dans ${formatDuration((state.fishReadyAt - Date.now()) / 1000)}.`;
      $("fishing-strike").disabled = true;
      return;
    }
    // Une zone verte placée au hasard, le centre doré au milieu.
    const zone = 0.1 + Math.random() * (0.8 - FISHING.zoneWidth);
    $("fishing-zone").style.left = zone * 100 + "%";
    $("fishing-zone").style.width = FISHING.zoneWidth * 100 + "%";
    $("fishing-result").textContent = "Attendez que le curseur passe dans la zone verte…";
    $("fishing-strike").disabled = false;
    fishing = { pos: 0, dir: 1, zone, last: performance.now() };
    requestAnimationFrame(moveCursor);
  }

  function moveCursor(now) {
    if (!fishing) return;
    const dt = Math.min(0.05, (now - fishing.last) / 1000);
    fishing.last = now;
    fishing.pos += fishing.dir * FISHING.speed * dt;
    if (fishing.pos >= 1 || fishing.pos <= 0) {
      fishing.dir *= -1;
      fishing.pos = Math.max(0, Math.min(1, fishing.pos));
    }
    // Le curseur avance par crans de 2 %, comme dans un vieux jeu vidéo.
    $("fishing-cursor").style.left = Math.round(fishing.pos * 50) * 2 + "%";
    requestAnimationFrame(moveCursor);
  }

  function strike() {
    if (!fishing) return;
    const pos = Math.round(fishing.pos * 50) / 50;
    const zone = fishing.zone;
    fishing = null;
    state.fishReadyAt = Date.now() + FISHING.cooldown * 1000;
    $("fishing-strike").disabled = true;
    const center = zone + FISHING.zoneWidth / 2;
    const fish = RESOURCES.find((r) => r.id === "poisson");
    let result;
    if (Math.abs(pos - center) <= FISHING.goldWidth / 2) {
      const gain = Math.max(500, sellPrice(fish) * FISHING.goldPriceMult);
      earn(gain, "peche");
      state.stats.goldFish = (state.stats.goldFish || 0) + 1;
      result = `${icon("poisson_dore")} Poisson doré ! +${format(gain)} ${COIN}`;
    } else if (pos >= zone && pos <= zone + FISHING.zoneWidth) {
      const before = state.res.poisson;
      state.res.poisson = Math.min(storage(fish), before + storage(fish) * FISHING.silverStock);
      result = `${icon("poisson")} Un banc de poissons ! +${format(state.res.poisson - before)} poissons`;
    } else {
      result = "Raté… le poisson s’est échappé.";
    }
    $("fishing-result").innerHTML = result;
    render();
  }

  function closeFishing() {
    fishing = null;
    $("fishing-modal").hidden = true;
  }

  function renderFishing() {
    $("fishing-card").hidden = !foodActive();
    $("fishing-info").textContent = fishingReady()
      ? "Les poissons mordent ! Visez le centre doré."
      : `Prochaine pêche dans ${formatDuration((state.fishReadyAt - Date.now()) / 1000)}`;
    $("fishing-open").disabled = !fishingReady();
  }

  // ---- Routes commerciales ----
  const portOpen = () => (state.owned.port || 0) > 0;

  // Le bateau rentre tout seul (même pendant l’absence) : réussite ou tempête, tirée au retour.
  function checkExpedition() {
    const ship = state.expedition;
    if (!ship || Date.now() < ship.returnAt) return;
    state.expedition = null;
    const route = ROUTES.find((r) => r.id === ship.route);
    if (Math.random() < route.risk) {
      state.stats.shipwrecks = (state.stats.shipwrecks || 0) + 1;
      toast(`${icon("bateau")} Tempête sur la ${route.name.toLowerCase()} : la cargaison est perdue…`);
    } else {
      earn(ship.value, "expeditions");
      state.stats.expeditions = (state.stats.expeditions || 0) + 1;
      toast(`${icon("bateau")} Le bateau rentre de la ${route.name.toLowerCase()} : +${format(ship.value)} ${COIN}`);
    }
  }

  function onExpeditionClick(event) {
    const pickRes = event.target.closest("[data-exp-res]");
    if (pickRes) {
      // Chaque appui passe à la ressource suivante.
      const list = RESOURCES.filter((r) => count(buildingOf(r)) > 0);
      const i = list.findIndex((r) => r.id === state.expeditionRes);
      state.expeditionRes = list[(i + 1) % list.length].id;
      expeditionKey = "";
      render();
      return;
    }
    const button = event.target.closest("[data-route]");
    if (!button || button.disabled || state.expedition) return;
    const route = ROUTES.find((r) => r.id === button.dataset.route);
    const r = RESOURCES.find((x) => x.id === state.expeditionRes);
    const qty = Math.floor(state.res[r.id]);
    if (qty < EXPEDITION_MIN_LOAD) return;
    state.res[r.id] -= qty;
    state.expedition = { route: route.id, res: r.id, qty, value: qty * sellPrice(r) * route.mult, returnAt: Date.now() + route.minutes * 60000 };
    toast(`${icon("bateau")} Le bateau part sur la ${route.name.toLowerCase()} avec ${format(qty)} ${r.plural}`);
    expeditionKey = "";
    render();
  }

  // La carte est reconstruite seulement quand son contenu change (au plus une fois par seconde).
  let expeditionKey = "";
  function renderExpedition() {
    $("expedition").hidden = !portOpen();
    if (!portOpen()) return;
    if (!RESOURCES.some((r) => r.id === state.expeditionRes && count(buildingOf(r)) > 0)) state.expeditionRes = "poisson";
    const ship = state.expedition;
    const r = RESOURCES.find((x) => x.id === (ship ? ship.res : state.expeditionRes));
    const stock = Math.floor(state.res[r.id]);
    const key = ship ? `${ship.route}|${Math.ceil((ship.returnAt - Date.now()) / 1000)}` : `${r.id}|${stock}|${format(sellPrice(r), true)}`;
    if (key === expeditionKey) return;
    expeditionKey = key;
    let html = `<span class="item-icon">${icon("bateau")}</span><span class="item-text"><span class="item-name">Routes commerciales</span>`;
    if (ship) {
      const route = ROUTES.find((x) => x.id === ship.route);
      const left = Math.max(0, (ship.returnAt - Date.now()) / 1000);
      html += `<span class="item-info">En route : ${route.name}, ${format(ship.qty)} ${r.plural}</span>
        <span class="item-effect">Valeur attendue : ${format(ship.value)} ${COIN}${route.risk ? ` · risque de tempête ${Math.round(route.risk * 100)}\u00a0%` : ""}</span>
        <span class="bar"><span class="bar-fill" style="width:${100 - (left / (route.minutes * 60)) * 100}%"></span></span>
        <span class="item-info">Retour dans ${formatDuration(left)}</span></span>`;
    } else {
      html += `<span class="item-info">Envoyez tout votre stock vers une autre île. Plus c’est loin, plus ça rapporte… et plus c’est risqué.</span></span>
        <div class="routes">
          <button type="button" class="route-res" data-exp-res>Cargaison : ${icon(r.id)} ${format(stock)} ${r.plural}</button>
          ${ROUTES.map((route) => `
            <button type="button" class="route" data-route="${route.id}" ${stock < EXPEDITION_MIN_LOAD ? "disabled" : ""}>
              <span class="item-name">${route.name}</span>
              <span class="item-info">${formatDuration(route.minutes * 60)} · ${route.risk ? `risque ${Math.round(route.risk * 100)}\u00a0%` : "sans risque"}</span>
              <span class="item-price">${stock >= EXPEDITION_MIN_LOAD ? "≈ " + format(stock * sellPrice(r) * route.mult) : "min. " + EXPEDITION_MIN_LOAD} ${COIN}</span>
            </button>`).join("")}
        </div>`;
    }
    $("expedition").innerHTML = html;
  }

  // ---------------------------------------------------------------------------
  // 6 quinquies. Habitants célèbres
  // ---------------------------------------------------------------------------

  let nextVisitorAt = performance.now() + CELEBS.firstDelay * 1000;
  function checkVisitor(now) {
    if (state.visitor && Date.now() > state.visitor.expiresAt) {
      const gone = CELEBRITIES.find((c) => c.id === state.visitor.id);
      state.visitor = null;
      toast(`${icon("habitant", gone.look)} ${gone.name} est reparti, faute de réponse`);
    }
    if (state.visitor || now < nextVisitorAt || population() < CELEBS.minPop) return;
    nextVisitorAt = now + randomBetween(CELEBS.minDelay, CELEBS.maxDelay) * 1000;
    const candidates = CELEBRITIES.filter((c) => !state.celebs.includes(c.id));
    if (!candidates.length) return;
    const celeb = candidates[Math.floor(Math.random() * candidates.length)];
    state.visitor = { id: celeb.id, expiresAt: Date.now() + CELEBS.decide * 1000 };
    toast(`${icon("habitant", celeb.look)} ${celeb.name} débarque sur l’île ! (onglet Métiers)`);
  }

  function onCelebClick(event) {
    const button = event.target.closest("[data-celeb]");
    if (!button || button.disabled) return;
    const action = button.dataset.celeb;
    if (action === "accept" && state.visitor && state.celebs.length < CELEBS.slots) {
      const celeb = CELEBRITIES.find((c) => c.id === state.visitor.id);
      state.celebs.push(celeb.id);
      state.stats.celebs = (state.stats.celebs || 0) + 1;
      state.visitor = null;
      toast(`${icon("habitant", celeb.look)} ${celeb.name} s’installe : ${celeb.info}`);
    } else if (action === "refuse") {
      state.visitor = null;
    } else if (action.startsWith("leave:")) {
      state.celebs = state.celebs.filter((id) => id !== action.slice(6));
    }
    celebKey = "";
    render();
  }

  let celebKey = "";
  function renderCelebs() {
    const visitor = state.visitor && CELEBRITIES.find((c) => c.id === state.visitor.id);
    const full = state.celebs.length >= CELEBS.slots;
    const key = (visitor ? visitor.id + Math.ceil((state.visitor.expiresAt - Date.now()) / 1000) : "") + "|" + state.celebs.join(",");
    if (key === celebKey) return;
    celebKey = key;
    const portrait = (c) => `<span class="item-icon celeb-portrait">${icon("habitant", c.look)}${icon("etoile", undefined, "px celeb-star")}</span>`;
    $("visitor").hidden = !visitor;
    if (visitor) {
      $("visitor").innerHTML = `${portrait(visitor)}
        <span class="item-text">
          <span class="item-name">${visitor.name} débarque !</span>
          <span class="item-effect">${visitor.info}</span>
          <span class="item-info">${full ? "L’île est pleine : renvoyez quelqu’un ci-dessous pour l’accueillir." : "Voulez-vous l’accueillir sur l’île ?"}
            Repart dans ${formatDuration(Math.max(0, (state.visitor.expiresAt - Date.now()) / 1000))}.</span>
        </span>
        <span class="order-actions">
          <button type="button" class="sell" data-celeb="accept" ${full ? "disabled" : ""}>Accueillir</button>
          <button type="button" class="refuse" data-celeb="refuse">Refuser</button>
        </span>`;
    }
    $("celeb-count").textContent = `${state.celebs.length} / ${CELEBS.slots}`;
    $("celebs").innerHTML = state.celebs.length
      ? state.celebs.map((id) => {
        const c = CELEBRITIES.find((x) => x.id === id);
        return `<div class="card celeb-card">${portrait(c)}
          <span class="item-text"><span class="item-name">${c.name}</span><span class="item-effect">${c.info}</span></span>
          <button type="button" class="refuse" data-celeb="leave:${c.id}">Renvoyer</button></div>`;
      }).join("")
      : `<p class="panel-intro">Personne pour l’instant. Un visiteur célèbre passe de temps en temps quand l’île a plus de ${CELEBS.minPop} habitants.</p>`;
  }

  // ---------------------------------------------------------------------------
  // 7. Sauvegarde
  // ---------------------------------------------------------------------------

  function save() {
    state.savedAt = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (e) {
      // Navigation privée ou stockage bloqué : le jeu continue sans sauvegarde.
    }
  }

  function load() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    } catch (e) {
      saved = null;
    }
    if (!saved || typeof saved.coins !== "number") return;
    state = Object.assign(newState(), saved);

    // Gains pendant l’absence, plafonnés à 8 h.
    const away = Math.min((Date.now() - state.savedAt) / 1000, OFFLINE_MAX_S);
    const gain = perSecond() * away;
    updateEconomy(away);
    if (away > 60 && gain >= 1) {
      earn(gain);
      toast(`Pendant votre absence : +${format(gain)} ${COIN}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Démarrage et boucle de jeu
  // ---------------------------------------------------------------------------

  buildBackdrop();
  art.drawIsland($("island-canvas"));
  sizeIsland();
  window.addEventListener("resize", sizeIsland);
  buildShop();
  buildPanels();
  buildAchievements();
  drawWheel();
  load();
  render();

  $("island").addEventListener("click", onIslandClick);
  $("buildings").addEventListener("click", onShopClick);
  $("upgrades").addEventListener("click", onShopClick);
  $("reset").addEventListener("click", onReset);
  document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
  window.addEventListener("pagehide", save);
  $("buy-mode").addEventListener("click", onBuyModeClick);
  $("auto-mode").addEventListener("click", onAutoModeClick);
  $("tabs").addEventListener("click", onTabClick);
  $("jobs").addEventListener("click", onJobClick);
  $("market").addEventListener("click", onSellClick);
  $("order").addEventListener("click", onOrderClick);
  $("bank-actions").addEventListener("click", onBankClick);
  setInterval(save, SAVE_EVERY_MS);
  setInterval(autoBuy, 1000);
  setInterval(autoSell, 1000);
  setInterval(checkAchievements, 1000);
  $("wheel-open").addEventListener("click", openWheel);
  $("wheel-spin").addEventListener("click", spinWheel);
  $("wheel-close").addEventListener("click", () => { $("wheel-modal").hidden = true; });
  $("fishing-open").addEventListener("click", openFishing);
  $("fishing-strike").addEventListener("click", strike);
  $("fishing-close").addEventListener("click", closeFishing);
  $("expedition").addEventListener("click", onExpeditionClick);
  $("panel-jobs").addEventListener("click", onCelebClick);
  updateDayNight();
  setInterval(updateDayNight, 60000);

  let lastTick = performance.now();
  let lastRender = 0;
  function tick(now) {
    // Quand l’onglet est caché, le navigateur met la boucle en pause : on rattrape au retour.
    // Le bonus de frénésie ne compte pas pour ce rattrapage.
    const seconds = Math.min((now - lastTick) / 1000, OFFLINE_MAX_S);
    lastTick = now;
    earn((seconds > 1 ? perSecond() : productionRate()) * seconds);
    updateEconomy(seconds);
    if (seconds <= 1) state.stats.playTime += seconds; // seulement le temps passé sur la page
    checkEvents(performance.now());
    if (now - lastRender > 100) { // 10 rafraîchissements par seconde suffisent
      lastRender = now;
      render();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
