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

  // ---------------------------------------------------------------------------
  // 2. État de la partie
  // ---------------------------------------------------------------------------

  function newState() {
    return { coins: 0, totalEarned: 0, owned: {}, upgrades: {}, stage: 0, savedAt: Date.now() };
  }
  let state = newState();

  // ---------------------------------------------------------------------------
  // 3. Calculs
  // ---------------------------------------------------------------------------

  const count = (b) => state.owned[b.id] || 0;
  const price = (b) => Math.ceil(b.cost * Math.pow(PRICE_GROWTH, count(b)));
  const perSecond = () => BUILDINGS.reduce((sum, b) => sum + b.cps * count(b), 0);
  const population = () => BUILDINGS.reduce((sum, b) => sum + b.pop * count(b), 0);

  function clickValue() {
    let value = 1;
    if (state.upgrades.machette) value *= 2;
    if (state.upgrades.pirogue) value *= 2;
    if (state.upgrades.boussole) value += perSecond() * 0.01;
    return value;
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
    $("per-second").textContent = format(perSecond(), true);
    $("population").textContent = format(population());
    $("click-value").textContent = "+" + format(clickValue(), true);

    const stage = STAGES[stageIndex()];
    const next = STAGES[stageIndex() + 1];
    $("stage-title").textContent = stage.title;
    $("island-emoji").textContent = stage.emoji;
    $("stage-next").textContent = next
      ? `Prochain palier : ${next.title} à ${format(next.pop)} habitants`
      : "Votre île est devenue une nation ! 🎉";

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
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Actions du joueur
  // ---------------------------------------------------------------------------

  function onIslandClick(event) {
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
  // 6. Sauvegarde
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
  // 7. Démarrage et boucle de jeu
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
    const seconds = Math.min((now - lastTick) / 1000, OFFLINE_MAX_S);
    lastTick = now;
    earn(perSecond() * seconds);
    if (now - lastRender > 100) { // 10 rafraîchissements par seconde suffisent
      lastRender = now;
      render();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
