import { initAssets, assetsReady, assets } from './game/assets.js';
import { initControls } from './game/controls.js';
import { world, player, makeLevel, setLevel } from './game/level.js';
import { startEngine } from './game/engine.js';
import { initRender } from './game/render.js';
import { initQuizInput, loadQuestions, setSession, getStudentStats, getQuizProgress, isQuizActive } from './game/quiz_engine.js';
import { initChatbot } from './game/chatbot.js';
import { initLivreDialog } from './game/livre_dialog.js';
import { restartMusic, startMusic } from './game/sound.js';

const API = 'http://localhost:5001/api';
const STORAGE_KEY = 'geniusjump_student';
const ECONOMY_KEY = 'geniusjump_student_economy';
const SETTINGS_KEY = 'geniusjump_student_settings';

const canvas = document.getElementById('game');

initAssets();
initControls();
initRender(canvas, world, player, assets, assetsReady);
initQuizInput();
window.isQuizActive = isQuizActive;
window.getQuizProgress = getQuizProgress;
initChatbot();
initLivreDialog();

window.gameState = 'menu';
window.currentLevel = 1;

setLevel(1);
makeLevel();
startEngine(canvas, world, player);

// ── Écran de chargement initial ──
function initLoadingScreen() {
  const loader = document.getElementById('loading-screen');
  if (loader) {
    setTimeout(() => {
      loader.classList.add('fade-out');
      setTimeout(() => {
        loader.remove();
      }, 500);
    }, 5000);
  }
}
initLoadingScreen();

// ── DOM ───────────────────────────────────────────────────────────────────────
const menuOverlay = document.getElementById('menuOverlay');
const roleScreen = document.getElementById('role-screen');
const loginScreen = document.getElementById('login-screen');
const hubScreen = document.getElementById('hub-screen');
const loginError = document.getElementById('login-error');
const menuResume = document.getElementById('menu-resume');
const menuPlay = document.getElementById('menu-play');
const menuQuit = document.getElementById('menu-quit');
const pauseBtn = document.getElementById('pauseBtn');

const characterSection = document.getElementById('character-section');
const characterHint = document.getElementById('character-hint');
const activitiesList = document.getElementById('activities-list');
const activitiesHint = document.getElementById('activities-hint');
const selectedActivityInfo = document.getElementById('selected-activity-info');
const activityModeBadge = document.getElementById('activity-mode-badge');
const activityDetailText = document.getElementById('activity-detail-text');
const hubWelcome = document.getElementById('hub-welcome');

let allActivities = [];
let selectedActivity = null;
let studentProfile = loadStudentProfile();
let classStudents = [];
let selectedFreeLevel = null;

const FREE_MODE_LEVELS = [
  { id: 1, name: 'Foret des Debuts', description: 'Apprends les bases !' },
  { id: 2, name: 'Plaines Venteuses', description: 'Les ennemis patrouillent plus vite !' },
  { id: 3, name: 'Cavernes Obscures', description: 'Les tireurs apparaissent... Reste vigilant !' }
];

const FREE_MODE_ACTIVITY = { id: '__free_mode__', mode: 'free', name: 'Monde Ouvert', topic: 'Jeu libre', subject: 'Sans matiere' };

const SHOP_ITEMS = [
  { id: 'immunity_potion', label: 'Potion immunisation', icon: '🛡', price: 18, desc: 'Ignore les ennemis et projectiles pendant 12 secondes.' },
  { id: 'coin_doubler', label: 'Aimant double pieces', icon: '🪙', price: 22, desc: 'Multiplie les pieces collectees par 2 pendant 45 secondes.' },
  { id: 'quiz_slow', label: 'Sablier de reflexion', icon: '⏳', price: 20, desc: 'Ralentit le chrono des questions pendant 45 secondes.' },
  { id: 'heart_kit', label: 'Coeur de secours', icon: '❤', price: 16, desc: 'Restaure 2 vies, sans depasser 5 vies.' },
  { id: 'ammo_pack', label: 'Pack projectiles', icon: '✦', price: 12, desc: 'Ajoute 20 projectiles immediatement.' },
  { id: 'time_orb', label: 'Orbe de temps', icon: '⏱', price: 18, desc: 'Ajoute 60 secondes au chronometre du niveau.' },
  { id: 'enemy_freeze', label: 'Cristal de gel', icon: '❄', price: 24, desc: 'Fige les ennemis et projectiles pendant 8 secondes.' },
  { id: 'jump_boots', label: 'Bottes aeriennes', icon: '↟', price: 20, desc: 'Autorise un triple saut pendant 40 secondes.' },
  { id: 'coin_magnet', label: 'Magnetiseur de pieces', icon: '◎', price: 14, desc: 'Ramasse les pieces proches pendant 35 secondes.' },
  { id: 'answer_shield', label: 'Bouclier erreur', icon: '?', price: 26, desc: 'Absorbe la prochaine penalite de mauvaise reponse.' }
];

const DEFAULT_STUDENT_SETTINGS = {
  sound: true,
  volume: 70,
  hints: true,
  reducedMotion: false
};

const TIMED_ITEM_EFFECTS = {
  immunity_potion: { key: 'immunityUntil', durationMs: 12000 },
  coin_doubler: { key: 'coinMultiplierUntil', durationMs: 45000 },
  quiz_slow: { key: 'quizSlowUntil', durationMs: 45000 },
  enemy_freeze: { key: 'enemyFreezeUntil', durationMs: 8000 },
  jump_boots: { key: 'jumpBootsUntil', durationMs: 40000 },
  coin_magnet: { key: 'coinMagnetUntil', durationMs: 35000 }
};

function normalizeCode(raw) {
  return (raw || '').trim().toUpperCase().replace(/\s+/g, '');
}

function economyId() {
  const name = (studentProfile?.name || 'guest').trim().toLowerCase();
  const code = normalizeCode(studentProfile?.code || 'local');
  return `${code}:${name}`;
}

function loadEconomy() {
  try {
    const all = JSON.parse(localStorage.getItem(ECONOMY_KEY) || '{}');
    return all[economyId()] || { wallet: 0, inventory: {}, syncedRunCoins: 0 };
  } catch {
    return { wallet: 0, inventory: {}, syncedRunCoins: 0 };
  }
}

function saveEconomy(economy) {
  const all = JSON.parse(localStorage.getItem(ECONOMY_KEY) || '{}');
  all[economyId()] = economy;
  localStorage.setItem(ECONOMY_KEY, JSON.stringify(all));
}

function addWalletCoins(amount) {
  if (!amount) return;
  if (window.__freeMode) {
    window.__freeModeCoins = (window.__freeModeCoins || 0) + amount;
    return;
  }
  const economy = loadEconomy();
  economy.wallet = Math.max(0, (economy.wallet || 0) + amount);
  saveEconomy(economy);
  renderShopAndInventory();
}
window.addStudentWalletCoins = addWalletCoins;

function syncRunCoinsToWallet() {
  // Les pieces sont ajoutees au portefeuille au moment exact du ramassage.
  // Cette fonction reste pour rafraichir les anciens appels sans double-compter.
}

function resetRunCoinSync() {
  const economy = loadEconomy();
  economy.syncedRunCoins = 0;
  saveEconomy(economy);
}

function loadStudentSettings() {
  try {
    return { ...DEFAULT_STUDENT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_STUDENT_SETTINGS };
  }
}

function saveStudentSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function getStudentEffects() {
  if (!window.studentItemEffects) {
    window.studentItemEffects = {
      coinMultiplierUntil: 0,
      quizSlowUntil: 0,
      enemyFreezeUntil: 0,
      jumpBootsUntil: 0,
      coinMagnetUntil: 0,
      answerShield: 0
    };
  }
  return window.studentItemEffects;
}

function getStudentEffectMeta() {
  if (!window.studentItemEffectMeta) window.studentItemEffectMeta = {};
  return window.studentItemEffectMeta;
}

function activateTimedItem(itemId) {
  const config = TIMED_ITEM_EFFECTS[itemId];
  if (!config) return;
  const effects = getStudentEffects();
  const meta = getStudentEffectMeta();
  const now = Date.now();
  const start = Math.max(now, effects[config.key] || 0);
  const end = start + config.durationMs;
  effects[config.key] = end;
  meta[config.key] = { start, end, durationMs: config.durationMs };
}

function effectActive(key) {
  const effects = getStudentEffects();
  return Date.now() < (effects[key] || 0);
}

function getEffectProgress(key) {
  const meta = getStudentEffectMeta()[key];
  const end = getStudentEffects()[key] || 0;
  if (!meta || !end || Date.now() >= end) return 0;
  const duration = Math.max(1, meta.durationMs || (meta.end - meta.start) || 1);
  return Math.max(0, Math.min(1, (end - Date.now()) / duration));
}

function formatEffectTime(key) {
  const remaining = Math.ceil(((getStudentEffects()[key] || 0) - Date.now()) / 1000);
  return remaining > 0 ? `${remaining}s` : '';
}

function showFloatingNotice(text) {
  window.floatingAmmoTexts = window.floatingAmmoTexts || [];
  window.floatingAmmoTexts.push({
    x: (player.x || 120) + 20,
    y: (player.y || 320) - 24,
    t: 1.4,
    text
  });
}

function itemById(id) {
  return SHOP_ITEMS.find(item => item.id === id);
}

function renderShopAndInventory() {
  syncRunCoinsToWallet();
  const economy = loadEconomy();
  const wallet = economy.wallet || 0;
  const shopWallet = document.getElementById('shop-wallet');
  const inventoryWallet = document.getElementById('inventory-wallet');
  if (shopWallet) shopWallet.textContent = wallet;
  if (inventoryWallet) inventoryWallet.textContent = wallet;

  const shopGrid = document.getElementById('shop-grid');
  if (shopGrid) {
    shopGrid.innerHTML = SHOP_ITEMS.map(item => {
      const canBuy = wallet >= item.price;
      return `
        <article class="shop-card">
          <div class="item-icon">${item.icon}</div>
          <div class="item-copy">
            <h3>${escapeHtml(item.label)}</h3>
            <p>${escapeHtml(item.desc)}</p>
            <span class="item-price">${item.price} pieces</span>
          </div>
          <button type="button" class="btn-primary item-action" data-buy-item="${item.id}" ${canBuy ? '' : 'disabled'}>Acheter</button>
        </article>
      `;
    }).join('');

    shopGrid.querySelectorAll('[data-buy-item]').forEach(btn => {
      btn.addEventListener('click', () => buyShopItem(btn.dataset.buyItem));
    });
  }

  const inventoryGrid = document.getElementById('inventory-grid');
  if (inventoryGrid) {
    const owned = SHOP_ITEMS.filter(item => (economy.inventory?.[item.id] || 0) > 0);
    inventoryGrid.innerHTML = owned.length ? owned.map(item => {
      const count = economy.inventory[item.id] || 0;
      return `
        <article class="inventory-card">
          <div class="item-icon">${item.icon}</div>
          <div class="item-copy">
            <h3>${escapeHtml(item.label)}</h3>
            <p>${escapeHtml(item.desc)}</p>
            <span class="item-count">x${count}</span>
          </div>
          <button type="button" class="btn-secondary item-action" data-use-item="${item.id}">Utiliser</button>
        </article>
      `;
    }).join('') : '<div class="inventory-empty">Aucun objet pour le moment. Passe par la boutique pour te preparer.</div>';

    inventoryGrid.querySelectorAll('[data-use-item]').forEach(btn => {
      btn.addEventListener('click', () => useInventoryItem(btn.dataset.useItem));
    });
  }

  renderActiveEffects();
}

function renderActiveEffects() {
  const inventoryGrid = document.getElementById('inventory-grid');
  if (!inventoryGrid) return;
  const effects = getStudentEffects();
  const badges = [
    effectActive('coinMultiplierUntil') && `Pieces x2 ${formatEffectTime('coinMultiplierUntil')}`,
    effectActive('quizSlowUntil') && `Questions ralenties ${formatEffectTime('quizSlowUntil')}`,
    effectActive('enemyFreezeUntil') && `Ennemis figes ${formatEffectTime('enemyFreezeUntil')}`,
    effectActive('jumpBootsUntil') && `Triple saut ${formatEffectTime('jumpBootsUntil')}`,
    effectActive('coinMagnetUntil') && `Aimant ${formatEffectTime('coinMagnetUntil')}`,
    effects.answerShield > 0 && `Bouclier erreur x${effects.answerShield}`
  ].filter(Boolean);
  let bar = document.getElementById('active-effects-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'active-effects-bar';
    bar.className = 'active-effects-bar';
    inventoryGrid.before(bar);
  }
  bar.innerHTML = badges.length ? badges.map(b => `<span>${escapeHtml(b)}</span>`).join('') : '';
}

function getStudentHudItems() {
  const economy = loadEconomy();
  const inventory = economy.inventory || {};
  const effects = getStudentEffects();
  return SHOP_ITEMS.map(item => {
    const timed = TIMED_ITEM_EFFECTS[item.id];
    const progress = timed ? getEffectProgress(timed.key) : 0;
    const activeCount = item.id === 'answer_shield' ? (effects.answerShield || 0) : 0;
    const count = (inventory[item.id] || 0) + activeCount;
    return {
      id: item.id,
      icon: item.icon,
      label: item.label,
      count,
      progress,
      active: progress > 0 || activeCount > 0
    };
  });
}

window.getStudentHudItems = getStudentHudItems;

/**
 * Renders owned/active inventory items as clickable buttons arranged in an arc
 * around the joystick circle (#joy). Only visible during gameplay.
 * Called every second and after every buy/use action.
 */
function renderHudItemsRing() {
  const ring = document.getElementById('hud-items-ring');
  if (!ring) return;

  if (window.gameState !== 'playing') {
    ring.innerHTML = '';
    return;
  }

  const items = getStudentHudItems();
  ring.innerHTML = '';

  const isBig = window.innerWidth >= 900;
  const slots = isBig ? 10 : 8;
  const R = isBig ? 88 : 58;        // radius (slightly inside the ring border)
  const cx = isBig ? 90 : 60;       // center x
  const cy = isBig ? 90 : 60;       // center y

  for (let i = 0; i < slots; i++) {
    const item = items[i] || null;
    // Start from top (-90°) so first item is at the top
    const angleDeg = -90 + (i / slots) * 360;
    const angleRad = (angleDeg * Math.PI) / 180;

    const bx = cx + R * Math.cos(angleRad);
    const by = cy + R * Math.sin(angleRad);

    const btn = document.createElement('button');
    btn.type = 'button';

    const hasItem = item && item.count > 0;
    const isActive = item && item.active;

    btn.className = 'hud-item-btn'
      + (isActive ? ' active-effect' : '')
      + (!hasItem ? ' disabled' : '');
    btn.setAttribute('data-label', item ? (item.label || '') : '');
    btn.style.left = `${bx}px`;
    btn.style.top = `${by}px`;

    // Icon
    const iconSpan = document.createElement('span');
    iconSpan.textContent = item ? (item.icon || '?') : '?';
    iconSpan.style.pointerEvents = 'none';
    btn.appendChild(iconSpan);

    // Count badge — always visible, shows x0 when empty
    const badge = document.createElement('span');
    badge.className = 'hud-badge';
    badge.textContent = item ? (item.count > 9 ? '9+' : String(item.count)) : '0';
    btn.appendChild(badge);

    // SVG arc for timed progress
    if (item && item.progress > 0) {
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      const btnR = 20;
      const circumference = 2 * Math.PI * btnR;
      svg.setAttribute('viewBox', '0 0 48 48');
      svg.style.cssText = 'position:absolute;inset:-2px;width:40px;height:40px;transform:rotate(-90deg);pointer-events:none;';

      const trackCircle = document.createElementNS(svgNS, 'circle');
      trackCircle.setAttribute('cx', '24');
      trackCircle.setAttribute('cy', '24');
      trackCircle.setAttribute('r', String(btnR));
      trackCircle.setAttribute('fill', 'none');
      trackCircle.setAttribute('stroke', 'rgba(255,255,255,0.08)');
      trackCircle.setAttribute('stroke-width', '3');
      svg.appendChild(trackCircle);

      const arcCircle = document.createElementNS(svgNS, 'circle');
      arcCircle.setAttribute('cx', '24');
      arcCircle.setAttribute('cy', '24');
      arcCircle.setAttribute('r', String(btnR));
      arcCircle.setAttribute('fill', 'none');
      const color = item.progress > 0.5 ? '#55cfb3' : item.progress > 0.25 ? '#f5c04a' : '#e74c3c';
      arcCircle.setAttribute('stroke', color);
      arcCircle.setAttribute('stroke-width', '3');
      arcCircle.setAttribute('stroke-linecap', 'round');
      arcCircle.setAttribute('stroke-dasharray', String(circumference));
      arcCircle.setAttribute('stroke-dashoffset', String(circumference * (1 - item.progress)));
      svg.appendChild(arcCircle);

      btn.appendChild(svg);
    }

    // Click — only if item exists and count > 0
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!item || item.count <= 0) return;
      useInventoryItem(item.id);
      renderHudItemsRing();
    });

    ring.appendChild(btn);
  }
}

window.renderHudItemsRing = renderHudItemsRing;

function buyShopItem(itemId) {
  const item = itemById(itemId);
  if (!item) return;
  const economy = loadEconomy();
  if ((economy.wallet || 0) < item.price) return;
  economy.wallet -= item.price;
  economy.inventory = economy.inventory || {};
  economy.inventory[item.id] = (economy.inventory[item.id] || 0) + 1;
  saveEconomy(economy);
  renderShopAndInventory();
  renderHudItemsRing();
}

function consumeInventoryItem(itemId) {
  const economy = loadEconomy();
  const count = economy.inventory?.[itemId] || 0;
  if (count <= 0) return false;
  economy.inventory[itemId] = count - 1;
  if (economy.inventory[itemId] <= 0) delete economy.inventory[itemId];
  saveEconomy(economy);
  return true;
}

function useInventoryItem(itemId) {
  const item = itemById(itemId);
  if (!item || !consumeInventoryItem(itemId)) return;
  const effects = getStudentEffects();

  if (itemId === 'immunity_potion') {
    activateTimedItem(itemId);
    player.invulnerable = Math.max(player.invulnerable || 0, 12);
    showFloatingNotice('Immunise 12s');
  } else if (itemId === 'coin_doubler') {
    activateTimedItem(itemId);
    showFloatingNotice('Pieces x2');
  } else if (itemId === 'quiz_slow') {
    activateTimedItem(itemId);
    showFloatingNotice('Questions ralenties');
  } else if (itemId === 'heart_kit') {
    player.lives = Math.min(5, (player.lives || 0) + 2);
    showFloatingNotice('+2 vies');
  } else if (itemId === 'ammo_pack') {
    player.ammo = (player.ammo || 0) + 20;
    showFloatingNotice('+20 projectiles');
  } else if (itemId === 'time_orb') {
    window.levelTimer = (typeof window.levelTimer === 'number' ? window.levelTimer : 600) + 60;
    showFloatingNotice('+60s');
  } else if (itemId === 'enemy_freeze') {
    activateTimedItem(itemId);
    showFloatingNotice('Ennemis figes');
  } else if (itemId === 'jump_boots') {
    activateTimedItem(itemId);
    showFloatingNotice('Triple saut');
  } else if (itemId === 'coin_magnet') {
    activateTimedItem(itemId);
    showFloatingNotice('Aimant active');
  } else if (itemId === 'answer_shield') {
    effects.answerShield = (effects.answerShield || 0) + 1;
    showFloatingNotice('Erreur protegee');
  }

  renderShopAndInventory();
  renderHudItemsRing();
}

window.consumeAnswerShield = function consumeAnswerShield() {
  const effects = getStudentEffects();
  if ((effects.answerShield || 0) <= 0) return false;
  effects.answerShield -= 1;
  showFloatingNotice('Bouclier erreur');
  renderShopAndInventory();
  renderHudItemsRing();
  return true;
};

window.getStudentItemEffects = getStudentEffects;

function setupStudentTabs() {
  document.querySelectorAll('.student-tab').forEach(tab => {
    tab.addEventListener('click', () => showStudentTab(tab.dataset.studentTab));
  });
  document.getElementById('quick-inventory')?.addEventListener('click', () => showStudentTab('inventory'));
}

function showStudentTab(tabName) {
  document.querySelectorAll('.student-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.studentTab === tabName);
  });
  document.querySelectorAll('.student-panel').forEach(panel => {
    panel.classList.toggle('hidden', panel.id !== `student-panel-${tabName}`);
  });
  if (tabName === 'shop' || tabName === 'inventory') renderShopAndInventory();
  if (tabName === 'leaderboard') renderStudentLeaderboard();
  if (tabName === 'settings') loadStudentSettingsForm();
}

async function fetchClassStudents() {
  if (!studentProfile?.class_id) return;
  try {
    const res = await fetch(`${API}/classes/${studentProfile.class_id}/students`);
    if (res.ok) classStudents = await res.json();
  } catch (err) {
    console.warn('Classement indisponible:', err);
  }
}

function renderStudentLeaderboard() {
  const target = document.getElementById('student-leaderboard');
  if (!target) return;
  fetchClassStudents().then(() => {
    const sorted = [...classStudents].sort((a, b) => (b.xp || 0) - (a.xp || 0));
    target.innerHTML = sorted.length ? sorted.map((student, idx) => {
      const active = student.name?.toLowerCase() === studentProfile?.name?.toLowerCase();
      return `
        <div class="leaderboard-row${active ? ' active' : ''}">
          <strong>#${idx + 1}</strong>
          <span>${escapeHtml(student.name || 'Eleve')}</span>
          <span>Niv. ${student.game_level || 1}</span>
          <b>${student.xp || 0} XP</b>
        </div>
      `;
    }).join('') : '<div class="inventory-empty">Aucun classement disponible.</div>';
  });
}

function loadStudentSettingsForm() {
  const settings = loadStudentSettings();
  const sound = document.getElementById('student-set-sound');
  const volume = document.getElementById('student-set-volume');
  const hints = document.getElementById('student-set-hints');
  const motion = document.getElementById('student-set-motion');
  if (sound) sound.checked = !!settings.sound;
  if (volume) volume.value = settings.volume;
  if (hints) hints.checked = !!settings.hints;
  if (motion) motion.checked = !!settings.reducedMotion;
  applyStudentSettings(settings);
}

function applyStudentSettings(settings) {
  document.body.classList.toggle('student-reduced-motion', !!settings.reducedMotion);
  document.body.classList.toggle('student-hide-hints', !settings.hints);
  window.studentSoundEnabled = !!settings.sound;
  window.studentMasterVolume = Math.max(0, Math.min(100, Number(settings.volume || 0))) / 100;
}

function setupStudentSettings() {
  const form = document.getElementById('student-settings-form');
  if (!form) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const settings = {
      sound: !!document.getElementById('student-set-sound')?.checked,
      volume: parseInt(document.getElementById('student-set-volume')?.value || '70', 10),
      hints: !!document.getElementById('student-set-hints')?.checked,
      reducedMotion: !!document.getElementById('student-set-motion')?.checked
    };
    saveStudentSettings(settings);
    applyStudentSettings(settings);
    const feedback = document.getElementById('student-settings-feedback');
    if (feedback) feedback.textContent = 'Parametres enregistres.';
  });
  loadStudentSettingsForm();
}

// ── Personnages ───────────────────────────────────────────────────────────────
const characters = [
  { id: 'Durhant', src: 'mon_sp_clean.png' },
  { id: 'Etoundi', src: 'etoundi_clean.png' },
  { id: 'Maylis', src: 'maylis_clean.png' }
];
const storedCharacter = (localStorage.getItem('selectedCharacter') || 'durhant').replace('duthant', 'durhant');
let currentCharIndex = characters.findIndex(c =>
  c.id.toLowerCase() === storedCharacter
);
if (currentCharIndex === -1) currentCharIndex = 0;

const menuPlayerSprite = document.getElementById('menu-player-sprite');
const characterNameEl = document.getElementById('character-name');

function updateCharacterDisplay() {
  const char = characters[currentCharIndex];
  if (menuPlayerSprite) menuPlayerSprite.style.backgroundImage = `url('${char.src}')`;
  if (characterNameEl) characterNameEl.textContent = char.id;
  localStorage.setItem('selectedCharacter', char.id.toLowerCase());
  if (assets.player) assets.player.src = char.src;
}

document.getElementById('prev-char')?.addEventListener('click', () => {
  currentCharIndex = (currentCharIndex - 1 + characters.length) % characters.length;
  updateCharacterDisplay();
});
document.getElementById('next-char')?.addEventListener('click', () => {
  currentCharIndex = (currentCharIndex + 1) % characters.length;
  updateCharacterDisplay();
});
updateCharacterDisplay();

// ── Profil persistant ─────────────────────────────────────────────────────────
function loadStudentProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p?.code) p.code = normalizeCode(p.code);
    return p;
  } catch { return null; }
}

function saveStudentProfile(name, code, classId) {
  const normalized = normalizeCode(code);
  studentProfile = { name: name.trim(), code: normalized, class_id: classId };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(studentProfile));
}

function clearStudentProfile() {
  studentProfile = null;
  localStorage.removeItem(STORAGE_KEY);
  allActivities = [];
  selectedActivity = null;
}

function showRoleScreen() {
  roleScreen?.classList.remove('hidden');
  loginScreen?.classList.add('hidden');
  hubScreen?.classList.add('hidden');
  hideLoginError();
  if (menuPlay) menuPlay.disabled = true;
}

function showLoginScreen() {
  roleScreen?.classList.add('hidden');
  loginScreen?.classList.remove('hidden');
  hubScreen?.classList.add('hidden');
  hideLoginError();
  if (menuPlay) menuPlay.disabled = true;
}

function showHubScreen() {
  roleScreen?.classList.add('hidden');
  loginScreen?.classList.add('hidden');
  hubScreen?.classList.remove('hidden');
  if (hubWelcome && studentProfile) {
    hubWelcome.textContent = `Bienvenue, ${studentProfile.name}`;
  }
  document.getElementById('profile-class-code').textContent = studentProfile?.code || '-';
  const nameInput = document.getElementById('student-name');
  const codeInput = document.getElementById('class-code');
  if (nameInput) nameInput.value = studentProfile?.name || '';
  if (codeInput) codeInput.value = studentProfile?.code || '';
  renderActivities();
}

function showLoginError(msg) {
  if (!loginError) return;
  loginError.textContent = msg;
  loginError.classList.remove('hidden');
}

function hideLoginError() {
  loginError?.classList.add('hidden');
}

async function joinClass(name, code) {
  const res = await fetch(`${API}/students/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim(), code: normalizeCode(code) })
  });

  let data;
  try { data = await res.json(); } catch { data = {}; }

  if (!res.ok) {
    if (res.status === 404) throw new Error('Code de classe introuvable. Verifie le code affiche par ton enseignant.');
    if (res.status >= 500) throw new Error('Le serveur ne repond pas. Demande a ton enseignant de lancer le backend.');
    throw new Error(data.error || 'Connexion impossible.');
  }
  if (data.error) throw new Error(data.error);
  return data;
}

async function fetchActivities() {
  if (!studentProfile?.code) return;
  try {
    const joinData = await joinClass(studentProfile.name, studentProfile.code);
    studentProfile.class_id = joinData.class_id;
    studentProfile.id = joinData.id;
    saveStudentProfile(studentProfile.name, studentProfile.code, joinData.class_id);

    const wRes = await fetch(`${API}/classes/${joinData.class_id}/worlds?student_id=${joinData.id}`);
    if (!wRes.ok) throw new Error('Impossible de charger les activites.');
    allActivities = await wRes.json();
    await fetchClassStudents();
    renderActivities();
    renderShopAndInventory();
  } catch (err) {
    if (err.message.includes('introuvable') || err.message.includes('serveur')) {
      showLoginScreen();
      return;
    }
    if (!allActivities.length) {
      renderActivities();
    }
  }
}

function renderActivities() {
  if (!activitiesList) return;

  activitiesHint.textContent = 'Selectionne une activite :';

  const teacherCards = allActivities.map(a => {
    const isEval = a.mode === 'eval';
    const badgeClass = isEval ? 'act-badge-eval' : 'act-badge-lesson';
    const badgeLabel = isEval ? 'EVALUATION' : 'LECON';
    const selected = selectedActivity?.id === a.id ? ' selected' : '';
    
    let attemptsText = '';
    if (isEval) {
      const maxAttempts = a.max_attempts || 3;
      const doneAttempts = a.student_attempts || 0;
      const isExhausted = doneAttempts >= maxAttempts;
      attemptsText = `
        <div class="attempts-info" style="font-size:12px; margin-top:6px; font-weight:bold; color:${isExhausted ? '#ff5f8f' : '#b29cff'};">
          Tentatives : ${doneAttempts} / ${maxAttempts}
        </div>
      `;
    }
    
    return `
      <button type="button" class="activity-card${selected}" data-id="${a.id}">
        <h3>${escapeHtml(a.name)}</h3>
        <p>${escapeHtml(a.topic)} — ${escapeHtml(a.subject)}</p>
        <span class="act-badge ${badgeClass}">${badgeLabel}</span>
        ${attemptsText}
      </button>
    `;
  }).join('');

  const freeSelected = selectedActivity?.id === '__free_mode__' ? ' selected' : '';
  const freeCard = `
    <button type="button" class="activity-card${freeSelected}" data-id="__free_mode__">
      <h3>🏝️ Monde Ouvert</h3>
      <p>Joue librement sans questions ni lecons</p>
      <span class="act-badge" style="background:#8b5cf6;color:#fff;">MODE LIBRE</span>
    </button>
  `;

  activitiesList.innerHTML = freeCard + teacherCards;

  activitiesList.querySelectorAll('.activity-card').forEach(card => {
    card.addEventListener('click', () => selectActivity(card.dataset.id));
  });
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function setCharacterEnabled(on) {
  if (!characterSection) return;
  characterSection.classList.toggle('disabled', !on);
  if (characterHint) {
    characterHint.textContent = on ? 'Choisis ton heros' : 'Selectionne d\'abord une activite';
  }
}

function selectActivity(id) {
  const isFreeMode = id === '__free_mode__';
  selectedFreeLevel = null;

  if (isFreeMode) {
    selectedActivity = FREE_MODE_ACTIVITY;
  } else {
    selectedActivity = allActivities.find(a => a.id === parseInt(id, 10)) || null;
  }

  window.__freeMode = isFreeMode;
  renderActivities();

  if (!selectedActivity) {
    selectedActivityInfo?.classList.add('hidden');
    document.getElementById('free-mode-selector')?.classList.add('hidden');
    setCharacterEnabled(false);
    updatePlayButton();
    return;
  }

  setCharacterEnabled(true);
  window.gameMode = selectedActivity.mode;

  if (isFreeMode) {
    selectedActivityInfo?.classList.add('hidden');
    document.getElementById('free-mode-selector')?.classList.remove('hidden');
    renderFreeLevels();
    updatePlayButton();
    return;
  }

  selectedActivityInfo?.classList.remove('hidden');
  document.getElementById('free-mode-selector')?.classList.add('hidden');

  const isEval = selectedActivity.mode === 'eval';
  activityModeBadge.textContent = isEval ? 'EVALUATION' : 'LECON';
  activityModeBadge.style.background = isEval ? '#dc2626' : '#1d4ed8';
  
  let detailText = `${selectedActivity.topic} (${selectedActivity.subject}) — mode fixe par l'enseignant`;
  if (isEval) {
    const maxAttempts = selectedActivity.max_attempts || 3;
    const doneAttempts = selectedActivity.student_attempts || 0;
    detailText += ` · ${maxAttempts} tentatives autorisées (faites : ${doneAttempts}/${maxAttempts})`;
  }
  activityDetailText.textContent = detailText;
  
  updatePlayButton();
}

function renderFreeLevels() {
  const container = document.getElementById('free-levels');
  if (!container) return;
  container.querySelectorAll('.free-level-btn').forEach(btn => {
    btn.classList.toggle('selected', parseInt(btn.dataset.level, 10) === selectedFreeLevel);
  });
}

function selectFreeLevel(level) {
  selectedFreeLevel = level;
  renderFreeLevels();
  updatePlayButton();
}

function updatePlayButton() {
  if (!selectedActivity) {
    if (menuPlay) menuPlay.disabled = true;
    menuPlay.textContent = 'Jouer';
    return;
  }
  
  if (selectedActivity.id === '__free_mode__') {
    if (menuPlay) {
      menuPlay.disabled = !selectedFreeLevel;
      menuPlay.textContent = selectedFreeLevel ? `Jouer (Niveau ${selectedFreeLevel})` : 'Choisis un niveau';
    }
    return;
  }
  
  const isEval = selectedActivity.mode === 'eval';
  if (isEval) {
    const maxAttempts = selectedActivity.max_attempts || 3;
    const doneAttempts = selectedActivity.student_attempts || 0;
    if (doneAttempts >= maxAttempts) {
      if (menuPlay) {
        menuPlay.disabled = true;
        menuPlay.textContent = 'Tentatives épuisées';
      }
      return;
    }
  }
  
  if (menuPlay) {
    menuPlay.disabled = false;
    menuPlay.textContent = window._prevStateBeforePause === 'playing' ? 'Nouvelle partie' : 'Jouer';
  }
}

async function verifyClass(e) {
  if (e) e.preventDefault();
  hideLoginError();

  const name = document.getElementById('student-name')?.value.trim();
  const code = normalizeCode(document.getElementById('class-code')?.value);
  if (!name || !code) {
    showLoginError('Entre ton prenom et le code de classe.');
    return;
  }

  const btn = document.getElementById('btn-verify-class');
  if (btn) { btn.disabled = true; btn.textContent = 'Connexion...'; }

  try {
    const data = await joinClass(name, code);
    saveStudentProfile(name, code, data.class_id);
    showHubScreen();
    await fetchActivities();
  } catch (err) {
    const msg = err.message || 'Erreur de connexion.';
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      showLoginError('Impossible de joindre le serveur. Verifie que le backend tourne sur le port 5001.');
    } else {
      showLoginError(msg);
    }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Se connecter'; }
  }
}

document.getElementById('btn-verify-class')?.addEventListener('click', verifyClass);
document.getElementById('class-code')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') verifyClass(e);
});
document.getElementById('student-name')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('class-code')?.focus();
});
document.getElementById('btn-role-student')?.addEventListener('click', () => {
  if (studentProfile?.name && studentProfile?.code) {
    showHubScreen();
    renderActivities();
    fetchActivities();
  } else {
    showLoginScreen();
    setCharacterEnabled(false);
  }
});

setupStudentTabs();
setupStudentSettings();
renderShopAndInventory();
setInterval(() => {
  syncRunCoinsToWallet();
  renderActiveEffects();
  renderHudItemsRing();
}, 1000);

document.getElementById('btn-change-profile')?.addEventListener('click', () => {
  if (confirm('Changer de compte ? Tu devras ressaisir ton nom et ton code.')) {
    clearStudentProfile();
    showRoleScreen();
    setCharacterEnabled(false);
    if (activitiesList) activitiesList.innerHTML = '';
    if (activitiesHint) activitiesHint.textContent = 'Selectionne une activite configuree par ton enseignant.';
  }
});

document.getElementById('free-levels')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.free-level-btn');
  if (btn) selectFreeLevel(parseInt(btn.dataset.level, 10));
});

showRoleScreen();
setCharacterEnabled(false);

// ── Jeu ───────────────────────────────────────────────────────────────────────
async function startGame() {
  if (!selectedActivity) return alert('Choisis une activite d\'abord.');

  const isFreeMode = selectedActivity.id === '__free_mode__';

  if (isFreeMode) {
    if (!selectedFreeLevel) return alert('Choisis un niveau pour le mode libre.');
    window.gameMode = 'free';
    window.currentWorldId = null;
    setLevel(selectedFreeLevel);
    makeLevel();
    player.lives = 5;
    player.ammo = 999;
    player.coins = 0;
    player.aiQueries = 0;
    window.levelTimer = 9999;
    window._prevStateBeforePause = null;
    window.__freeModeCoins = 0;
    window.__freeModeScore = 0;
    window.__freeMode = true;
    restartMusic();
    window.gameState = 'playing';
    import('./game/engine.js').then(mod => { if (mod?.respawn) mod.respawn(); });
    updateMenuVisibility();
    renderHudItemsRing();
    return;
  }

  const studentName = studentProfile?.name || 'Eleve';
  const classCode = studentProfile?.code || '';

  window.gameMode = selectedActivity.mode;
  window.currentWorldId = selectedActivity.id;
  window.__freeMode = false;

  try {
    const studentData = await joinClass(studentName, classCode);
    const sessionRes = await fetch(`${API}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: studentData.id,
        class_id: studentData.class_id,
        world_id: selectedActivity.id,
        game_level: selectedActivity.world_index,
        mode: selectedActivity.mode
      })
    });

    if (sessionRes.ok) {
      const sessionData = await sessionRes.json();
      setSession({
        session_id: sessionData.session_id,
        student_id: studentData.id,
        class_id: studentData.class_id,
        world_id: selectedActivity.id,
        name: studentName
      });
      // Synchronisation en temps réel du nombre de tentatives
      await fetchActivities();
      if (selectedActivity) {
        selectedActivity = allActivities.find(a => a.id === selectedActivity.id);
      }
    }
  } catch (err) {
    console.warn('Session non enregistree:', err);
  }

  const loaded = await loadQuestions(selectedActivity.id);
  if (!loaded) {
    return alert('Cette activite n\'a pas encore de questions. Demande a ton enseignant d\'en ajouter.');
  }

  setLevel(selectedActivity.world_index || 1);
  makeLevel();
  resetRunCoinSync();
  player.lives = 5;
  player.ammo = 30;
  player.coins = 0;
  player.aiQueries = 1;
  window.levelTimer = 600;
  window._prevStateBeforePause = null;
  restartMusic();
  window.gameState = 'playing';
  import('./game/engine.js').then(mod => { if (mod?.respawn) mod.respawn(); });
  updateMenuVisibility();
  renderHudItemsRing();
}

function updateMenuVisibility() {
  const xpDisplay = document.getElementById('menu-xp-display');
  const chatbotToggle = document.getElementById('chatbotToggle');
  const chatbotPanel = document.getElementById('chatbotPanel');
  const bookToggle = document.getElementById('bookHistoryToggle');
  const bookPanel = document.getElementById('bookHistoryPanel');
  const livreOverlay = document.getElementById('livreOverlay');

  const quizActive = typeof window.isQuizActive === 'function' ? window.isQuizActive() : false;
  const gameplayVisible = window.gameState === 'playing' && !window.isLivreActive;
  const isGameOver = window.gameState === 'gameover';
  const inGameLoop = gameplayVisible;

  document.body.classList.toggle('in-gameplay', inGameLoop);

  if (gameplayVisible || isGameOver) {
    if (document.activeElement && !quizActive) document.activeElement.blur();
    menuOverlay.classList.add('hidden');
    pauseBtn.classList.add('hidden'); // pause button hidden on gameover/quiz
    
    if (isGameOver) {
      document.getElementById('gameover-overlay')?.classList.remove('hidden');
    } else {
      document.getElementById('gameover-overlay')?.classList.add('hidden');
      pauseBtn.classList.toggle('hidden', quizActive);
    }

    if (chatbotToggle) {
      chatbotToggle.style.display = inGameLoop ? '' : 'none';
      if (inGameLoop && (!chatbotPanel || chatbotPanel.classList.contains('hidden'))) {
        chatbotToggle.classList.remove('hidden');
      }
    }
    if (bookToggle) bookToggle.style.display = inGameLoop ? '' : 'none';
  } else {
    if (studentProfile) startMusic();
    menuOverlay.classList.remove('hidden');
    document.getElementById('gameover-overlay')?.classList.add('hidden');
    pauseBtn.classList.add('hidden');
    menuOverlay.setAttribute('aria-hidden', 'false');
    if (chatbotToggle) chatbotToggle.style.display = 'none';
    if (chatbotPanel) chatbotPanel.classList.add('hidden');
    if (bookToggle) bookToggle.style.display = 'none';
    if (bookPanel) bookPanel.classList.add('hidden');
    if (livreOverlay && window.gameState !== 'playing') {
      livreOverlay.classList.add('hidden');
      window.isLivreActive = false;
    }

    if (window._prevStateBeforePause === 'playing' && window.gameState === 'menu') {
      menuResume?.classList.remove('hidden');
      if (menuPlay) menuPlay.textContent = 'Nouvelle partie';
      roleScreen?.classList.add('hidden');
      hubScreen?.classList.remove('hidden');
      loginScreen?.classList.add('hidden');
      if (xpDisplay) {
        xpDisplay.classList.remove('hidden');
        const stats = getStudentStats();
        document.getElementById('pause-student-name').textContent = stats.name || studentProfile?.name || '-';
        document.getElementById('pause-student-xp').textContent = stats.xp;
      }
    } else {
      menuResume?.classList.add('hidden');
      if (menuPlay) menuPlay.textContent = 'Jouer';
      if (roleScreen && !roleScreen.classList.contains('hidden')) {
        showRoleScreen();
      } else if (studentProfile) {
        showHubScreen();
      } else {
        showRoleScreen();
      }
      if (xpDisplay) xpDisplay.classList.add('hidden');
    }
  }
}
window.updateMenuVisibility = updateMenuVisibility;
updateMenuVisibility();
renderHudItemsRing();

menuResume?.addEventListener('click', () => {
  if (window._prevStateBeforePause === 'playing') {
    window.gameState = 'playing';
    window._prevStateBeforePause = null;
    updateMenuVisibility();
    renderHudItemsRing();
  }
});

menuPlay?.addEventListener('click', () => startGame());

menuQuit?.addEventListener('click', () => {
  window.gameState = 'menu';
  window._prevStateBeforePause = null;
  window.__freeMode = false;
  updateMenuVisibility();
  renderHudItemsRing();
});

pauseBtn.addEventListener('click', () => {
  if (window.gameState === 'playing') {
    window._prevStateBeforePause = 'playing';
    window.gameState = 'menu';
  } else {
    window.gameState = 'playing';
  }
  updateMenuVisibility();
  renderHudItemsRing();
});

canvas.addEventListener('click', () => {
  if (window.gameState === 'playing') return;
  if (window.gameState === 'menu') {
    if (window._prevStateBeforePause === 'playing') {
      window.gameState = 'playing';
      window._prevStateBeforePause = null;
    } else if (selectedActivity) {
      startGame();
      return;
    }
  } else if (window.gameState === 'gameover') {
    const modal = document.getElementById('session-summary-modal');
    if (modal && !modal.classList.contains('hidden')) {
      return; // Bloquer le redémarrage pendant le bilan
    }
    startGame();
  }
  updateMenuVisibility();
  renderHudItemsRing();
});

// ── Fonctionnalité du Bilan de Session ──
function showSessionSummary() {
  const modal = document.getElementById('session-summary-modal');
  if (!modal) return;

  const progress = getQuizProgress();
  const isEval = selectedActivity?.mode === 'eval';

  const title = document.getElementById('summary-title');
  if (title && selectedActivity) {
    title.textContent = `Bilan : ${selectedActivity.name}`;
  }

  const badge = document.getElementById('summary-mode-badge');
  if (badge) {
    badge.textContent = isEval ? 'ÉVALUATION' : 'LEÇON';
    badge.className = `badge ${isEval ? 'eval' : 'lesson'}`;
  }

  const xpVal = document.getElementById('summary-xp-val');
  if (xpVal) {
    xpVal.textContent = `+${progress.xp} XP`;
  }

  const gradeCard = document.getElementById('summary-grade-card');
  if (gradeCard) {
    gradeCard.style.display = isEval ? '' : 'none';
  }

  const gradeVal = document.getElementById('summary-grade-val');
  if (gradeVal && progress.total > 0) {
    const rate = Math.round((progress.correct / progress.total) * 100);
    const grade = ((progress.correct / progress.total) * 20).toFixed(1);
    gradeVal.textContent = `${rate}% (${grade}/20)`;
  } else if (gradeVal) {
    gradeVal.textContent = '0% (0/20)';
  }

  const attemptsVal = document.getElementById('summary-attempts-val');
  if (attemptsVal && selectedActivity) {
    const doneAttempts = selectedActivity.student_attempts || 0;
    const maxAttempts = selectedActivity.max_attempts || 3;
    attemptsVal.textContent = isEval ? `${doneAttempts} / ${maxAttempts}` : `${doneAttempts} (Non limité)`;
  }

  const invList = document.getElementById('summary-inventory-list');
  if (invList) {
    const hudItems = getStudentHudItems();
    const economy = loadEconomy();
    const coins = economy.wallet || 0;
    let invHtml = `<div class="summary-inv-item">🪙 ${coins} pièces</div>`;
    if (hudItems && hudItems.length > 0) {
      invHtml += hudItems.map(item => `
        <div class="summary-inv-item">
          <span>${item.icon}</span>
          <span>${item.label} (x${item.count})</span>
        </div>
      `).join('');
    } else {
      invHtml += `<div class="summary-inv-empty">Aucun objet dans le sac</div>`;
    }
    invList.innerHTML = invHtml;
  }

  const missedList = document.getElementById('summary-missed-list');
  if (missedList) {
    const failedQs = window.failedQuestionsThisRun || [];
    if (failedQs.length === 0) {
      missedList.innerHTML = `
        <div class="summary-no-missed">
          🌟 Sans-faute ! Félicitations, tu as répondu correctement à toutes les questions !
        </div>
      `;
    } else {
      missedList.innerHTML = failedQs.map(q => {
        const explanation = q.explanation ? `<div class="summary-missed-exp">💡 Règle pédagogique : ${escapeHtml(q.explanation)}</div>` : '';
        return `
          <div class="summary-missed-item">
            <div class="summary-missed-q">Question : ${escapeHtml(q.question)}</div>
            <div class="summary-missed-ans">Ta réponse : ${escapeHtml(Array.isArray(q.given_answer) ? q.given_answer.join(', ') : q.given_answer || 'Aucune')}</div>
            <div class="summary-missed-correct">Réponse correcte : ${escapeHtml(Array.isArray(q.correct_answer) ? q.correct_answer.join(', ') : q.correct_answer)}</div>
            ${explanation}
          </div>
        `;
      }).join('');
    }
  }

  modal.classList.remove('hidden');
}

const btnSummaryClose = document.getElementById('btn-summary-close');
btnSummaryClose?.addEventListener('click', async () => {
  const modal = document.getElementById('session-summary-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
  window.gameState = 'menu';
  window._prevStateBeforePause = null;
  
  await fetchActivities();
  if (selectedActivity) {
    selectActivity(selectedActivity.id);
  }
  
  updateMenuVisibility();
  renderHudItemsRing();
});

// ── Game Over → Bilan ──
const btnGameOverSummary = document.getElementById('btn-gameover-summary');
btnGameOverSummary?.addEventListener('click', async () => {
  document.getElementById('gameover-overlay')?.classList.add('hidden');
  if (studentProfile?.code) {
    try { await fetchActivities(); } catch (_) {}
    if (selectedActivity) {
      selectedActivity = allActivities.find(a => a.id === selectedActivity.id);
    }
  }
  showSessionSummary();
});
