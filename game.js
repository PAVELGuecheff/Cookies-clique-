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

  // ---------------------------------------------------------------------------
  // 2. État de la partie
  // ---------------------------------------------------------------------------

  function newState() {
    return {
      coins: 0, totalEarned: 0, owned: {}, upgrades: {}, stage: 0, savedAt: Date.now(),
      auto: {},   // bâtiments en achat automatique
      buyMode: 1, // achat par 1, 10 ou "max"
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
  const unitPrice = (b, extra) => Math.ceil(b.cost * Math.pow(PRICE_GROWTH, count(b) + extra));
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
  const buildingCps = (b) => b.cps * ownedUpgrades().reduce((m, u) => (u.effect.building === b.id ? m * 2 : m), 1);
  const popBonus = () => ownedUpgrades().reduce((sum, u) => sum + (u.effect.popBonus || 0), 0) * population();
  const perSecond = () => BUILDINGS.reduce((sum, b) => sum + buildingCps(b) * count(b), 0) * (1 + popBonus());

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

  const hasAutomation = () => ownedUpgrades().some((u) => u.effect.auto);

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

  function earn(amount) {
    state.coins += amount;
    state.totalEarned += amount;
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
  const BIG = [[1e12, "Bn"], [1e9, "Md"], [1e6, "M"]];

  function format(n, decimals) {
    for (const [size, unit] of BIG) {
      if (n >= size) return decFmt.format(Math.floor(n / size * 10) / 10) + " " + unit;
    }
    if (decimals && n < 100) return decFmt.format(Math.floor(n * 10) / 10);
    return intFmt.format(Math.floor(n));
  }

  // Les boutons sont créés une fois, puis seuls leurs textes sont mis à jour.
  function buildShop() {
    $("buildings").innerHTML = BUILDINGS.map((b) => `
      <div class="row" data-row="${b.id}" hidden>
        <button class="item" type="button" data-building="${b.id}">
          <span class="item-icon">${icon(b.id)}</span>
          <span class="item-text">
            <span class="item-name">${b.name}</span>
            <span class="item-info">+<span class="cps"></span> ${COIN}/s · +${b.pop} ${PEOPLE}</span>
            <span class="item-price"><span class="cost"></span> ${COIN}<span class="qty"></span></span>
          </span>
          <span class="item-count"></span>
        </button>
        <button class="auto-toggle" type="button" data-auto="${b.id}" aria-pressed="false" hidden
          aria-label="Achat automatique : ${b.name}">${icon("engrenage")}<span>Auto</span></button>
      </div>`).join("");

    $("upgrades").innerHTML = UPGRADES.map((u) => `
      <button class="item upgrade" type="button" data-upgrade="${u.id}" hidden>
        <span class="item-icon">${icon(u.icon)}${u.badge ? `<span class="badge">${u.badge}</span>` : ""}</span>
        <span class="item-text">
          <span class="item-name">${u.name}</span>
          <span class="item-info">${u.info}</span>
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

    const active = [];
    const now = performance.now();
    if (now < buffs.prod.until) active.push(`Frénésie : production ×${FRENZY.mult} · ${Math.ceil((buffs.prod.until - now) / 1000)} s`);
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
      el.querySelector(".item-count").textContent = count(b) || "";

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
    const key = stageIndex() + "|" + BUILDINGS.map(count).join(",") + "|" + villagers;
    if (key === sceneKey) return;
    sceneKey = key;

    const html = [placeSprite(STAGES[stageIndex()].landmark, ISLAND.cx, ISLAND.cy + 9, "landmark")];
    let slot = 0;
    BUILDINGS.forEach((b) => {
      for (let n = 0; n < Math.min(count(b), 3) && slot < MAX_SCENE_BUILDINGS; n++) {
        const place = SLOTS[slot++];
        html.push(placeSprite(b.id, place.x, place.y, "scene-building"));
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
    earn(value);
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

  // L’intendant achète, une fois par seconde, le bâtiment automatique le moins cher tant qu’il le peut.
  function autoBuy() {
    if (!hasAutomation()) return;
    const chosen = BUILDINGS.filter((b) => state.auto[b.id]);
    let newcomers = 0;
    for (let n = 0; n < MAX_AUTO_BUYS_PER_SECOND && chosen.length; n++) {
      const cheapest = chosen.reduce((best, b) => (unitPrice(b, 0) < unitPrice(best, 0) ? b : best));
      const cost = unitPrice(cheapest, 0);
      if (state.coins < cost) break;
      state.coins -= cost;
      state.owned[cheapest.id] = count(cheapest) + 1;
      newcomers += cheapest.pop;
    }
    if (newcomers > 0) {
      welcome(newcomers);
      checkStage();
      render();
    }
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
      toast(`${icon(upgrade.icon)} ${upgrade.name} achetée : ${upgrade.info}`);
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
    }, BOTTLE.lifetime * 1000);
    el.addEventListener("click", () => {
      clearTimeout(timer);
      bottleOnScreen = false;
      openBottle(el);
    });
    document.body.appendChild(el);
  }

  function openBottle(el) {
    const roll = Math.random();
    if (roll < 0.5) {
      const gain = Math.max(clickValue() * 30, Math.min(state.coins * 0.15, perSecond() * 900));
      earn(gain);
      rewardAt(el, "+" + format(gain) + " " + COIN);
      toast(`${icon("bouteille")} Un trésor dans la bouteille : +${format(gain)} ${COIN}`);
    } else if (roll < 0.8) {
      buffs.prod = { mult: FRENZY.mult, until: performance.now() + FRENZY.seconds * 1000 };
      rewardAt(el, "Frénésie ×" + FRENZY.mult);
      toast(`${icon("bouteille")} Frénésie ! Production ×${FRENZY.mult} pendant ${FRENZY.seconds} s`);
    } else {
      buffs.click = { mult: GOLD_CLICK.mult, until: performance.now() + GOLD_CLICK.seconds * 1000 };
      rewardAt(el, "Clic d’or ×" + GOLD_CLICK.mult);
      toast(`${icon("bouteille")} Clic d’or ! Chaque clic ×${GOLD_CLICK.mult} pendant ${GOLD_CLICK.seconds} s`);
    }
    render();
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
      const gain = Math.max(50, perSecond() * 120 + clickValue() * 25);
      earn(gain);
      rewardAt(el, "+" + format(gain) + " " + COIN);
      toast(`${icon("bateau")} Des touristes débarquent et dépensent +${format(gain)} ${COIN}`);
      render();
    });
    document.body.appendChild(el);
  }

  function checkEvents(now) {
    if (!bottleOnScreen && now >= nextBottleAt) {
      spawnBottle();
      nextBottleAt = now + randomBetween(BOTTLE.minDelay, BOTTLE.maxDelay) * 1000;
    }
    if (!boatOnScreen && now >= nextBoatAt) {
      spawnBoat();
      nextBoatAt = now + randomBetween(BOAT.minDelay, BOAT.maxDelay) * 1000;
    }
    if (combo > 0 && now - lastClickAt > COMBO_WINDOW_MS * 2) combo = 0;
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
  load();
  render();

  $("island").addEventListener("click", onIslandClick);
  $("buildings").addEventListener("click", onShopClick);
  $("upgrades").addEventListener("click", onShopClick);
  $("reset").addEventListener("click", onReset);
  document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
  window.addEventListener("pagehide", save);
  $("buy-mode").addEventListener("click", onBuyModeClick);
  setInterval(save, SAVE_EVERY_MS);
  setInterval(autoBuy, 1000);
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
    checkEvents(performance.now());
    if (now - lastRender > 100) { // 10 rafraîchissements par seconde suffisent
      lastRender = now;
      render();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
