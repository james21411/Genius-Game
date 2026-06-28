/*
  Module: game/quiz_engine.js
  Gère la logique des questions éducatives intégrées au gameplay.
  - Overlay canvas (pas de DOM supplémentaire)
  - Répond aux clics / touches clavier
  - Communique avec le backend Flask (ou fallback local)
*/

import { player } from './level.js';
import { playLose } from './sound.js';

const API = 'http://localhost:5001/api';

// ── État interne ──────────────────────────────────────────────────────────────
let _active = false;       // quiz en cours ?
let _state = 'idle';      // idle|entering|active|correct|wrong|explaining|exiting
let _question = null;        // objet question courant
let _platform = null;        // plateforme qui a déclenché le quiz
let _timer = 0;           // temps restant (secondes)
let _startMs = 0;           // Date.now() au début de la question
let _anim = 0;           // progression animation entrée/sortie (0→1)
let _attempt = 1;           // 1er ou 2ème essai
let _chosen = null;        // réponse choisie ('A'|'B'|'C'|'D')
let _session = null;        // session active { id, student_id, class_id }
let _xpGained = 0;
let _questionsTotal = 0;
let _questionsCorrect = 0;
let _particles = [];         // confettis/particules de feedback
let _onComplete = null;      // callback appelé quand la question est terminée
let _lessonReading = false;

// Pool de questions chargées (depuis API ou fallback local)
let _questionPool = [];
let _poolIndex = 0;
let _overlayReady = false;

// ── Couleurs des boutons de réponse ──────────────────────────────────────────
const BTN_COLORS = {
  A: { bg: '#e74c3c', hover: '#ff6b6b' },
  B: { bg: '#2ecc71', hover: '#55e889' },
  C: { bg: '#3498db', hover: '#5dade2' },
  D: { bg: '#f39c12', hover: '#f5b942' },
};
const ANSWERS = ['A', 'B', 'C', 'D'];

function _studentEffectActive(key) {
  const effects = window.getStudentItemEffects?.() || window.studentItemEffects || {};
  return Date.now() < (effects[key] || 0);
}

// ── API publique ──────────────────────────────────────────────────────────────

export async function loadQuestions(worldId) {
  _questionPool = [];
  _poolIndex = 0;
  _questionsTotal = 0;
  _questionsCorrect = 0;
  _xpGained = 0;
  window.quizQuestionDifficulties = [];
  window.failedQuestionsThisRun = [];

  if (!worldId) {
    console.warn('[Quiz] Aucune activite selectionnee — pas de questions chargees.');
    return false;
  }

  try {
    const res = await fetch(`${API}/questions?world_id=${worldId}`);
    if (res.ok) {
      const apiQuestions = await res.json();
      if (apiQuestions.length === 0) {
        console.warn(`[Quiz] Activite ${worldId} : aucune question configuree.`);
        return false;
      }
      _questionPool = apiQuestions;
      _shufflePool();
      window.quizQuestionDifficulties = _questionPool.map(q => parseInt(q.difficulty) || 1);
      console.log(`[Quiz] ${_questionPool.length} questions pour activite ${worldId}`);
      return true;
    }
  } catch (err) {
    console.warn('[Quiz] Erreur API:', err);
  }

  console.warn('[Quiz] Impossible de charger les questions — pas de fallback pour une activite configuree.');
  return false;
}

/** Mélange aléatoire du pool de questions */
function _shufflePool() {
  for (let i = _questionPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [_questionPool[i], _questionPool[j]] = [_questionPool[j], _questionPool[i]];
  }
  _poolIndex = 0;
}

/** Définir la session active (élève connecté) */
export function setSession(sessionObj) {
  _session = sessionObj; // { session_id, student_id, class_id, name }
}

export function getStudentStats() {
  return { 
    xp: _xpGained, 
    total: _questionsTotal, 
    correct: _questionsCorrect,
    name: _session ? _session.name : null
  };
}

export function getQuizProgress() {
  const total = Math.max(0, _questionPool.length);
  const answered = total ? Math.min(_questionsTotal, total) : 0;
  return {
    answered,
    total,
    ratio: total ? answered / total : 0,
    mode: window.gameMode || 'lesson'
  };
}

/** Retourne true si un quiz est en cours */
export function isQuizActive() { return _active; }

/** Retourne le facteur de ralentissement du temps (pour engine.js) */
export function timeScale() {
  if (!_active) return 1.0;
  if (_state === 'entering') return Math.max(0.25, 1 - _anim * 0.75);
  if (_state === 'exiting') return Math.max(0.25, _anim * 0.75);
  return 0.25; // SlowMo : temps divisé par 4 selon le plan
}

/** Déclencher une question sur une plateforme */
export function triggerQuiz(platform, onComplete) {
  if (_active) return;
  if (!_questionPool.length) return;

  // Choisir la prochaine question dans le pool (cyclique)
  _question = _questionPool[_poolIndex % _questionPool.length];
  _poolIndex++;

  _platform = platform;
  if (platform) platform.difficulty = parseInt(_question.difficulty) || platform.difficulty || 1;
  _onComplete = onComplete || null;
  _active = true;
  _state = 'entering';
  _anim = 0;
  _timer = _question.time_limit || 15;
  _startMs = Date.now();
  _attempt = 1;
  _chosen = null;
  _lessonReading = !!_question.lesson_content;
  _particles = [];
  _syncOverlay();

  // Marquer la plateforme comme "en cours" pour éviter de re-déclencher
  if (platform) platform._quizTriggered = true;
}

/** Mise à jour chaque frame — appelée depuis engine.js */
export function updateQuiz(dt) {
  if (!_active) return;

  switch (_state) {
    case 'entering':
      _anim = Math.min(1, _anim + dt * 4);
      if (_anim >= 1) {
        _state = 'active';
        _anim = 0;
        _startMs = Date.now();
        _syncOverlay();
      }
      break;

    case 'active':
      if (_lessonReading) {
        break;
      }
      _timer -= dt * (_studentEffectActive('quizSlowUntil') ? 0.45 : 1);
      _syncOverlayTimer();
      if (_timer <= 0) _resolveAnswer(null);
      break;

    case 'correct':
    case 'wrong':
      _anim += dt;
      // Mettre à jour les particules
      for (const p of _particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 400 * dt;
        p.life -= dt;
      }
      _particles = _particles.filter(p => p.life > 0);
      if (_anim > 0.8) {
        if (_state === 'wrong' && _attempt < 2) {
          _attempt++;
          _state = 'active';
          _anim = 0;
          _timer = Math.max(8, (_question.time_limit || 15) * 0.6);
          _syncOverlay();
        } else {
          _state = 'explaining';
          _anim = 0;
          _syncOverlay();
        }
      }
      break;

    case 'explaining':
      _anim += dt;
      if (_anim > 2.5) _finishQuiz(); // affiche explication 2.5s
      break;

    case 'exiting':
      _anim = Math.min(1, _anim + dt * 4);
      if (_anim >= 1) {
        _active = false;
        _state = 'idle';
        _syncOverlay();
        if (_onComplete) _onComplete(_chosen === _normalizeChoice(_question.correct_answer));
      }
      break;
  }
}

/** Appelé par les boutons ou touches clavier */
export function submitAnswer(choice) {
  if (_state !== 'active') return;
  if (_lessonReading) {
    _lessonReading = false;
    _timer = _question.time_limit || 20;
    _startMs = Date.now();
    _syncOverlay();
    return;
  }
  _chosen = choice;
  document.querySelectorAll('#quizOverlay .quiz-answer-btn').forEach((btn) => {
    btn.disabled = true;
  });
  _resolveAnswer(choice);
}

/** Écoute clavier + boutons HTML overlay */
export function initQuizInput() {
  _initOverlayButtons();

  addEventListener('keydown', (e) => {
    if (!_active || _state !== 'active') return;
    const keyMap = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
    const choice = keyMap[e.key];
    if (choice) {
      submitAnswer(choice);
      e.preventDefault();
    }
  });
}

function _initOverlayButtons() {
  if (_overlayReady) return;
  const overlay = document.getElementById('quizOverlay');
  if (!overlay) return;
  overlay.querySelectorAll('.quiz-answer-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (_state === 'active') submitAnswer(btn.dataset.choice);
    });
  });
  _overlayReady = true;
}

function _getImageBackgroundHtml(imageName) {
  if (imageName === 'carte_france') {
    return `
      <svg viewBox="0 0 200 200" style="width: 100%; height: 100%; background: #2c3e50; border-radius: 8px;">
        <polygon points="100,20 140,40 160,80 150,130 110,180 70,170 40,120 50,70 80,30" fill="#34495e" stroke="#7f8c8d" stroke-width="2"/>
        <text x="100" y="100" fill="rgba(255,255,255,0.15)" font-size="12" text-anchor="middle" font-weight="bold">CARTE DE FRANCE</text>
      </svg>
    `;
  } else if (imageName === 'squelette') {
    return `
      <svg viewBox="0 0 200 200" style="width: 100%; height: 100%; background: #2c3e50; border-radius: 8px;">
        <circle cx="100" cy="40" r="15" fill="none" stroke="#fff" stroke-width="3"/>
        <line x1="100" y1="55" x2="100" y2="120" stroke="#fff" stroke-width="4"/>
        <line x1="100" y1="70" x2="70" y2="100" stroke="#fff" stroke-width="3"/>
        <line x1="100" y1="70" x2="130" y2="100" stroke="#fff" stroke-width="3"/>
        <line x1="100" y1="120" x2="80" y2="170" stroke="#fff" stroke-width="3"/>
        <line x1="100" y1="120" x2="120" y2="170" stroke="#fff" stroke-width="3"/>
        <text x="100" y="100" fill="rgba(255,255,255,0.15)" font-size="12" text-anchor="middle" font-weight="bold">SQUELETTE HUMAIN</text>
      </svg>
    `;
  } else if (imageName === 'systeme_solaire') {
    return `
      <svg viewBox="0 0 200 200" style="width: 100%; height: 100%; background: #2c3e50; border-radius: 8px;">
        <circle cx="100" cy="100" r="25" fill="#f1c40f"/>
        <circle cx="100" cy="100" r="50" fill="none" stroke="#7f8c8d" stroke-dasharray="2,2"/>
        <circle cx="100" cy="100" r="80" fill="none" stroke="#7f8c8d" stroke-dasharray="2,2"/>
        <circle cx="150" cy="100" r="6" fill="#e67e22"/>
        <circle cx="60" cy="40" r="8" fill="#3498db"/>
        <text x="100" y="145" fill="rgba(255,255,255,0.15)" font-size="12" text-anchor="middle" font-weight="bold">SYSTÈME SOLAIRE</text>
      </svg>
    `;
  } else {
    return `<img src="${imageName}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;" onerror="this.src='./Uo17V.jpg';"/>`;
  }
}

function _escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function _syncOverlay() {
  const overlay = document.getElementById('quizOverlay');
  const controls = document.getElementById('controls');
  const panel = overlay?.querySelector('.quiz-panel');
  if (!overlay || !_question) return;

  const interactive = _active && _state === 'active';
  const visible = _active && ['active', 'correct', 'wrong', 'explaining'].includes(_state);
  overlay.classList.toggle('hidden', !visible);
  overlay.setAttribute('aria-hidden', visible ? 'false' : 'true');
  panel?.classList.toggle('quiz-correct', _state === 'correct');
  panel?.classList.toggle('quiz-wrong', _state === 'wrong');
  panel?.classList.toggle('quiz-explaining', _state === 'explaining');
  controls?.classList.toggle('quiz-blocked', visible);
  window.updateMenuVisibility?.();

  if (!visible) return;

  const bloomLabel = {
    knowledge: 'Mémorisation', comprehension: 'Compréhension',
    application: 'Application', analysis: 'Analyse',
    evaluation: 'Évaluation', creation: 'Création'
  }[_question.bloom_level] || 'Question';

  document.getElementById('quizBloom').textContent = bloomLabel;
  document.getElementById('quizXp').textContent = `+${_question.xp_reward || 50} XP`;
  
  const qText = document.getElementById('quizQuestionText');
  const answersContainer = document.getElementById('quizAnswers');
  let feedback = document.getElementById('quizFeedback');
  if (!feedback && panel) {
    feedback = document.createElement('div');
    feedback.id = 'quizFeedback';
    feedback.className = 'quiz-feedback hidden';
    panel.appendChild(feedback);
  }

  if (_lessonReading) {
    document.getElementById('quizBloom').textContent = `Fragment ${_question.lesson_order || ''}`.trim();
    document.getElementById('quizXp').textContent = 'Lecture';
    const timerFill = document.getElementById('quizTimerFill');
    if (timerFill) timerFill.style.width = '100%';
    qText.textContent = _question.lesson_title || 'Fragment de leçon';
    answersContainer.className = 'quiz-answers lesson-fragment-reading';
    answersContainer.style.display = 'block';
    const imageHtml = _question.lesson_image_data
      ? (_question.lesson_image_data.startsWith('data:image')
        ? `<img src="${_question.lesson_image_data}" alt="" class="lesson-fragment-image">`
        : `<div class="lesson-fragment-image-prompt">${_escapeHtml(_question.lesson_image_data)}</div>`)
      : '';
    answersContainer.innerHTML = `
      <div class="lesson-fragment-content">
        ${imageHtml}
        <p>${_escapeHtml(_question.lesson_content || '')}</p>
        <button type="button" class="arcade-btn lesson-read-btn">J'ai lu</button>
      </div>
    `;
    answersContainer.querySelector('.lesson-read-btn')?.addEventListener('click', () => submitAnswer('__READ__'));
    feedback?.classList.add('hidden');
    return;
  }

  if (!interactive) {
    document.querySelectorAll('#quizOverlay button, #quizOverlay input, #quizOverlay select').forEach((el) => {
      el.disabled = true;
    });
    if (feedback) {
      feedback.classList.remove('hidden', 'quiz-feedback-correct', 'quiz-feedback-wrong', 'quiz-feedback-info');
      if (_state === 'correct') {
        feedback.classList.add('quiz-feedback-correct');
        feedback.innerHTML = `
          <div class="quiz-calm-burst" aria-hidden="true"><span></span><span></span><span></span></div>
          <strong>Bonne réponse</strong>
          <p>Respire un instant : ton savoir vient de s'allumer.</p>
        `;
      } else if (_state === 'wrong') {
        feedback.classList.add('quiz-feedback-wrong');
        feedback.innerHTML = `
          <strong>On reprend calmement</strong>
          <p>Observe l'indice, tu as encore une chance.</p>
        `;
      } else if (_state === 'explaining') {
        feedback.classList.add('quiz-feedback-info');
        feedback.innerHTML = `
          <strong>Explication</strong>
          <p>${_question.explanation || 'Garde cette idée en tête pour la prochaine question.'}</p>
        `;
      }
    }
    return;
  }

  feedback?.classList.add('hidden');

  const type = _question.type || 'qcm';

  let extra = {};
  if (_question.extra_data) {
    try { extra = JSON.parse(_question.extra_data); } catch(e) {}
  }
  
  if (type === 'qcm') {
    qText.textContent = _question.question;
    answersContainer.className = "quiz-answers qcm-layout";
    answersContainer.style.display = "grid";
    answersContainer.innerHTML = `
      <button type="button" class="quiz-answer-btn quiz-btn-a" data-choice="A"><span>A.</span> <span id="quizLabelA"></span></button>
      <button type="button" class="quiz-answer-btn quiz-btn-b" data-choice="B"><span>B.</span> <span id="quizLabelB"></span></button>
      <button type="button" class="quiz-answer-btn quiz-btn-c" data-choice="C"><span>C.</span> <span id="quizLabelC"></span></button>
      <button type="button" class="quiz-answer-btn quiz-btn-d" data-choice="D"><span>D.</span> <span id="quizLabelD"></span></button>
    `;
    
    document.getElementById('quizLabelA').textContent = _question.answer_a || '—';
    document.getElementById('quizLabelB').textContent = _question.answer_b || '—';
    document.getElementById('quizLabelC').textContent = _question.answer_c || '—';
    document.getElementById('quizLabelD').textContent = _question.answer_d || '—';

    answersContainer.querySelectorAll('.quiz-answer-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (_state === 'active') submitAnswer(btn.dataset.choice);
      });
    });
  }
  else if (type === 'tf') {
    qText.textContent = _question.question;
    answersContainer.className = "quiz-answers tf-layout";
    answersContainer.style.display = "grid";
    answersContainer.innerHTML = `
      <button type="button" class="quiz-answer-btn quiz-btn-b" data-choice="VRAI" style="font-size: 18px; text-align: center; justify-content: center; display: flex; align-items: center; gap: 8px;">✓ VRAI</button>
      <button type="button" class="quiz-answer-btn quiz-btn-a" data-choice="FAUX" style="font-size: 18px; text-align: center; justify-content: center; display: flex; align-items: center; gap: 8px;">✗ FAUX</button>
    `;

    answersContainer.querySelectorAll('.quiz-answer-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (_state === 'active') submitAnswer(btn.dataset.choice);
      });
    });
  }
  else if (type === 'short_answer') {
    qText.textContent = _question.question;
    answersContainer.className = "quiz-answers short-answer-layout";
    answersContainer.style.display = "block";
    answersContainer.innerHTML = `
      <div style="margin-bottom: 12px;">
        <input type="text" id="shortAnswerInput" placeholder="Écris ta réponse ici..." style="width: 100%; padding: 12px; font-size: 16px; border: 2px solid #555; background: #1a2238; color: #fff; border-radius: 8px; outline: none; text-align: center;">
      </div>
      <button type="button" id="shortAnswerValidateBtn" class="arcade-btn green-btn" style="width: 100%; display: block; font-family: 'Press Start 2P'; font-size: 10px; padding: 10px;" disabled>VALIDER LA RÉPONSE</button>
    `;
    
    const inputField = answersContainer.querySelector('#shortAnswerInput');
    const validateBtn = answersContainer.querySelector('#shortAnswerValidateBtn');
    
    setTimeout(() => inputField.focus(), 50);
    inputField.addEventListener('input', () => {
      validateBtn.disabled = !inputField.value.trim();
    });
    
    validateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (_state === 'active') submitAnswer(inputField.value.trim());
    });

    inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (inputField.value.trim() && _state === 'active') {
          submitAnswer(inputField.value.trim());
        }
      }
    });
  }
  else if (type === 'matching') {
    qText.textContent = _question.question || "Associe les correspondances :";
    
    const leftItems = extra.left_items || _question.left_items || [];
    const rightItems = extra.right_items || _question.right_items || [];

    answersContainer.className = "quiz-answers matching-layout";
    answersContainer.style.display = "block";
    
    let html = `<div style="display: flex; gap: 15px; justify-content: space-between; margin-bottom: 12px;">`;
    
    html += `<div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">`;
    leftItems.forEach(item => {
      html += `<button type="button" class="matching-btn left-btn" data-item="${item}" style="background: #2c3e50; border: 2px solid #555; color: #fff; padding: 8px; border-radius: 6px; font-family: 'VT323'; font-size: 18px; cursor: pointer; text-align: center; transition: all 0.2s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item}</button>`;
    });
    html += `</div>`;
    
    html += `<div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">`;
    rightItems.forEach(item => {
      html += `<button type="button" class="matching-btn right-btn" data-item="${item}" style="background: #2c3e50; border: 2px solid #555; color: #fff; padding: 8px; border-radius: 6px; font-family: 'VT323'; font-size: 18px; cursor: pointer; text-align: center; transition: all 0.2s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item}</button>`;
    });
    html += `</div>`;
    
    html += `</div>`;
    html += `<button type="button" id="matchingValidateBtn" class="arcade-btn green-btn" style="width: 100%; display: block; font-family: 'Press Start 2P'; font-size: 10px; padding: 10px;" disabled>VALIDER LES ASSOCIATIONS (0/${leftItems.length})</button>`;
    
    answersContainer.innerHTML = html;

    let selectedLeft = null;
    const currentMatches = {};
    const matchColors = ['#f1c40f', '#3498db', '#2ecc71', '#9b59b6', '#e67e22'];

    const leftButtons = answersContainer.querySelectorAll('.left-btn');
    const rightButtons = answersContainer.querySelectorAll('.right-btn');
    const validateBtn = answersContainer.querySelector('#matchingValidateBtn');

    leftButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        leftButtons.forEach(b => b.style.outline = 'none');
        selectedLeft = btn.dataset.item;
        btn.style.outline = '3px solid #f5c04a';
      });
    });

    rightButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!selectedLeft) return;
        
        const rightItem = btn.dataset.item;
        
        for (const key in currentMatches) {
          if (currentMatches[key] === rightItem) {
            delete currentMatches[key];
          }
        }
        currentMatches[selectedLeft] = rightItem;

        leftButtons.forEach(b => b.style.outline = 'none');
        selectedLeft = null;

        const matchedLefts = Object.keys(currentMatches);
        
        leftButtons.forEach(b => {
          b.style.background = '#2c3e50';
          b.style.borderColor = '#555';
          const matchIdx = matchedLefts.indexOf(b.dataset.item);
          if (matchIdx !== -1) {
            b.style.background = matchColors[matchIdx % matchColors.length];
            b.style.borderColor = '#000';
          }
        });

        rightButtons.forEach(b => {
          b.style.background = '#2c3e50';
          b.style.borderColor = '#555';
          const leftKey = matchedLefts.find(k => currentMatches[k] === b.dataset.item);
          if (leftKey) {
            const matchIdx = matchedLefts.indexOf(leftKey);
            b.style.background = matchColors[matchIdx % matchColors.length];
            b.style.borderColor = '#000';
          }
        });

        const count = Object.keys(currentMatches).length;
        validateBtn.disabled = count < leftItems.length;
        validateBtn.textContent = `VALIDER LES ASSOCIATIONS (${count}/${leftItems.length})`;
      });
    });

    validateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (_state === 'active') submitAnswer(currentMatches);
    });
  }
  else if (type === 'dragdrop' || type === 'dragdrop_text') {
    answersContainer.className = "quiz-answers dragdrop-layout";
    answersContainer.style.display = "block";
    
    const textPattern = _question.question || "";
    const choices = extra.choices || _question.choices || [];
    
    let formattedText = textPattern;
    const slotCount = (textPattern.match(/\{slot\d+\}/g) || []).length;
    
    for (let i = 0; i < slotCount; i++) {
      formattedText = formattedText.replace(`{slot${i}}`, `
        <span class="drag-slot" data-slot="${i}" style="display: inline-block; min-width: 80px; height: 26px; border-bottom: 3px solid #f5c04a; background: rgba(255,255,255,0.08); text-align: center; font-weight: bold; color: #ffd700; margin: 0 4px; cursor: pointer; padding: 0 4px; line-height: 26px; border-radius: 4px; vertical-align: middle;">___</span>
      `);
    }
    
    qText.innerHTML = `<div style="font-size: 18px; line-height: 1.5; color: #fff; margin-bottom: 12px;">${formattedText}</div>`;
    
    let html = `<div style="text-align: center; margin: 8px 0; font-size: 14px; color: #aaa;">Sélectionne un mot, puis clique sur l'emplacement (_) :</div>`;
    html += `<div class="drag-chips" style="display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; margin-bottom: 12px;">`;
    choices.forEach(word => {
      html += `<button type="button" class="drag-chip-btn" data-word="${word}" style="background: #34495e; border: 2px solid #000; box-shadow: 2px 2px 0 #000; color: #fff; padding: 5px 10px; border-radius: 4px; font-family: 'VT323'; font-size: 16px; cursor: pointer; transition: all 0.2s;">${word}</button>`;
    });
    html += `</div>`;
    html += `<button type="button" id="dragValidateBtn" class="arcade-btn green-btn" style="width: 100%; display: block; font-family: 'Press Start 2P'; font-size: 10px; padding: 10px;" disabled>VALIDER LES RÉPONSES</button>`;
    
    answersContainer.innerHTML = html;

    let selectedWord = null;
    const filledSlots = {};
    
    const chipBtns = answersContainer.querySelectorAll('.drag-chip-btn');
    const slotSpans = qText.querySelectorAll('.drag-slot');
    const validateBtn = answersContainer.querySelector('#dragValidateBtn');
 
    chipBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        chipBtns.forEach(b => b.style.outline = 'none');
        selectedWord = btn.dataset.word;
        btn.style.outline = '3px solid #f5c04a';
      });
    });

    slotSpans.forEach(span => {
      span.addEventListener('click', (e) => {
        e.preventDefault();
        const slotIdx = span.dataset.slot;
        
        if (filledSlots[slotIdx]) {
          const oldWord = filledSlots[slotIdx];
          delete filledSlots[slotIdx];
          span.textContent = "___";
          span.style.color = "#ffd700";
          
          const chip = Array.from(chipBtns).find(b => b.dataset.word === oldWord);
          if (chip) {
            chip.style.opacity = '1';
            chip.style.pointerEvents = 'auto';
          }
        } else if (selectedWord) {
          filledSlots[slotIdx] = selectedWord;
          span.textContent = selectedWord;
          span.style.color = "#2ecc71";
          
          const chip = Array.from(chipBtns).find(b => b.dataset.word === selectedWord);
          if (chip) {
            chip.style.opacity = '0.3';
            chip.style.pointerEvents = 'none';
          }
          
          chipBtns.forEach(b => b.style.outline = 'none');
          selectedWord = null;
        }

        const count = Object.keys(filledSlots).length;
        validateBtn.disabled = count < slotSpans.length;
      });
    });

    validateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (_state === 'active') {
        const answersArray = [];
        for (let i = 0; i < slotSpans.length; i++) {
          answersArray.push(filledSlots[i] || "");
        }
        submitAnswer(answersArray);
      }
    });
  }
  else if (type === 'dragdrop_image') {
    answersContainer.className = "quiz-answers dragdrop-image-layout";
    answersContainer.style.display = "block";
    
    const imageName = extra.image || "carte_france";
    const labels = extra.labels || [];
    const slots = extra.slots || [];
    
    let html = `<div style="display: flex; gap: 15px; align-items: flex-start; margin-bottom: 12px; height: 160px;">`;
    
    html += `
      <div id="ddiImageArea" style="position: relative; width: 200px; height: 150px; flex-shrink: 0; border: 2px solid #555; border-radius: 8px; overflow: hidden; background: #222;">
        ${_getImageBackgroundHtml(imageName)}
    `;
    
    slots.forEach((slot, idx) => {
      html += `
        <div class="ddi-slot" data-idx="${idx}" style="position: absolute; left: ${slot.x}%; top: ${slot.y}%; transform: translate(-50%, -50%); width: 70px; height: 22px; border: 2px dashed #f5c04a; background: rgba(0,0,0,0.7); color: #fff; text-align: center; font-size: 10px; font-weight: bold; border-radius: 4px; line-height: 18px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 2px;">
          ?
        </div>
      `;
    });
    
    html += `</div>`;
    
    html += `<div style="flex: 1; display: flex; flex-direction: column; gap: 6px; height: 150px; overflow-y: auto; padding: 6px; background: rgba(255,255,255,0.02); border-radius: 6px; border: 1px solid #444;">`;
    html += `<span style="font-size: 11px; color: #aaa; text-align: center; display:block; margin-bottom:4px;">Sélectionne puis clique sur (?) :</span>`;
    html += `<div style="display: flex; flex-wrap: wrap; gap: 6px; justify-content: center;">`;
    labels.forEach(lbl => {
      html += `<button type="button" class="ddi-label-btn" data-label="${lbl}" style="background: #34495e; border: 1px solid #000; box-shadow: 2px 2px 0 #000; color: #fff; padding: 4px 8px; border-radius: 4px; font-family: 'VT323'; font-size: 14px; cursor: pointer; transition: all 0.2s;">${lbl}</button>`;
    });
    html += `</div></div>`;
    
    html += `</div>`;
    html += `<button type="button" id="ddiValidateBtn" class="arcade-btn green-btn" style="width: 100%; display: block; font-family: 'Press Start 2P'; font-size: 10px; padding: 10px;" disabled>VALIDER LES CIBLES</button>`;
    
    answersContainer.innerHTML = html;
    
    let selectedLabel = null;
    const filledSlots = {};
    
    const labelBtns = answersContainer.querySelectorAll('.ddi-label-btn');
    const slotDivs = answersContainer.querySelectorAll('.ddi-slot');
    const validateBtn = answersContainer.querySelector('#ddiValidateBtn');
    
    labelBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        labelBtns.forEach(b => b.style.outline = 'none');
        selectedLabel = btn.dataset.label;
        btn.style.outline = '3px solid #f5c04a';
      });
    });

    slotDivs.forEach(div => {
      div.addEventListener('click', (e) => {
        e.preventDefault();
        const slotIdx = div.dataset.idx;
        
        if (filledSlots[slotIdx]) {
          const oldLabel = filledSlots[slotIdx];
          delete filledSlots[slotIdx];
          div.textContent = "?";
          div.style.background = "rgba(0,0,0,0.7)";
          div.style.borderColor = "#f5c04a";
          
          const labelBtn = Array.from(labelBtns).find(b => b.dataset.label === oldLabel);
          if (labelBtn) {
            labelBtn.style.opacity = '1';
            labelBtn.style.pointerEvents = 'auto';
          }
        } else if (selectedLabel) {
          filledSlots[slotIdx] = selectedLabel;
          div.textContent = selectedLabel;
          div.style.background = "#2ecc71";
          div.style.borderColor = "#27ae60";
          
          const labelBtn = Array.from(labelBtns).find(b => b.dataset.label === selectedLabel);
          if (labelBtn) {
            labelBtn.style.opacity = '0.3';
            labelBtn.style.pointerEvents = 'none';
          }
          
          labelBtns.forEach(b => b.style.outline = 'none');
          selectedLabel = null;
        }

        const count = Object.keys(filledSlots).length;
        validateBtn.disabled = count < slots.length;
      });
    });

    validateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (_state === 'active') {
        const answersArray = [];
        for (let i = 0; i < slots.length; i++) {
          answersArray.push(filledSlots[i] || "");
        }
        submitAnswer(answersArray);
      }
    });
  }
  else if (type === 'missing_words') {
    answersContainer.className = "quiz-answers missing-words-layout";
    answersContainer.style.display = "block";
    
    const textPattern = _question.question || "";
    const dropdowns = extra.dropdowns || [];
    
    let formattedText = textPattern;
    dropdowns.forEach((options, idx) => {
      let selectHtml = `<select class="mw-select-element" data-idx="${idx}">`;
      selectHtml += `<option value="">-- choisir --</option>`;
      options.forEach(opt => {
        selectHtml += `<option value="${opt}">${opt}</option>`;
      });
      selectHtml += `</select>`;
      formattedText = formattedText.replace(`{select${idx}}`, selectHtml);
    });
    
    qText.innerHTML = `<div class="missing-words-question-text">${formattedText}</div>`;
    
    answersContainer.innerHTML = `
      <button type="button" id="mwValidateBtn" class="arcade-btn green-btn" style="width: 100%; display: block; font-family: 'Press Start 2P'; font-size: 10px; padding: 10px;">VALIDER LES RÉPONSES</button>
    `;
    
    const selects = qText.querySelectorAll('.mw-select-element');
    const validateBtn = answersContainer.querySelector('#mwValidateBtn');
    
    validateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (_state === 'active') {
        const answersArray = Array.from(selects).map(sel => sel.value);
        submitAnswer(answersArray);
      }
    });
  }

  _syncOverlayTimer();
}

function _syncOverlayTimer() {
  const fill = document.getElementById('quizTimerFill');
  if (!fill || !_question) return;
  const maxTime = _question.time_limit || 15;
  const ratio = Math.max(0, _timer / maxTime);
  fill.style.width = `${ratio * 100}%`;
  fill.style.background = ratio > 0.5 ? '#2ecc71' : ratio > 0.25 ? '#f39c12' : '#e74c3c';
}

function _normalizeChoice(choice) {
  if (choice == null) return '';
  return String(choice).trim().toUpperCase();
}

// ── Dessin canvas ─────────────────────────────────────────────────────────────

/**
 * Dessiner l'overlay quiz sur le canvas.
 * Appeler depuis render.js APRÈS drawEnemies et drawPlayer.
 */
export function drawQuiz(ctx, vw, vh) {
  return;
  if (!_active || !_question) return;

  const slideY = _getSlideY(vh);

  ctx.save();
  ctx.translate(0, slideY);

  const panelW = Math.min(680, vw - 32);
  const panelH = 260;
  const px = (vw - panelW) / 2;
  const py = vh - panelH - 16;

  // ── Fond du panneau ────────────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(10, 14, 26, 0.94)';
  _roundRect(ctx, px, py, panelW, panelH, 16);
  ctx.fill();
  ctx.strokeStyle = '#f5c04a';
  ctx.lineWidth = 2;
  _roundRect(ctx, px, py, panelW, panelH, 16);
  ctx.stroke();

  // ── Badge niveau Bloom ─────────────────────────────────────────────────────
  const bloomLabel = {
    knowledge: 'Mémorisation', comprehension: 'Compréhension',
    application: 'Application', analysis: 'Analyse',
    evaluation: 'Évaluation', creation: 'Création'
  }[_question.bloom_level] || 'Question';
  ctx.fillStyle = '#f5c04a';
  ctx.font = 'bold 11px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`❓ ${bloomLabel}  •  +${_question.xp_reward || 50} XP`, px + 16, py + 20);

  // ── Timer bar ─────────────────────────────────────────────────────────────
  const maxTime = _question.time_limit || 15;
  const ratio = Math.max(0, _timer / maxTime);
  const barW = panelW - 32;
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  _roundRect(ctx, px + 16, py + 28, barW, 6, 3); ctx.fill();
  ctx.fillStyle = ratio > 0.5 ? '#2ecc71' : ratio > 0.25 ? '#f39c12' : '#e74c3c';
  _roundRect(ctx, px + 16, py + 28, barW * ratio, 6, 3); ctx.fill();

  // ── Texte question ─────────────────────────────────────────────────────────
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.min(18, Math.floor(panelW / 28))}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  _wrapText(ctx, _question.question, px + panelW / 2, py + 62, panelW - 32, 22);

  // ── Feedback Correct / Wrong ───────────────────────────────────────────────
  if (_state === 'correct' || _state === 'wrong') {
    const ok = _state === 'correct';
    ctx.save();
    ctx.globalAlpha = Math.min(1, _anim * 3);
    ctx.font = `bold ${Math.min(32, vw / 12)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = ok ? '#2ecc71' : '#e74c3c';
    ctx.fillText(ok ? '✓ Bonne réponse !' : '✗ Mauvaise réponse', vw / 2, py - 24);
    ctx.restore();
    _drawParticles(ctx);
  }

  // ── Explication ────────────────────────────────────────────────────────────
  if (_state === 'explaining' && _question.explanation) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, _anim * 2);
    ctx.fillStyle = 'rgba(10,14,26,0.96)';
    _roundRect(ctx, px, py, panelW, panelH, 16); ctx.fill();
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 2;
    _roundRect(ctx, px, py, panelW, panelH, 16); ctx.stroke();

    ctx.fillStyle = '#f5c04a';
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💡 Explication', vw / 2, py + 24);

    ctx.fillStyle = '#e6e6e6';
    ctx.font = `${Math.min(15, panelW / 38)}px Inter, sans-serif`;
    _wrapText(ctx, _question.explanation, vw / 2, py + 54, panelW - 32, 20);
    ctx.restore();
  }

  ctx.restore();
}

/** @deprecated — les réponses passent par l'overlay HTML (#quizOverlay) */
export function handleCanvasClick() {
  return false;
}

// ── Fonctions internes ────────────────────────────────────────────────────────

function _resolveAnswer(choice) {
  const type = _question.type || 'qcm';
  let correct = false;

  if (type === 'qcm') {
    correct = _normalizeChoice(choice) === _normalizeChoice(_question.correct_answer);
  } else if (type === 'tf') {
    correct = String(choice).toUpperCase() === String(_question.correct_answer).toUpperCase();
  } else if (type === 'short_answer') {
    correct = String(choice).trim().toLowerCase() === String(_question.correct_answer).trim().toLowerCase();
  } else if (type === 'matching') {
    let expected = _question.correct_answer;
    if (typeof expected === 'string') {
      try { expected = JSON.parse(expected); } catch(e) { expected = {}; }
    }
    correct = typeof choice === 'object' && choice !== null &&
      Object.keys(expected).every(k => String(choice[k]).trim().toLowerCase() === String(expected[k]).trim().toLowerCase());
  } else if (type === 'dragdrop' || type === 'dragdrop_text') {
    let expected = _question.correct_answer;
    if (typeof expected === 'string') {
      try { expected = JSON.parse(expected); } catch(e) { expected = [expected]; }
    }
    correct = Array.isArray(choice) && Array.isArray(expected) &&
      expected.every((ans, i) => String(choice[i]).trim().toLowerCase() === String(ans).trim().toLowerCase());
  } else if (type === 'dragdrop_image') {
    let expected = _question.correct_answer;
    if (typeof expected === 'string') {
      try { expected = JSON.parse(expected); } catch(e) { expected = []; }
    }
    correct = Array.isArray(choice) && Array.isArray(expected) &&
      expected.every((ans, i) => String(choice[i]).trim().toLowerCase() === String(ans).trim().toLowerCase());
  } else if (type === 'missing_words') {
    let expected = _question.correct_answer;
    if (typeof expected === 'string') {
      try { expected = JSON.parse(expected); } catch(e) { expected = []; }
    }
    correct = Array.isArray(choice) && Array.isArray(expected) &&
      expected.every((ans, i) => String(choice[i]).trim().toLowerCase() === String(ans).trim().toLowerCase());
  } else {
    correct = _normalizeChoice(choice) === _normalizeChoice(_question.correct_answer);
  }

  _state = correct ? 'correct' : 'wrong';
  _anim = 0;
  _syncOverlay();
  if (correct) {
    _xpGained += _question.xp_reward || 50;
    _questionsCorrect++;
    _spawnConfetti();
  } else {
    // Save to failed questions list
    window.failedQuestionsThisRun = window.failedQuestionsThisRun || [];
    if (_question && !window.failedQuestionsThisRun.some(q => q.id === _question.id)) {
      window.failedQuestionsThisRun.push({
        id: _question.id,
        question: _question.question,
        correct_answer: _question.correct_answer,
        explanation: _question.explanation,
        given_answer: choice
      });
    }

    const shielded = window.gameMode !== 'lesson' && window.consumeAnswerShield?.();
    if (!shielded) {
      playLose();
      if (window.gameMode !== 'lesson' && player && typeof player.lives === 'number') {
        player.lives = Math.max(0, player.lives - 1);
        if (player.lives <= 0) {
          window.gameState = 'gameover';
          window.updateMenuVisibility?.();
        }
      }
    }
  }
  _questionsTotal++;
  _recordAnswerToAPI(choice, correct);
}

function _finishQuiz() {
  _state = 'exiting';
  _anim = 0;
  _syncOverlay();
}

async function _recordAnswerToAPI(choice, isCorrect) {
  if (!_session) return;
  const timeTaken = (Date.now() - _startMs) / 1000;
  try {
    await fetch(`${API}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: _session.session_id,
        question_id: _question.id,
        student_id: _session.student_id,
        given_answer: choice,
        is_correct: isCorrect ? 1 : 0,
        time_taken: timeTaken,
        attempt_number: _attempt,
      })
    });
  } catch (_) { /* mode hors-ligne ok */ }
}

function _spawnConfetti() {
  for (let i = 0; i < 28; i++) {
    _particles.push({
      x: Math.random() * 680 + (window.innerWidth - 680) / 2,
      y: window.innerHeight - 280,
      vx: (Math.random() - 0.5) * 320,
      vy: -200 - Math.random() * 200,
      color: ['#f5c04a', '#2ecc71', '#3498db', '#e74c3c', '#fff'][Math.floor(Math.random() * 5)],
      size: 5 + Math.random() * 6,
      life: 0.8 + Math.random() * 0.6,
    });
  }
}

function _drawParticles(ctx) {
  for (const p of _particles) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, p.life * 2);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    ctx.restore();
  }
}

function _drawAnswerButtons(ctx, px, py, panelW, frozen = false) {
  const keys = ['A', 'B', 'C', 'D'];
  const texts = [
    _question.answer_a || '—',
    _question.answer_b || '—',
    _question.answer_c || '—',
    _question.answer_d || '—',
  ];
  const bW = (panelW - 48) / 2;
  const bH = 36;
  const bY1 = py + 150;
  const bY2 = py + 196;
  const bX1 = px + 16;
  const bX2 = px + 16 + bW + 16;
  const positions = [
    { x: bX1, y: bY1 }, { x: bX2, y: bY1 },
    { x: bX1, y: bY2 }, { x: bX2, y: bY2 },
  ];

  keys.forEach((k, i) => {
    const { x, y } = positions[i];
    const isCorrect = k === _question.correct_answer;
    const isChosen = k === _chosen;
    let bg = BTN_COLORS[k].bg;
    if (frozen) {
      bg = isCorrect ? '#2ecc71' : 'rgba(80,80,80,0.7)';
    }
    ctx.fillStyle = bg;
    _roundRect(ctx, x, y, bW, bH, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold 13px Inter, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`${k}.`, x + 10, y + bH / 2 + 5);
    ctx.font = `13px Inter, sans-serif`;
    const maxLen = bW - 40;
    let label = texts[i];
    if (ctx.measureText(label).width > maxLen) {
      while (ctx.measureText(label + '…').width > maxLen && label.length > 0)
        label = label.slice(0, -1);
      label += '…';
    }
    ctx.fillText(label, x + 28, y + bH / 2 + 5);
  });
}

// ── Helpers canvas ────────────────────────────────────────────────────────────
function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function _wrapText(ctx, text, cx, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, y);
      line = word;
      y += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, cx, y);
}

function _getSlideY(vh) {
  if (_state === 'entering') return vh * (1 - _easeOut(_anim));
  if (_state === 'exiting') return vh * _easeIn(_anim);
  return 0;
}

function _easeOut(t) { return 1 - Math.pow(1 - t, 3); }
function _easeIn(t) { return t * t * t; }

// ── Fallback intégré (si tout échoue) ────────────────────────────────────────
const BUILTIN_FALLBACK = [
  // ── QCM (Choix Multiple) ────────────────────────────────────────────────────
  {
    id: 1, type: 'qcm', question: "Combien font 7 × 8 ?",
    answer_a: "54", answer_b: "56", answer_c: "63", answer_d: "48",
    correct_answer: "B", explanation: "7 × 8 = 56. Les tables de multiplication sont essentielles !",
    xp_reward: 50, time_limit: 15, bloom_level: "knowledge"
  },
  {
    id: 2, type: 'qcm', question: "Quelle est la capitale de l'Algérie ?",
    answer_a: "Oran", answer_b: "Annaba", answer_c: "Alger", answer_d: "Tlemcen",
    correct_answer: "C", explanation: "Alger est la capitale et la plus grande ville d'Algérie.",
    xp_reward: 50, time_limit: 15, bloom_level: "knowledge"
  },
  // ── Vrai ou Faux ─────────────────────────────────────────────────────────────
  {
    id: 3, type: 'tf', question: "La Terre est plus grande que le Soleil.",
    correct_answer: "FAUX",
    explanation: "FAUX ! Le Soleil a un diamètre 109 fois plus grand que celui de la Terre.",
    xp_reward: 40, time_limit: 10, bloom_level: "knowledge"
  },
  {
    id: 4, type: 'tf', question: "L'eau bout à 100°C à pression atmosphérique normale.",
    correct_answer: "VRAI",
    explanation: "VRAI ! À 1 atm (pression standard), l'eau se transforme en vapeur à 100°C.",
    xp_reward: 40, time_limit: 10, bloom_level: "knowledge"
  },
  // ── Correspondances (Matching) ────────────────────────────────────────────────
  {
    id: 5, type: 'matching', question: "Associe chaque animal à son habitat :",
    left_items: ["Poisson", "Aigle", "Taupe"],
    right_items: ["Ciel", "Eau", "Terre"],
    correct_answer: { "Poisson": "Eau", "Aigle": "Ciel", "Taupe": "Terre" },
    explanation: "Le poisson vit dans l'eau, l'aigle vole dans le ciel, la taupe creuse dans la terre.",
    xp_reward: 80, time_limit: 25, bloom_level: "comprehension"
  },
  {
    id: 6, type: 'matching', question: "Associe chaque pays à sa capitale :",
    left_items: ["France", "Maroc", "Espagne"],
    right_items: ["Madrid", "Paris", "Rabat"],
    correct_answer: { "France": "Paris", "Maroc": "Rabat", "Espagne": "Madrid" },
    explanation: "Paris = France, Rabat = Maroc, Madrid = Espagne.",
    xp_reward: 80, time_limit: 25, bloom_level: "knowledge"
  },
  // ── Glisser-Déposer / Texte à trous (Drag & Drop) ───────────────────────────
  {
    id: 7, type: 'dragdrop',
    question: "Complète la formule : {slot0} + {slot1} = Eau (H₂O)",
    text: "{slot0} + {slot1} = Eau (H₂O)",
    choices: ["Oxygène", "Hydrogène", "Carbone", "Azote"],
    correct_answer: ["Hydrogène", "Oxygène"],
    explanation: "L'eau (H₂O) est formée de deux atomes d'Hydrogène et un atome d'Oxygène.",
    xp_reward: 100, time_limit: 30, bloom_level: "application"
  },
  {
    id: 8, type: 'dragdrop',
    question: "Ordonne les planètes du Soleil : {slot0}, {slot1}, Terre",
    text: "{slot0}, {slot1}, Terre",
    choices: ["Mars", "Mercure", "Jupiter", "Vénus"],
    correct_answer: ["Mercure", "Vénus"],
    explanation: "L'ordre est Mercure, Vénus, Terre, Mars... en partant du Soleil.",
    xp_reward: 100, time_limit: 30, bloom_level: "knowledge"
  },
];

export function getNextQuestionHint() {
  const pool = (_questionPool && _questionPool.length > 0) ? _questionPool : BUILTIN_FALLBACK;
  if (pool && pool.length > 0) {
    const nextQ = pool[_poolIndex % pool.length];
    if (nextQ) {
      return {
        question: nextQ.question,
        hint: nextQ.explanation || `Indice du grimoire : Révise bien le sujet de la question suivante : "${nextQ.question}"`
      };
    }
  }
  return {
    question: "Générale",
    hint: "Indice : Récolte les pièces et les cibles pour améliorer ton score et préparer tes examens !"
  };
}
