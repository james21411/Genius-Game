import { initAssets, assetsReady, assets } from './game/assets.js';
import { initControls } from './game/controls.js';
import { world, player, makeLevel, setLevel } from './game/level.js';
import { startEngine } from './game/engine.js';
import { initRender } from './game/render.js';
import { initQuizInput, loadQuestions, setSession, getStudentStats, isQuizActive } from './game/quiz_engine.js';
import { initChatbot } from './game/chatbot.js';
import { initLivreDialog } from './game/livre_dialog.js';

const API = 'http://localhost:5001/api';
const STORAGE_KEY = 'geniusjump_student';

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

function normalizeCode(raw) {
  return (raw || '').trim().toUpperCase().replace(/\s+/g, '');
}

// ── Personnages ───────────────────────────────────────────────────────────────
const characters = [
  { id: 'Duthant', src: 'mon_sp_clean.png' },
  { id: 'Etoundi', src: 'etoundi_clean.png' },
  { id: 'Maylis', src: 'maylis_clean.png' }
];
let currentCharIndex = characters.findIndex(c =>
  c.id.toLowerCase() === (localStorage.getItem('selectedCharacter') || 'duthant')
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
    renderActivities();
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
  player.lives = 3;
  player.ammo = 30;
  player.coins = 0;
  player.aiQueries = 1;
  window.levelTimer = 600;
  window._prevStateBeforePause = null;
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
