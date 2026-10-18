(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // 1. Données du jeu — modifier ici pour équilibrer
  // ---------------------------------------------------------------------------

  // cost : prix de départ, cps : pièces par seconde, pop : habitants attirés
  const BUILDINGS = [
    { id: "hutte",   emoji: "🛖", name: "Hutte de palmes",    cost: 15,       cps: 0.1,  pop: 1 },
    { id: "pecheur", emoji: "🎣", name: "Cabane de pêcheur",  cost: 100,      cps: 1,    pop: 2 },
    { id: "cocos",   emoji: "🌴", name: "Cocoteraie",         cost: 1100,     cps: 8,    pop: 5 },
    { id: "port",    emoji: "⚓", name: "Petit port",         cost: 12000,    cps: 47,   pop: 15 },
    { id: "marche",  emoji: "🏪", name: "Marché",             cost: 130000,   cps: 260,  pop: 40 },
    { id: "hotel",   emoji: "🏨", name: "Hôtel de plage",     cost: 1400000,  cps: 1400, pop: 120 },
    { id: "aero",    emoji: "✈️", name: "Aéroport",           cost: 20000000, cps: 7800, pop: 400 },
  ];
  const PRICE_GROWTH = 1.15; // +15 % à chaque achat

  // unlock : total de pièces gagnées pour voir l’amélioration
  const UPGRADES = [
    { id: "machette", emoji: "🪓", name: "Machette", info: "Clic ×2", cost: 100, unlock: 50 },
    { id: "pirogue",  emoji: "🛶", name: "Pirogue",  info: "Clic ×2", cost: 1000, unlock: 500 },
    { id: "boussole", emoji: "🧭", name: "Boussole", info: "+1 % de la prod. par clic", cost: 50000, unlock: 20000 },
  ];

  const STAGES = [
    { pop: 0,      emoji: "🏝️", title: "Îlot désert" },
    { pop: 10,     emoji: "⛺", title: "Campement" },
    { pop: 100,    emoji: "🏘️", title: "Village" },
    { pop: 1000,   emoji: "🏡", title: "Bourg" },
    { pop: 10000,  emoji: "🏙️", title: "Ville" },
    { pop: 100000, emoji: "🗽", title: "Île-nation" },
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
    return { coins: 0, totalEarned: 0, owned: {}, upgrades: {}, stage: 0, savedAt: Date.now() };
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
  const price = (b) => Math.ceil(b.cost * Math.pow(PRICE_GROWTH, count(b)));
  const perSecond = () => BUILDINGS.reduce((sum, b) => sum + b.cps * count(b), 0);
  const population = () => BUILDINGS.reduce((sum, b) => sum + b.pop * count(b), 0);

  const buffMult = (buff) => (performance.now() < buff.until ? buff.mult : 1);
  const productionRate = () => perSecond() * buffMult(buffs.prod);
  const comboMult = () => 1 + Math.min(combo, COMBO_MAX) / COMBO_MAX;

  function clickValue() {
    let value = 1;
    if (state.upgrades.machette) value *= 2;
    if (state.upgrades.pirogue) value *= 2;
    if (state.upgrades.boussole) value += perSecond() * 0.01;
    return value * buffMult(buffs.click) * comboMult();
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
      <button class="item" type="button" data-building="${b.id}" hidden>
        <span class="item-emoji">${b.emoji}</span>
        <span>
          <span class="item-name">${b.name}</span><br>
          <span class="item-info">+${format(b.cps, true)} 🪙/s · +${b.pop} 👥</span><br>
          <span class="item-price"></span>
        </span>
        <span class="item-count"></span>
      </button>`).join("");

    $("upgrades").innerHTML = UPGRADES.map((u) => `
      <button class="item upgrade" type="button" data-upgrade="${u.id}" hidden>
        <span class="item-emoji">${u.emoji}</span>
        <span>
          <span class="item-name">${u.name}</span><br>
          <span class="item-info">${u.info}</span><br>
          <span class="item-price">${format(u.cost)} 🪙</span>
        </span>
      </button>`).join("");
  }

  function render() {
    $("coins").textContent = format(state.coins);
    $("per-second").textContent = format(productionRate(), true);
    $("population").textContent = format(population());
    $("click-value").textContent = "+" + format(clickValue(), true);
    $("combo").textContent = combo >= 5 ? `Combo ×${format(comboMult(), true)}` : "";

    const active = [];
    const now = performance.now();
    if (now < buffs.prod.until) active.push(`🔥 Frénésie : production ×${FRENZY.mult} · ${Math.ceil((buffs.prod.until - now) / 1000)} s`);
    if (now < buffs.click.until) active.push(`✨ Clic d’or : clic ×${GOLD_CLICK.mult} · ${Math.ceil((buffs.click.until - now) / 1000)} s`);
    $("buffs").textContent = active.join("  ");
    $("buffs").hidden = active.length === 0;

    const stage = STAGES[stageIndex()];
    const next = STAGES[stageIndex() + 1];
    $("stage-title").textContent = stage.title;
    $("island-emoji").textContent = stage.emoji;
    const pop = population();
    $("stage-next").textContent = next
      ? `${format(pop)} / ${format(next.pop)} habitants · prochain palier : ${next.title}`
      : "Votre île est devenue une nation ! 🎉";
    const progress = next ? (pop - stage.pop) / (next.pop - stage.pop) : 1;
    $("progress-fill").style.width = Math.min(100, progress * 100) + "%";
    renderScene();

    // Un bâtiment apparaît quand on a gagné la moitié de son prix (le premier est toujours visible).
    BUILDINGS.forEach((b, i) => {
      const el = document.querySelector(`[data-building="${b.id}"]`);
      el.hidden = !(i === 0 || count(b) > 0 || state.totalEarned >= b.cost / 2);
      el.disabled = state.coins < price(b);
      el.querySelector(".item-price").textContent = format(price(b)) + " 🪙";
      el.querySelector(".item-count").textContent = count(b) || "";
    });

    let anyUpgrade = false;
    UPGRADES.forEach((u) => {
      const el = document.querySelector(`[data-upgrade="${u.id}"]`);
      const visible = !state.upgrades[u.id] && state.totalEarned >= u.unlock;
      el.hidden = !visible;
      el.disabled = state.coins < u.cost;
      anyUpgrade = anyUpgrade || visible;
    });
    $("upgrades-block").hidden = !anyUpgrade;
  }

  let toastTimer;
  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3500);
  }

  function floatText(x, y, text) {
    const el = document.createElement("span");
    el.className = "float";
    el.textContent = text;
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.addEventListener("animationend", () => el.remove());
    document.body.appendChild(el);
  }

  function checkStage() {
    const i = stageIndex();
    if (i > state.stage) {
      state.stage = i;
      toast(`${STAGES[i].emoji} Votre île devient : ${STAGES[i].title} !`);
      confetti();
    }
  }

  // ---------------------------------------------------------------------------
  // Le village dessiné sur l’île
  // ---------------------------------------------------------------------------

  const VILLAGERS = ["🧍", "🧍‍♀️", "🧑", "👩", "👨", "🧒", "👵", "🧔", "👧", "👴"];
  const MAX_SCENE_BUILDINGS = 18;

  // Place n°i sur l’île : une spirale autour du centre, pour que chaque objet garde sa place.
  function spot(i) {
    const angle = i * 2.39996; // angle d’or : les objets se répartissent sans se superposer
    const radius = 22 + (i % 4) * 5;
    return { x: 50 + radius * Math.cos(angle), y: 50 + radius * 0.85 * Math.sin(angle) };
  }

  function sceneItem(className, emoji, place, extraStyle) {
    return `<span class="${className}" style="left:${place.x}%;top:${place.y}%;${extraStyle || ""}">${emoji}</span>`;
  }

  // Redessine seulement quand le nombre de bâtiments ou d’habitants change.
  let sceneKey = "";
  function renderScene() {
    const pop = population();
    const villagers = Math.min(10, Math.round(Math.sqrt(pop) * 1.2));
    const key = BUILDINGS.map(count).join(",") + "|" + villagers;
    if (key === sceneKey) return;
    sceneKey = key;

    const html = [];
    let slot = 0;
    BUILDINGS.forEach((b) => {
      for (let n = 0; n < Math.min(count(b), 3) && slot < MAX_SCENE_BUILDINGS; n++) {
        html.push(sceneItem("scene-building", b.emoji, spot(slot++)));
      }
    });
    for (let i = 0; i < villagers; i++) {
      // Chaque habitant se promène à son rythme (durée et sens différents).
      const wander = `--dx:${(i % 2 ? 1 : -1) * (8 + (i % 3) * 6)}px;--dur:${3 + (i % 4)}s`;
      html.push(sceneItem("villager", VILLAGERS[i % VILLAGERS.length], spot(MAX_SCENE_BUILDINGS + i * 3 + 1), wander));
    }
    $("scene").innerHTML = html.join("");
  }

  // Les nouveaux arrivants débarquent par le bas de l’île puis rejoignent le village.
  function welcome(newcomers) {
    const scene = $("arrivals"); // calque à part : le village peut se redessiner sans les effacer
    for (let i = 0; i < Math.min(newcomers, 5); i++) {
      const el = document.createElement("span");
      el.className = "newcomer";
      el.textContent = VILLAGERS[Math.floor(Math.random() * VILLAGERS.length)];
      el.style.left = 40 + Math.random() * 20 + "%";
      el.style.setProperty("--to-x", (Math.random() - 0.5) * 120 + "px");
      el.style.animationDelay = i * 0.15 + "s";
      el.addEventListener("animationend", () => el.remove());
      scene.appendChild(el);
    }
    const rect = $("island").getBoundingClientRect();
    floatText(rect.left + rect.width / 2, rect.top + rect.height * 0.8, `+${newcomers} 👥 Bienvenue !`);

    const counter = $("population");
    counter.classList.remove("bump");
    void counter.offsetWidth; // relance l’animation
    counter.classList.add("bump");
  }

  function confetti() {
    const pieces = ["🎉", "🌺", "🐚", "⭐", "🥥", "🎊"];
    for (let i = 0; i < 30; i++) {
      const el = document.createElement("span");
      el.className = "confetti";
      el.textContent = pieces[i % pieces.length];
      el.style.left = Math.random() * 100 + "%";
      el.style.animationDelay = Math.random() * 0.6 + "s";
      el.style.animationDuration = 2 + Math.random() * 1.5 + "s";
      el.addEventListener("animationend", () => el.remove());
      document.body.appendChild(el);
    }
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
    floatText(x, y, "+" + format(value, true) + " 🪙");
    render();
  }

  function onShopClick(event) {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;

    const building = BUILDINGS.find((b) => b.id === button.dataset.building);
    if (building && state.coins >= price(building)) {
      state.coins -= price(building);
      state.owned[building.id] = count(building) + 1;
      welcome(building.pop);
      checkStage();
    }

    const upgrade = UPGRADES.find((u) => u.id === button.dataset.upgrade);
    if (upgrade && !state.upgrades[upgrade.id] && state.coins >= upgrade.cost) {
      state.coins -= upgrade.cost;
      state.upgrades[upgrade.id] = true;
      toast(`${upgrade.emoji} ${upgrade.name} achetée : ${upgrade.info}`);
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
    toast("🏝️ Nouvelle partie : retour sur l’îlot désert");
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
    el.textContent = "🍾";
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
      rewardAt(el, "+" + format(gain) + " 🪙");
      toast(`🍾 Un trésor dans la bouteille : +${format(gain)} 🪙`);
    } else if (roll < 0.8) {
      buffs.prod = { mult: FRENZY.mult, until: performance.now() + FRENZY.seconds * 1000 };
      rewardAt(el, "🔥 ×" + FRENZY.mult);
      toast(`🔥 Frénésie ! Production ×${FRENZY.mult} pendant ${FRENZY.seconds} s`);
    } else {
      buffs.click = { mult: GOLD_CLICK.mult, until: performance.now() + GOLD_CLICK.seconds * 1000 };
      rewardAt(el, "✨ ×" + GOLD_CLICK.mult);
      toast(`✨ Clic d’or ! Chaque clic ×${GOLD_CLICK.mult} pendant ${GOLD_CLICK.seconds} s`);
    }
    render();
  }

  function spawnBoat() {
    boatOnScreen = true;
    const el = document.createElement("button");
    el.type = "button";
    el.className = "boat";
    el.textContent = "⛵";
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
      rewardAt(el, "+" + format(gain) + " 🪙");
      toast(`⛵ Des touristes débarquent et dépensent +${format(gain)} 🪙`);
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
      toast(`Pendant votre absence : +${format(gain)} 🪙`);
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Démarrage et boucle de jeu
  // ---------------------------------------------------------------------------

  buildShop();
  load();
  render();

  $("island").addEventListener("click", onIslandClick);
  $("buildings").addEventListener("click", onShopClick);
  $("upgrades").addEventListener("click", onShopClick);
  $("reset").addEventListener("click", onReset);
  document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
  window.addEventListener("pagehide", save);
  setInterval(save, SAVE_EVERY_MS);

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
