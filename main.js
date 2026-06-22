import { initAssets, assetsReady, assets } from './game/assets.js';
import { initControls, input, isMobile } from './game/controls.js';
import { world, player, makeLevel, setLevel } from './game/level.js';
import { startEngine } from './game/engine.js';
import { initRender } from './game/render.js';
import { TOTAL_LEVELS, getLevelConfig } from './game/difficulty.js';
import { initQuizInput, loadQuestions, setSession, getStudentStats } from './game/quiz_engine.js';
import { initChatbot } from './game/chatbot.js';
import { initLivreDialog } from './game/livre_dialog.js';

const canvas = document.getElementById('game');

initAssets();
initControls();
initRender(canvas, world, player, assets, assetsReady);
initQuizInput();
initChatbot();
initLivreDialog();

// start in menu; engine loop runs only when playing
window.gameState = 'menu'; // 'menu' | 'playing' | 'gameover'

// Track current level (1-indexed). Exposed globally so other modules can read it.
window.currentLevel = 1;

setLevel(1);
makeLevel();
loadQuestions(1); // Load default questions
startEngine(canvas, world, player);

// DOM menu and pause wiring
const menuOverlay  = document.getElementById('menuOverlay');
const menuResume   = document.getElementById('menu-resume');
const menuPlay     = document.getElementById('menu-play');
const menuOptions  = document.getElementById('menu-options');
const menuQuit     = document.getElementById('menu-quit');
const pauseBtn     = document.getElementById('pauseBtn');
const levelDisplay = document.getElementById('level-display');
const prevLvlBtn   = document.getElementById('prev-level');
const nextLvlBtn   = document.getElementById('next-level');

let availableWorlds = [];
let selectedWorldIndex = 0;

/** Refresh the level label and arrow states in the menu */
function updateLevelDisplay() {
  if (availableWorlds.length === 0) {
    levelDisplay.textContent = "Aucune quête trouvée";
    prevLvlBtn.disabled = true;
    nextLvlBtn.disabled = true;
    return;
  }
  const w = availableWorlds[selectedWorldIndex];
  levelDisplay.textContent = `${w.name}`;
  document.getElementById('world-details').textContent = `Sujet: ${w.topic} (${w.subject})`;
  prevLvlBtn.disabled = selectedWorldIndex <= 0;
  nextLvlBtn.disabled = selectedWorldIndex >= availableWorlds.length - 1;
}

async function verifyClass() {
  const code = document.getElementById('class-code').value.trim();
  if (!code) return alert("Entrez un code !");
  
  try {
    // On cherche d'abord la classe pour avoir son ID
    const res = await fetch(`http://localhost:5001/api/students/join`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ name: 'Check', code })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    
    // On récupère les mondes de cette classe
    const wRes = await fetch(`http://localhost:5001/api/classes/${data.class_id}/worlds`);
    availableWorlds = await wRes.json();
    selectedWorldIndex = 0;
    updateLevelDisplay();
  } catch (err) {
    alert("Code de classe invalide ou introuvable.");
  }
}

document.getElementById('btn-verify-class').onclick = verifyClass;
updateLevelDisplay();

/** Start or restart the game at the selected level */
async function startGame() {
  const nameInput = document.getElementById('student-name');
  const codeInput = document.getElementById('class-code');
  const studentName = nameInput ? nameInput.value.trim() : 'Élève Demo';
  const classCode = codeInput ? codeInput.value.trim() : 'DEMO-2026';

  try {
    // 1. Rejoindre la classe
    const joinRes = await fetch('http://localhost:5001/api/students/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: studentName || 'Élève Anonyme', code: classCode || 'DEMO-2026' })
    });
    
    if(joinRes.ok) {
      const studentData = await joinRes.json();
      
      // 2. Démarrer une session
      const sessionRes = await fetch('http://localhost:5001/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          student_id: studentData.id, 
          class_id: studentData.class_id,
          game_level: window.currentLevel
        })
      });

      if(sessionRes.ok) {
        const sessionData = await sessionRes.json();
        // 3. Lier la session au moteur de quiz
        setSession({
          session_id: sessionData.session_id,
          student_id: studentData.id,
          class_id: studentData.class_id,
          name: studentName || 'Élève Anonyme'
        });
        console.log("✅ Session éducative démarrée");
      }
    }
  } catch(err) {
    console.warn("⚠️ Mode hors-ligne: le backend n'est pas accessible.", err);
  }

  const activeWorld = availableWorlds[selectedWorldIndex];
  window.currentWorldId = activeWorld ? activeWorld.id : null;

  if (window.currentWorldId) {
    await loadQuestions(window.currentWorldId);
  }

  setLevel(activeWorld ? activeWorld.world_index : 1);
  makeLevel();
  player.lives = 3;
  player.ammo  = 30;
  player.coins = 0;
  player.aiQueries = 1;
  window.levelTimer = 600; // 10 minutes par défaut
  window._prevStateBeforePause = null;
  window.gameState = 'playing';
  import('./game/engine.js').then(mod => { if (mod && typeof mod.respawn === 'function') mod.respawn(); });
  updateMenuVisibility();
}

// Level selector arrows
if (prevLvlBtn) prevLvlBtn.addEventListener('click', () => {
  if (selectedWorldIndex > 0) { selectedWorldIndex--; updateLevelDisplay(); }
});
if (nextLvlBtn) nextLvlBtn.addEventListener('click', () => {
  if (selectedWorldIndex < availableWorlds.length - 1) { selectedWorldIndex++; updateLevelDisplay(); }
});

// Character selector logic
const characters = [
  { id: 'duthant', src: 'mon_sp_clean.png' },
  { id: 'etoundi', src: 'etoundi_clean.png' },
  { id: 'maylis', src: 'maylis_clean.png' }
];
let currentCharIndex = characters.findIndex(c => c.id === (localStorage.getItem('selectedCharacter') || 'duthant'));
if (currentCharIndex === -1) currentCharIndex = 0;

const menuPlayerSprite = document.getElementById('menu-player-sprite');
const characterNameEl = document.getElementById('character-name');
const prevCharBtn = document.getElementById('prev-char');
const nextCharBtn = document.getElementById('next-char');

function updateCharacterDisplay() {
  const char = characters[currentCharIndex];
  if (menuPlayerSprite) {
    menuPlayerSprite.style.backgroundImage = `url('${char.src}')`;
  }
  if (characterNameEl) {
    characterNameEl.textContent = char.id;
  }
  localStorage.setItem('selectedCharacter', char.id);
  // Also update the active game asset dynamically so if they press Play, the correct character loads without refreshing
  if (assets.player) {
    assets.player.src = char.src;
  }
}

if (prevCharBtn) prevCharBtn.addEventListener('click', () => {
  currentCharIndex = (currentCharIndex - 1 + characters.length) % characters.length;
  updateCharacterDisplay();
});
if (nextCharBtn) nextCharBtn.addEventListener('click', () => {
  currentCharIndex = (currentCharIndex + 1) % characters.length;
  updateCharacterDisplay();
});

// Initialize display
updateCharacterDisplay();

function updateMenuVisibility(){
  const studentLogin = document.querySelector('.student-login');
  const xpDisplay = document.getElementById('menu-xp-display');

  if(window.gameState === 'playing'){
    if (document.activeElement) document.activeElement.blur();
    menuOverlay.classList.add('hidden');
    pauseBtn.classList.remove('hidden');
    menuOverlay.setAttribute('aria-hidden','true');
  } else {
    menuOverlay.classList.remove('hidden');
    pauseBtn.classList.add('hidden');
    menuOverlay.setAttribute('aria-hidden','false');
    
    // Only show "Reprendre" if we are in the middle of a game (paused)
    if(window._prevStateBeforePause === 'playing' && window.gameState === 'menu'){
      menuResume.classList.remove('hidden');
      menuPlay.textContent = 'Nouvelle Partie';
      if(studentLogin) studentLogin.classList.add('hidden');
      if(xpDisplay) {
        xpDisplay.classList.remove('hidden');
        const stats = getStudentStats();
        document.getElementById('pause-student-name').textContent = stats.name || 'Élève Anonyme';
        document.getElementById('pause-student-xp').textContent = stats.xp;
      }
    } else {
      menuResume.classList.add('hidden');
      menuPlay.textContent = 'Jouer';
      if(studentLogin) studentLogin.classList.remove('hidden');
      if(xpDisplay) xpDisplay.classList.add('hidden');
    }
  }
}
updateMenuVisibility();

// Dummy buttons
document.querySelectorAll('.dummy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    alert("⚠️ " + btn.dataset.feature + " sera bientôt disponible dans une prochaine mise à jour !");
  });
});

// Resume button: continue where we left off
menuResume.addEventListener('click', () => {
  if(window._prevStateBeforePause === 'playing'){
    window.gameState = 'playing';
    window._prevStateBeforePause = null;
    updateMenuVisibility();
  }
});

// Play button: starts a new game at the selected level
menuPlay.addEventListener('click', () => {
  // Récupérer le mode de jeu choisi
  const selectedMode = document.querySelector('input[name="gameMode"]:checked');
  window.gameMode = selectedMode ? selectedMode.value : 'lesson';
  console.log('[Menu] Mode sélectionné :', window.gameMode);
  
  startGame();
});

// Options button: simple modal-like toggle (keeps UI minimal)
menuOptions.addEventListener('click', ()=>{
  alert('Options placeholder — sound/music toggles and difficulty could go here.');
});

// Quit button: returns to menu state (simulate app quit by resetting)
menuQuit.addEventListener('click', ()=>{
  // reset to menu state
  window.gameState = 'menu';
  window._prevStateBeforePause = null;
  updateMenuVisibility();
});

// pause button toggles pause (switch between 'playing' and 'menu' as pause)
pauseBtn.addEventListener('click', ()=>{
  if(window.gameState === 'playing'){
    window._prevStateBeforePause = 'playing';
    window.gameState = 'menu';
  } else {
    window.gameState = 'playing';
  }
  updateMenuVisibility();
});

// allow clicking canvas when in menu to start as well
canvas.addEventListener('click', (e)=>{
  if(window.gameState === 'playing'){
    return;
  }
  
  if(window.gameState === 'menu'){
    // if menu was opened via pause, simply resume without respawn
    if(window._prevStateBeforePause === 'playing'){
      window.gameState = 'playing';
      window._prevStateBeforePause = null;
    } else {
      // initial menu start: respawn player into the level
      window.gameState = 'playing';
      import('./game/engine.js').then(mod => { mod.respawn(); });
    }
  } else if(window.gameState === 'gameover'){
    // restart at same level
    startGame();
  }
  updateMenuVisibility();
});

// ensure menu visibility reflects initial state
updateMenuVisibility();