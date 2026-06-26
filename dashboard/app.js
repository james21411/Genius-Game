const API = 'http://localhost:5001/api';

// --- State Management ---
let currentTeacherId = localStorage.getItem('teacher_id');
let currentClassId = null;
let activeTab = 'dashboard';

// --- DOM Elements ---
const authOverlay = document.getElementById('auth-overlay');
const gameApp = document.getElementById('game-app');
const classSelect = document.getElementById('class-select');
const teacherNameSpan = document.getElementById('teacher-name');
const navClassCode = document.getElementById('nav-class-code');

// Tab Titles & Descriptions mapping
const tabInfo = {
  dashboard: { title: "Tableau de Bord", desc: "Statistiques globales et activité récente de vos élèves." },
  classes: { title: "Gestion des Classes", desc: "Créez vos classes et configurez les clés d'accès élève." },
  evaluations: { title: "Évaluations & Leçons", desc: "Configurez les chapitres d'évaluation (évaluation/leçon) de vos classes." },
  questions: { title: "Banque de Questions", desc: "Configurez les 7 types de questions pédagogiques sans exception." },
  results: { title: "Registre des Héros", desc: "Consultez les scores détaillés et les réponses de chaque élève." }
};

// --- Initialization ---
if (currentTeacherId) {
  showApp();
} else {
  showAuth();
}

function showAuth() {
  authOverlay.classList.remove('hidden');
  gameApp.classList.add('hidden');
}

async function showApp() {
  authOverlay.classList.add('hidden');
  gameApp.classList.remove('hidden');
  teacherNameSpan.textContent = localStorage.getItem('teacher_name') || 'Professeur';
  
  initSidebar();
  initQuestionBuilder();
  await fetchClasses();
}

// --- Tab switcher ---
function initSidebar() {
  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = item.dataset.tab;
      
      document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.add('hidden'));
      document.getElementById(`panel-${tab}`).classList.remove('hidden');
      
      activeTab = tab;
      document.getElementById('current-tab-title').textContent = tabInfo[tab].title;
      document.getElementById('current-tab-desc').textContent = tabInfo[tab].desc;
      
      // Refresh logic per tab
      if (tab === 'dashboard') {
        fetchStats();
      } else if (tab === 'classes') {
        fetchClassesList();
      } else if (tab === 'evaluations') {
        fetchWorldsList();
      } else if (tab === 'questions') {
        fetchWorldsDropdown();
        fetchQuestionsList();
      } else if (tab === 'results') {
        fetchStats();
      }
    });
  });
}

// --- Auth Actions ---
document.getElementById('btn-show-register').onclick = () => {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.remove('hidden');
};
document.getElementById('btn-show-login').onclick = () => {
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('login-form').classList.remove('hidden');
};

document.getElementById('btn-login').onclick = async () => {
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const feedback = document.getElementById('auth-feedback');
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('teacher_id', data.teacher_id);
      localStorage.setItem('teacher_name', data.name);
      currentTeacherId = data.teacher_id;
      showApp();
    } else {
      feedback.textContent = '❌ ' + (data.error || 'Identifiants invalides');
      feedback.style.color = '#ef4444';
    }
  } catch (err) { 
    feedback.textContent = '❌ Erreur de connexion au serveur'; 
    feedback.style.color = '#ef4444';
  }
};

document.getElementById('btn-register').onclick = async () => {
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const feedback = document.getElementById('auth-feedback');
  try {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (res.ok) {
      feedback.textContent = '✅ Compte créé ! Connectez-vous.';
      feedback.style.color = '#10b981';
      document.getElementById('btn-show-login').click();
    } else {
      feedback.textContent = '❌ ' + (data.error || 'Erreur d\'inscription');
      feedback.style.color = '#ef4444';
    }
  } catch (err) { 
    feedback.textContent = '❌ Erreur de connexion au serveur'; 
    feedback.style.color = '#ef4444';
  }
};

document.getElementById('btn-logout').onclick = () => {
  localStorage.clear();
  location.reload();
};

// --- Class Management ---
async function fetchClasses() {
  try {
    const res = await fetch(`${API}/classes?teacher_id=${currentTeacherId}`);
    const classes = await res.json();
    classSelect.innerHTML = classes.map(c => `<option value="${c.id}" data-code="${c.code}">${c.name}</option>`).join('');
    if (classes.length > 0) {
      if (!currentClassId) currentClassId = classes[0].id;
      classSelect.value = currentClassId;
      updateClassDisplay();
      if (activeTab === 'dashboard') fetchStats();
      else if (activeTab === 'classes') fetchClassesList();
      else if (activeTab === 'evaluations') fetchWorldsList();
      else if (activeTab === 'questions') { fetchWorldsDropdown(); fetchQuestionsList(); }
    } else {
      classSelect.innerHTML = '<option value="">Créer une classe...</option>';
      navClassCode.textContent = '-';
    }
  } catch (err) { console.error("Erreur classes:", err); }
}

classSelect.onchange = (e) => {
  currentClassId = e.target.value;
  updateClassDisplay();
  
  if (activeTab === 'dashboard') fetchStats();
  else if (activeTab === 'classes') fetchClassesList();
  else if (activeTab === 'evaluations') fetchWorldsList();
  else if (activeTab === 'questions') { fetchWorldsDropdown(); fetchQuestionsList(); }
  else if (activeTab === 'results') fetchStats();
};

function updateClassDisplay() {
  const selectedOption = classSelect.options[classSelect.selectedIndex];
  if (selectedOption) navClassCode.textContent = selectedOption.dataset.code;
}

// Modal and Class CRUD Actions
const classModal = document.getElementById('class-modal');
const btnCreateClassModal = document.getElementById('btn-create-class-modal');
const btnCloseClassModal = document.getElementById('btn-close-class-modal');
const classForm = document.getElementById('class-form');

btnCreateClassModal.onclick = () => {
  document.getElementById('class-modal-title').textContent = "Créer une Nouvelle Classe";
  document.getElementById('modal-class-id').value = "";
  document.getElementById('class-name-input').value = "";
  document.getElementById('class-subject-input').value = "Mathématiques";
  document.getElementById('class-grade-input').value = "CM2";
  document.getElementById('class-code-input').value = "";
  classModal.classList.remove('hidden');
};

btnCloseClassModal.onclick = () => {
  classModal.classList.add('hidden');
};

classForm.onsubmit = async (e) => {
  e.preventDefault();
  const classId = document.getElementById('modal-class-id').value;
  const name = document.getElementById('class-name-input').value;
  const subject = document.getElementById('class-subject-input').value;
  const grade = document.getElementById('class-grade-input').value;
  const code = document.getElementById('class-code-input').value;

  const url = classId ? `${API}/classes/${classId}` : `${API}/classes`;
  const method = classId ? 'PUT' : 'POST';
  const body = classId ? { name, code, subject, grade } : { teacher_id: currentTeacherId, name, subject, grade, code };

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (res.ok) {
      classModal.classList.add('hidden');
      if (!classId) currentClassId = data.class_id;
      await fetchClasses();
    } else {
      alert("❌ Erreur : " + (data.error || "Action impossible"));
    }
  } catch (err) {
    alert("❌ Erreur de communication avec le serveur.");
  }
};

async function fetchClassesList() {
  try {
    const res = await fetch(`${API}/classes?teacher_id=${currentTeacherId}`);
    const classes = await res.json();
    const tbody = document.getElementById('classes-list-body');
    tbody.innerHTML = classes.map(c => `
      <tr>
        <td><strong>${c.name}</strong></td>
        <td>${c.subject}</td>
        <td>${c.grade}</td>
        <td><code style="background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius:4px; font-weight:bold; color:#fbbf24;">${c.code}</code></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editClass(${c.id}, '${c.name}', '${c.code}', '${c.subject}', '${c.grade}')">✏️ Modifier</button>
          <button class="btn btn-danger btn-sm" onclick="deleteClass(${c.id})">🗑️ Supprimer</button>
        </td>
      </tr>
    `).join('') || `<tr><td colspan="5" class="text-center">Aucune classe configurée.</td></tr>`;
  } catch (err) { console.error(err); }
}

window.editClass = (id, name, code, subject, grade) => {
  document.getElementById('class-modal-title').textContent = "Modifier la Classe";
  document.getElementById('modal-class-id').value = id;
  document.getElementById('class-name-input').value = name;
  document.getElementById('class-subject-input').value = subject;
  document.getElementById('class-grade-input').value = grade;
  document.getElementById('class-code-input').value = code;
  classModal.classList.remove('hidden');
};

window.deleteClass = async (id) => {
  if (!confirm("Voulez-vous vraiment supprimer cette classe ? Tous les élèves associés seront supprimés.")) return;
  try {
    const res = await fetch(`${API}/classes/${id}`, { method: 'DELETE' });
    if (res.ok) {
      if (currentClassId == id) currentClassId = null;
      await fetchClasses();
    }
  } catch (err) { console.error(err); }
};

// --- World / Evaluation Management ---
const worldModal = document.getElementById('world-modal');
const btnCreateWorldModal = document.getElementById('btn-create-world-modal');
const btnCloseWorldModal = document.getElementById('btn-close-world-modal');
const worldForm = document.getElementById('world-form');

btnCreateWorldModal.onclick = () => {
  document.getElementById('world-modal-title').textContent = "Créer une Évaluation ou Leçon";
  document.getElementById('modal-world-id').value = "";
  document.getElementById('world-name-input').value = "";
  document.getElementById('world-topic-input').value = "";
  document.getElementById('world-subject-input').value = "Mathématiques";
  document.getElementById('world-mode-input').value = "eval";
  worldModal.classList.remove('hidden');
};

btnCloseWorldModal.onclick = () => {
  worldModal.classList.add('hidden');
};

worldForm.onsubmit = async (e) => {
  e.preventDefault();
  const worldId = document.getElementById('modal-world-id').value;
  const name = document.getElementById('world-name-input').value;
  const topic = document.getElementById('world-topic-input').value;
  const subject = document.getElementById('world-subject-input').value;
  const mode = document.getElementById('world-mode-input').value;

  const url = worldId ? `${API}/worlds/${worldId}` : `${API}/worlds`;
  const method = worldId ? 'PUT' : 'POST';
  const body = { class_id: parseInt(currentClassId), name, topic, subject, mode };

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      worldModal.classList.add('hidden');
      await fetchWorldsList();
    }
  } catch (err) { console.error(err); }
};

async function fetchWorldsList() {
  if (!currentClassId) return;
  try {
    const res = await fetch(`${API}/classes/${currentClassId}/worlds`);
    const worlds = await res.json();
    const tbody = document.getElementById('worlds-list-body');
    tbody.innerHTML = worlds.map(w => `
      <tr>
        <td><strong>${w.name}</strong></td>
        <td>${w.topic}</td>
        <td>
          <span style="padding: 4px 8px; border-radius: 4px; font-size:12px; font-weight:bold; ${w.mode === 'eval' ? 'background:rgba(239,68,68,0.15); color:#fca5a5;' : 'background:rgba(59,130,246,0.15); color:#93c5fd;'}">
            ${w.mode === 'eval' ? '🔥 ÉVALUATION' : '📘 LEÇON'}
          </span>
        </td>
        <td>Mande ${w.world_index}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editWorld(${w.id}, '${w.name}', '${w.topic}', '${w.subject}', '${w.mode}')">✏️ Modifier</button>
          <button class="btn btn-danger btn-sm" onclick="deleteWorld(${w.id})">🗑️ Supprimer</button>
        </td>
      </tr>
    `).join('') || `<tr><td colspan="5" class="text-center">Aucune évaluation ou leçon créée.</td></tr>`;
  } catch (err) { console.error(err); }
}

window.editWorld = (id, name, topic, subject, mode) => {
  document.getElementById('world-modal-title').textContent = "Modifier le Chapitre";
  document.getElementById('modal-world-id').value = id;
  document.getElementById('world-name-input').value = name;
  document.getElementById('world-topic-input').value = topic;
  document.getElementById('world-subject-input').value = subject;
  document.getElementById('world-mode-input').value = mode;
  worldModal.classList.remove('hidden');
};

window.deleteWorld = async (id) => {
  if (!confirm("Voulez-vous supprimer cette évaluation ? Toutes les questions liées seront également affectées.")) return;
  try {
    const res = await fetch(`${API}/worlds/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchWorldsList();
    }
  } catch (err) { console.error(err); }
};

// --- Question Builder / 7 Types (No exceptions) ---

function initQuestionBuilder() {
  const qType = document.getElementById('q-type');
  const qTextHelp = document.getElementById('q-text-help');

  qType.addEventListener('change', () => {
    // Hide all type containers
    document.querySelectorAll('.q-type-fields').forEach(f => f.classList.add('hidden'));
    
    const selected = qType.value;
    const targetFields = document.getElementById(`fields-${selected}`);
    if (targetFields) targetFields.classList.remove('hidden');

    // Update help text
    if (selected === 'dragdrop_text') {
      qTextHelp.classList.remove('hidden');
      qTextHelp.innerHTML = "💡 Insérez des trous dans l'énoncé avec des crochets, par exemple : <code>Le chien {slot0} un os et le chat {slot1} du lait.</code>";
    } else if (selected === 'missing_words') {
      qTextHelp.classList.remove('hidden');
      qTextHelp.innerHTML = "💡 Insérez des dropdowns avec des crochets : <code>L'eau gèle à {select0} et bout à {select1}.</code>";
    } else {
      qTextHelp.classList.add('hidden');
    }
  });

  // Dynamic Image targets setup
  const btnAddDdiTarget = document.getElementById('btn-add-ddi-target');
  const ddiTargetsList = document.getElementById('ddi-targets-list');
  
  btnAddDdiTarget.onclick = () => {
    const idx = ddiTargetsList.children.length;
    const row = document.createElement('div');
    row.className = 'ddi-target-row';
    row.innerHTML = `
      <input type="number" class="ddi-x" placeholder="X %" min="0" max="100" style="width:70px;" required>
      <input type="number" class="ddi-y" placeholder="Y %" min="0" max="100" style="width:70px;" required>
      <input type="text" class="ddi-label" placeholder="Étiquette correcte (ex: Cœur)" required>
      <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">❌</button>
    `;
    ddiTargetsList.appendChild(row);
  };

  // Preset image toggle
  const qDdiImage = document.getElementById('q-ddi-image');
  qDdiImage.onchange = () => {
    document.getElementById('q-ddi-custom-url-group').classList.toggle('hidden', qDdiImage.value !== 'custom');
  };

  // Dynamic Matching pairs setup
  const btnAddMatchingPair = document.getElementById('btn-add-matching-pair');
  const matchingPairsList = document.getElementById('matching-pairs-list');

  btnAddMatchingPair.onclick = () => {
    const row = document.createElement('div');
    row.className = 'matching-pair-row';
    row.innerHTML = `
      <input type="text" class="match-left" placeholder="Élément gauche (ex: Chien)" required>
      <input type="text" class="match-right" placeholder="Élément associé (ex: Niche)" required>
      <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">❌</button>
    `;
    matchingPairsList.appendChild(row);
  };

  // Dynamic Missing words choices
  const btnAddMwSelect = document.getElementById('btn-add-mw-select');
  const missingWordsList = document.getElementById('missing-words-list');

  btnAddMwSelect.onclick = () => {
    const idx = missingWordsList.children.length;
    const row = document.createElement('div');
    row.className = 'mw-select-row';
    row.innerHTML = `
      <span style="font-size:12px; font-weight:bold; min-width:60px;">select${idx} :</span>
      <input type="text" class="mw-options" placeholder="Choix séparés par des virgules (ex: Rouge, Bleu, Jaune)" style="flex:1;" required>
      <input type="text" class="mw-correct" placeholder="Choix correct" style="width:120px;" required>
      <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">❌</button>
    `;
    missingWordsList.appendChild(row);
  };
}

async function fetchWorldsDropdown() {
  if (!currentClassId) return;
  try {
    const res = await fetch(`${API}/classes/${currentClassId}/worlds`);
    const worlds = await res.json();
    const dropdown = document.getElementById('q-world');
    dropdown.innerHTML = worlds.map(w => `<option value="${w.id}">${w.name} (${w.topic})</option>`).join('') || '<option value="">-- Créer un chapitre d\'abord --</option>';
  } catch (err) { console.error(err); }
}

// Submit Question Form
document.getElementById('question-form').onsubmit = async (e) => {
  e.preventDefault();
  const worldId = document.getElementById('q-world').value;
  if (!worldId) return alert("Sélectionnez ou créez un chapitre !");

  const questionId = document.getElementById('modal-question-id').value;
  const qType = document.getElementById('q-type').value;

  const payload = {
    class_id: parseInt(currentClassId),
    world_id: parseInt(worldId),
    type: qType,
    subject: document.getElementById('q-subject').value,
    topic: document.getElementById('q-topic').value,
    bloom_level: document.getElementById('q-bloom').value,
    question: document.getElementById('q-text').value,
    xp_reward: parseInt(document.getElementById('q-xp').value),
    time_limit: parseInt(document.getElementById('q-timer').value),
    explanation: document.getElementById('q-explanation').value,
    
    // Default empty fields
    answer_a: '', answer_b: '', answer_c: '', answer_d: '',
    correct_answer: '',
    extra_data: ''
  };

  // Compile type-specific data
  if (qType === 'qcm') {
    payload.answer_a = document.getElementById('q-ans-a').value;
    payload.answer_b = document.getElementById('q-ans-b').value;
    payload.answer_c = document.getElementById('q-ans-c').value;
    payload.answer_d = document.getElementById('q-ans-d').value;
    payload.correct_answer = document.getElementById('q-correct-qcm').value;
  } 
  else if (qType === 'tf') {
    payload.correct_answer = document.getElementById('q-correct-tf').value;
  } 
  else if (qType === 'short_answer') {
    payload.correct_answer = document.getElementById('q-correct-short').value.trim();
  } 
  else if (qType === 'dragdrop_text') {
    const choices = document.getElementById('q-ddt-choices').value.split(',').map(s => s.trim());
    const correct = document.getElementById('q-ddt-correct').value.split(',').map(s => s.trim());
    payload.extra_data = JSON.stringify({ choices, correct });
    payload.correct_answer = JSON.stringify(correct);
  } 
  else if (qType === 'dragdrop_image') {
    const imagePreset = document.getElementById('q-ddi-image').value;
    const image = imagePreset === 'custom' ? document.getElementById('q-ddi-custom-url').value : imagePreset;
    const labels = document.getElementById('q-ddi-labels').value.split(',').map(s => s.trim());
    
    const slots = [];
    document.querySelectorAll('.ddi-target-row').forEach(row => {
      slots.push({
        x: parseInt(row.querySelector('.ddi-x').value),
        y: parseInt(row.querySelector('.ddi-y').value),
        label: row.querySelector('.ddi-label').value.trim()
      });
    });

    payload.extra_data = JSON.stringify({ image, labels, slots });
    payload.correct_answer = JSON.stringify(slots.map(s => s.label));
  } 
  else if (qType === 'matching') {
    const left_items = [];
    const right_items = [];
    const pairs = {};

    document.querySelectorAll('.matching-pair-row').forEach(row => {
      const left = row.querySelector('.match-left').value.trim();
      const right = row.querySelector('.match-right').value.trim();
      if(left && right) {
        left_items.push(left);
        right_items.push(right);
        pairs[left] = right;
      }
    });

    // Shuffle right items to make it interesting
    right_items.sort(() => Math.random() - 0.5);

    payload.extra_data = JSON.stringify({ left_items, right_items, pairs });
    payload.correct_answer = JSON.stringify(pairs);
  } 
  else if (qType === 'missing_words') {
    const dropdowns = [];
    const correct = [];

    document.querySelectorAll('.mw-select-row').forEach(row => {
      const options = row.querySelector('.mw-options').value.split(',').map(s => s.trim());
      const correctChoice = row.querySelector('.mw-correct').value.trim();
      dropdowns.push(options);
      correct.push(correctChoice);
    });

    payload.extra_data = JSON.stringify({ dropdowns, correct });
    payload.correct_answer = JSON.stringify(correct);
  }

  const feedback = document.getElementById('q-feedback');
  feedback.textContent = 'Enregistrement de la question...';
  feedback.className = 'feedback-msg';

  const url = questionId ? `${API}/questions/${questionId}` : `${API}/questions`;
  const method = questionId ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      feedback.textContent = '✅ Question enregistrée dans la banque !';
      feedback.className = 'feedback-msg feedback-success';
      resetQuestionForm();
      await fetchQuestionsList();
    } else {
      feedback.textContent = '❌ Erreur de validation';
      feedback.className = 'feedback-msg feedback-error';
    }
  } catch (err) {
    feedback.textContent = '❌ Erreur de connexion';
    feedback.className = 'feedback-msg feedback-error';
  }
};

function resetQuestionForm() {
  document.getElementById('modal-question-id').value = "";
  document.getElementById('q-topic').value = "";
  document.getElementById('q-text').value = "";
  document.getElementById('q-ans-a').value = "";
  document.getElementById('q-ans-b').value = "";
  document.getElementById('q-ans-c').value = "";
  document.getElementById('q-ans-d').value = "";
  document.getElementById('q-correct-short').value = "";
  document.getElementById('q-ddt-choices').value = "";
  document.getElementById('q-ddt-correct').value = "";
  document.getElementById('q-ddi-labels').value = "";
  document.getElementById('ddi-targets-list').innerHTML = "";
  document.getElementById('matching-pairs-list').innerHTML = "";
  document.getElementById('missing-words-list').innerHTML = "";
  document.getElementById('q-explanation').value = "";
  document.getElementById('btn-save-question').textContent = "🔨 Forger la Question";
}

document.getElementById('btn-reset-question').onclick = resetQuestionForm;

async function fetchQuestionsList() {
  if (!currentClassId) return;
  try {
    const res = await fetch(`${API}/questions?class_id=${currentClassId}`);
    const questions = await res.json();
    document.getElementById('q-count').textContent = questions.length;

    const tbody = document.getElementById('questions-list-body');
    tbody.innerHTML = questions.map(q => `
      <tr>
        <td style="max-width:300px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${q.question}</td>
        <td><span style="background:rgba(255,255,255,0.08); padding:3px 6px; border-radius:4px; font-size:12px;">${q.type.toUpperCase()}</span></td>
        <td>Monde ${q.world_id || '—'}</td>
        <td>${q.bloom_level}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editQuestion(${JSON.stringify(q).replace(/"/g, '&quot;')})">✏️ Modifier</button>
          <button class="btn btn-danger btn-sm" onclick="deleteQuestion(${q.id})">🗑️ Suppr.</button>
        </td>
      </tr>
    `).join('') || `<tr><td colspan="5" class="text-center">Aucune question configurée pour cette classe.</td></tr>`;
  } catch (err) { console.error(err); }
}

window.editQuestion = (q) => {
  resetQuestionForm();
  document.getElementById('modal-question-id').value = q.id;
  document.getElementById('q-type').value = q.type;
  document.getElementById('q-type').dispatchEvent(new Event('change'));

  document.getElementById('q-world').value = q.world_id || "";
  document.getElementById('q-subject').value = q.subject;
  document.getElementById('q-topic').value = q.topic;
  document.getElementById('q-bloom').value = q.bloom_level;
  document.getElementById('q-xp').value = q.xp_reward;
  document.getElementById('q-timer').value = q.time_limit || 15;
  document.getElementById('q-text').value = q.question;
  document.getElementById('q-explanation').value = q.explanation || "";

  document.getElementById('btn-save-question').textContent = "💾 Mettre à Jour";

  // Fill type details
  let extra = {};
  if (q.extra_data) {
    try { extra = JSON.parse(q.extra_data); } catch(e) {}
  }

  if (q.type === 'qcm') {
    document.getElementById('q-ans-a').value = q.answer_a;
    document.getElementById('q-ans-b').value = q.answer_b;
    document.getElementById('q-ans-c').value = q.answer_c;
    document.getElementById('q-ans-d').value = q.answer_d;
    document.getElementById('q-correct-qcm').value = q.correct_answer;
  } 
  else if (q.type === 'tf') {
    document.getElementById('q-correct-tf').value = q.correct_answer;
  } 
  else if (q.type === 'short_answer') {
    document.getElementById('q-correct-short').value = q.correct_answer;
  } 
  else if (q.type === 'dragdrop_text') {
    document.getElementById('q-ddt-choices').value = (extra.choices || []).join(', ');
    document.getElementById('q-ddt-correct').value = (extra.correct || []).join(', ');
  } 
  else if (q.type === 'dragdrop_image') {
    document.getElementById('q-ddi-image').value = extra.image && ['carte_france', 'squelette', 'systeme_solaire'].includes(extra.image) ? extra.image : 'custom';
    document.getElementById('q-ddi-image').dispatchEvent(new Event('change'));
    if (document.getElementById('q-ddi-image').value === 'custom') {
      document.getElementById('q-ddi-custom-url').value = extra.image || "";
    }
    document.getElementById('q-ddi-labels').value = (extra.labels || []).join(', ');

    const ddiTargetsList = document.getElementById('ddi-targets-list');
    (extra.slots || []).forEach(slot => {
      const row = document.createElement('div');
      row.className = 'ddi-target-row';
      row.innerHTML = `
        <input type="number" class="ddi-x" value="${slot.x}" placeholder="X %" min="0" max="100" style="width:70px;" required>
        <input type="number" class="ddi-y" value="${slot.y}" placeholder="Y %" min="0" max="100" style="width:70px;" required>
        <input type="text" class="ddi-label" value="${slot.label}" placeholder="Étiquette" required>
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">❌</button>
      `;
      ddiTargetsList.appendChild(row);
    });
  } 
  else if (q.type === 'matching') {
    const matchingPairsList = document.getElementById('matching-pairs-list');
    const pairs = extra.pairs || {};
    Object.keys(pairs).forEach(leftKey => {
      const row = document.createElement('div');
      row.className = 'matching-pair-row';
      row.innerHTML = `
        <input type="text" class="match-left" value="${leftKey}" placeholder="Gauche" required>
        <input type="text" class="match-right" value="${pairs[leftKey]}" placeholder="Droite" required>
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">❌</button>
      `;
      matchingPairsList.appendChild(row);
    });
  } 
  else if (q.type === 'missing_words') {
    const missingWordsList = document.getElementById('missing-words-list');
    const dropdowns = extra.dropdowns || [];
    const correct = extra.correct || [];
    dropdowns.forEach((opts, idx) => {
      const row = document.createElement('div');
      row.className = 'mw-select-row';
      row.innerHTML = `
        <span style="font-size:12px; font-weight:bold; min-width:60px;">select${idx} :</span>
        <input type="text" class="mw-options" value="${opts.join(', ')}" placeholder="Choix" style="flex:1;" required>
        <input type="text" class="mw-correct" value="${correct[idx] || ''}" placeholder="Correct" style="width:120px;" required>
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">❌</button>
      `;
      missingWordsList.appendChild(row);
    });
  }
};

window.deleteQuestion = async (id) => {
  if (!confirm("Voulez-vous supprimer cette question ?")) return;
  try {
    const res = await fetch(`${API}/questions/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchQuestionsList();
    }
  } catch (err) { console.error(err); }
};

// --- CSV Import ---
document.getElementById('btn-do-import').onclick = async () => {
  if (!currentClassId) return alert("Sélectionnez une classe active !");
  const worldId = document.getElementById('q-world').value;
  if (!worldId) return alert("Sélectionnez ou créez un chapitre pour y affecter les questions !");
  
  const fileInput = document.getElementById('csv-file');
  const file = fileInput.files[0];
  if (!file) return alert("Sélectionnez un fichier CSV.");

  const feedback = document.getElementById('import-feedback');
  feedback.textContent = "Importation en cours...";
  feedback.className = "feedback-msg";

  const reader = new FileReader();
  reader.onload = async (e) => {
    const text = e.target.result;
    const lines = text.split('\n').slice(1); // Skip header line
    let count = 0;

    for (let line of lines) {
      const parts = line.split(',');
      if (parts.length < 6) continue;

      const payload = {
        class_id: parseInt(currentClassId),
        world_id: parseInt(worldId),
        type: 'qcm',
        subject: 'Importé',
        topic: 'CSV',
        bloom_level: 'knowledge',
        question: parts[0].trim(),
        answer_a: parts[1].trim(),
        answer_b: parts[2].trim(),
        answer_c: parts[3].trim(),
        answer_d: parts[4].trim(),
        correct_answer: parts[5].trim().toUpperCase(),
        explanation: parts[6] ? parts[6].trim() : "",
        time_limit: 15,
        xp_reward: 50,
        difficulty: 1,
        extra_data: ''
      };

      await fetch(`${API}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      count++;
    }
    feedback.textContent = `✅ ${count} questions importées avec succès !`;
    feedback.className = "feedback-msg feedback-success";
    await fetchQuestionsList();
  };
  reader.readAsText(file);
};

// --- Statistics & Results (Leaderboard & Heatmap) ---
document.getElementById('btn-export').onclick = async () => {
  if (!currentClassId) return;
  try {
    const res = await fetch(`${API}/stats?class_id=${currentClassId}`);
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport_pedagogique_classe_${currentClassId}.json`;
    a.click();
  } catch (err) { alert("Erreur d'export"); }
};

async function fetchStats() {
  if (!currentClassId) return;
  try {
    const res = await fetch(`${API}/stats?class_id=${currentClassId}`);
    if (res.ok) {
      const data = await res.json();
      renderDashboard(data);
    }
  } catch (err) { console.error(err); }
}

function renderDashboard(data) {
  const { summary, students, heatmap } = data;
  document.getElementById('stat-active').textContent = summary.active_students || 0;
  document.getElementById('stat-avg').textContent = (summary.class_avg || 0) + '%';
  document.getElementById('stat-sessions').textContent = students.length;

  // Render Dashboard table row
  const tbodyStud = document.getElementById('dashboard-students-body');
  tbodyStud.innerHTML = students.map(s => `
    <tr>
      <td><strong>${s.name}</strong></td>
      <td>Niveau ${s.game_level}</td>
      <td><span style="color:#fbbf24; font-weight:bold;">${s.xp} XP</span></td>
      <td><span style="background:rgba(16,185,129,0.15); color:#10b981; padding:3px 6px; border-radius:4px; font-size:12px;">Actif</span></td>
    </tr>
  `).join('') || `<tr><td colspan="4" class="text-center">Aucun héros connecté.</td></tr>`;

  // Render Heatmap table row
  const tbodyHeat = document.getElementById('dashboard-heatmap-body');
  tbodyHeat.innerHTML = heatmap.map(q => {
    const rate = Math.round(q.success_rate || 0);
    return `
      <tr>
        <td style="max-width:300px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${q.question}</td>
        <td><span style="background:rgba(245,158,11,0.15); color:#f59e0b; padding:3px 6px; border-radius:4px; font-size:12px;">Niveau ${q.difficulty}</span></td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="flex:1; background:rgba(255,255,255,0.08); height:6px; border-radius:3px; overflow:hidden; min-width:80px;">
              <div style="width:${rate}%; background:${rate > 60 ? '#10b981' : rate > 35 ? '#f59e0b' : '#ef4444'}; height:100%;"></div>
            </div>
            <strong>${rate}%</strong>
          </div>
        </td>
      </tr>
    `;
  }).join('') || `<tr><td colspan="3" class="text-center">Aucune donnée sur les épreuves.</td></tr>`;

  // Render detailed results table
  const tbodyResults = document.getElementById('results-students-body');
  if (tbodyResults) {
    tbodyResults.innerHTML = students.map(s => `
      <tr>
        <td><strong>${s.name}</strong></td>
        <td><strong style="color:#fbbf24;">${s.xp} XP</strong></td>
        <td>Niveau ${s.game_level}</td>
        <td><span style="color:#10b981;">Inscrit</span></td>
      </tr>
    `).join('') || `<tr><td colspan="4" class="text-center">Aucun élève enregistré.</td></tr>`;
  }
}

// Auto-refresh statistics every 15 seconds
setInterval(() => {
  if (activeTab === 'dashboard' || activeTab === 'results') {
    fetchStats();
  }
}, 15000);
