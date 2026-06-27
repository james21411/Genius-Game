import { initAssets, assetsReady, assets } from './game/assets.js';
import { initControls } from './game/controls.js';
import { world, player, makeLevel, setLevel } from './game/level.js';
import { startEngine } from './game/engine.js';
import { initRender } from './game/render.js';
import { initQuizInput, loadQuestions, setSession, getStudentStats, isQuizActive } from './game/quiz_engine.js';
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
initChatbot();
initLivreDialog();

window.gameState = 'menu';
window.currentLevel = 1;

setLevel(1);
makeLevel();
startEngine(canvas, world, player);

// ── DOM ───────────────────────────────────────────────────────────────────────
const menuOverlay = document.getElementById('menuOverlay');
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

function effectActive(key) {
  const effects = getStudentEffects();
  return Date.now() < (effects[key] || 0);
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
  bar.innerHTML = badges.length ? badges.map(b => `<span>${escapeHtml(b)}</span>`).join('') : '<span>Aucun effet actif</span>';
}

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
  const now = Date.now();

  if (itemId === 'immunity_potion') {
    player.invulnerable = Math.max(player.invulnerable || 0, 12);
    showFloatingNotice('Immunise 12s');
  } else if (itemId === 'coin_doubler') {
    effects.coinMultiplierUntil = Math.max(effects.coinMultiplierUntil || 0, now) + 45000;
    showFloatingNotice('Pieces x2');
  } else if (itemId === 'quiz_slow') {
    effects.quizSlowUntil = Math.max(effects.quizSlowUntil || 0, now) + 45000;
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
    effects.enemyFreezeUntil = Math.max(effects.enemyFreezeUntil || 0, now) + 8000;
    showFloatingNotice('Ennemis figes');
  } else if (itemId === 'jump_boots') {
    effects.jumpBootsUntil = Math.max(effects.jumpBootsUntil || 0, now) + 40000;
    showFloatingNotice('Triple saut');
  } else if (itemId === 'coin_magnet') {
    effects.coinMagnetUntil = Math.max(effects.coinMagnetUntil || 0, now) + 35000;
    showFloatingNotice('Aimant active');
  } else if (itemId === 'answer_shield') {
    effects.answerShield = (effects.answerShield || 0) + 1;
    showFloatingNotice('Erreur protegee');
  }

  renderShopAndInventory();
}

window.consumeAnswerShield = function consumeAnswerShield() {
  const effects = getStudentEffects();
  if ((effects.answerShield || 0) <= 0) return false;
  effects.answerShield -= 1;
  showFloatingNotice('Bouclier erreur');
  renderShopAndInventory();
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

function showLoginScreen() {
  loginScreen?.classList.remove('hidden');
  hubScreen?.classList.add('hidden');
  hideLoginError();
  if (menuPlay) menuPlay.disabled = true;
}

function showHubScreen() {
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
    saveStudentProfile(studentProfile.name, studentProfile.code, joinData.class_id);

    const wRes = await fetch(`${API}/classes/${joinData.class_id}/worlds`);
    if (!wRes.ok) throw new Error('Impossible de charger les activites.');
    allActivities = await wRes.json();
    await fetchClassStudents();
    renderActivities();
    renderShopAndInventory();
  } catch (err) {
    if (activitiesHint) {
      activitiesHint.textContent = err.message.includes('serveur')
        ? err.message
        : 'Session expiree ou code invalide. Reconnecte-toi.';
    }
    if (activitiesList) activitiesList.innerHTML = '';
    if (err.message.includes('introuvable') || err.message.includes('serveur')) {
      showLoginScreen();
    }
  }
}

function renderActivities() {
  if (!activitiesList) return;

  if (allActivities.length === 0) {
    activitiesHint.textContent = 'Aucune activite configuree par ton enseignant pour l\'instant.';
    activitiesList.innerHTML = '';
    selectedActivity = null;
    setCharacterEnabled(false);
    updatePlayButton();
    return;
  }

  activitiesHint.textContent = 'Selectionne une activite :';
  activitiesList.innerHTML = allActivities.map(a => {
    const isEval = a.mode === 'eval';
    const badgeClass = isEval ? 'act-badge-eval' : 'act-badge-lesson';
    const badgeLabel = isEval ? 'EVALUATION' : 'LECON';
    const selected = selectedActivity?.id === a.id ? ' selected' : '';
    return `
      <button type="button" class="activity-card${selected}" data-id="${a.id}">
        <h3>${escapeHtml(a.name)}</h3>
        <p>${escapeHtml(a.topic)} — ${escapeHtml(a.subject)}</p>
        <span class="act-badge ${badgeClass}">${badgeLabel}</span>
      </button>
    `;
  }).join('');

  activitiesList.querySelectorAll('.activity-card').forEach(card => {
    card.addEventListener('click', () => selectActivity(parseInt(card.dataset.id, 10)));
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
  selectedActivity = allActivities.find(a => a.id === id) || null;
  renderActivities();

  if (!selectedActivity) {
    selectedActivityInfo?.classList.add('hidden');
    setCharacterEnabled(false);
    updatePlayButton();
    return;
  }

  setCharacterEnabled(true);
  selectedActivityInfo?.classList.remove('hidden');

  const isEval = selectedActivity.mode === 'eval';
  window.gameMode = selectedActivity.mode;
  activityModeBadge.textContent = isEval ? 'EVALUATION' : 'LECON';
  activityModeBadge.style.background = isEval ? '#dc2626' : '#1d4ed8';
  activityDetailText.textContent = `${selectedActivity.topic} (${selectedActivity.subject}) — mode fixe par l'enseignant`;
  updatePlayButton();
}

function updatePlayButton() {
  if (menuPlay) menuPlay.disabled = !selectedActivity;
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

setupStudentTabs();
setupStudentSettings();
renderShopAndInventory();
setInterval(() => {
  syncRunCoinsToWallet();
  renderActiveEffects();
}, 1000);

document.getElementById('btn-change-profile')?.addEventListener('click', () => {
  if (confirm('Changer de compte ? Tu devras ressaisir ton nom et ton code.')) {
    clearStudentProfile();
    showLoginScreen();
    setCharacterEnabled(false);
    if (activitiesList) activitiesList.innerHTML = '';
    if (activitiesHint) activitiesHint.textContent = 'Selectionne une activite configuree par ton enseignant.';
  }
});

if (studentProfile?.name && studentProfile?.code) {
  showHubScreen();
  fetchActivities();
} else {
  showLoginScreen();
  setCharacterEnabled(false);
}

// ── Jeu ───────────────────────────────────────────────────────────────────────
async function startGame() {
  if (!selectedActivity) return alert('Choisis une activite d\'abord.');

  const studentName = studentProfile?.name || 'Eleve';
  const classCode = studentProfile?.code || '';

  window.gameMode = selectedActivity.mode;
  window.currentWorldId = selectedActivity.id;

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
  player.lives = 3;
  player.ammo = 30;
  player.coins = 0;
  player.aiQueries = 1;
  window.levelTimer = 600;
  window._prevStateBeforePause = null;
  restartMusic();
  window.gameState = 'playing';
  import('./game/engine.js').then(mod => { if (mod?.respawn) mod.respawn(); });
  updateMenuVisibility();
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
  const inGameLoop = gameplayVisible;

  document.body.classList.toggle('in-gameplay', inGameLoop);

  if (gameplayVisible) {
    if (document.activeElement && !quizActive) document.activeElement.blur();
    menuOverlay.classList.add('hidden');
    pauseBtn.classList.toggle('hidden', quizActive);
    menuOverlay.setAttribute('aria-hidden', 'true');
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
    pauseBtn.classList.add('hidden');
    menuOverlay.setAttribute('aria-hidden', 'false');
    if (chatbotToggle) chatbotToggle.style.display = 'none';
    if (chatbotPanel) chatbotPanel.classList.add('hidden');
    if (bookToggle) bookToggle.style.display = 'none';
    if (bookPanel) bookPanel.classList.add('hidden');
    if (livreOverlay) {
      livreOverlay.classList.add('hidden');
      window.isLivreActive = false;
    }

    if (window._prevStateBeforePause === 'playing' && window.gameState === 'menu') {
      menuResume?.classList.remove('hidden');
      if (menuPlay) menuPlay.textContent = 'Nouvelle partie';
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
      if (studentProfile) showHubScreen();
      else showLoginScreen();
      if (xpDisplay) xpDisplay.classList.add('hidden');
    }
  }
}
window.updateMenuVisibility = updateMenuVisibility;
updateMenuVisibility();

menuResume?.addEventListener('click', () => {
  if (window._prevStateBeforePause === 'playing') {
    window.gameState = 'playing';
    window._prevStateBeforePause = null;
    updateMenuVisibility();
  }
});

menuPlay?.addEventListener('click', () => startGame());

menuQuit?.addEventListener('click', () => {
  window.gameState = 'menu';
  window._prevStateBeforePause = null;
  updateMenuVisibility();
});

pauseBtn.addEventListener('click', () => {
  if (window.gameState === 'playing') {
    window._prevStateBeforePause = 'playing';
    window.gameState = 'menu';
  } else {
    window.gameState = 'playing';
  }
  updateMenuVisibility();
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
    startGame();
  }
  updateMenuVisibility();
});
