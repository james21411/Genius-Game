const API = 'http://localhost:5001/api';

// --- State Management ---
let currentTeacherId = localStorage.getItem('teacher_id');
let currentClassId = null;
let activeTab = 'dashboard';

// Question builder and AI modal globals must be initialized before showApp()
// because showApp() can run immediately for already-authenticated teachers.
const QUESTION_TYPES = [
  { key: 'qcm', label: 'QCM', apiKey: 'qcm' },
  { key: 'tf', label: 'Vrai / Faux', apiKey: 'tf' },
  { key: 'short_answer', label: 'Réponse courte', apiKey: 'short_answer' },
  { key: 'matching', label: 'Association', apiKey: 'matching' },
  { key: 'dragdrop_text', label: 'Glisser-déposer texte', apiKey: 'dragdrop' },
  { key: 'dragdrop_image', label: 'Glisser-déposer image', apiKey: 'dragdrop_image' },
  { key: 'missing_words', label: 'Mots manquants', apiKey: 'missing_words' },
];

const BLOOM_LEVELS = [
  { key: 'knowledge', label: 'Mémorisation' },
  { key: 'comprehension', label: 'Compréhension' },
  { key: 'application', label: 'Application' },
  { key: 'analysis', label: 'Analyse' },
  { key: 'evaluation', label: 'Évaluation' },
  { key: 'creation', label: 'Création' },
];

let aiModalInitialized = false;
let aiChatHistory = [];
let aiGeneratedPreview = [];
let lessonAiInitialized = false;
let lessonAiPreview = [];
let lessonFragmentImageData = '';

// --- DOM Elements ---
const authOverlay = document.getElementById('auth-overlay');
const gameApp = document.getElementById('game-app');
const classSelect = document.getElementById('class-select');
const teacherNameSpan = document.getElementById('teacher-name');
const navClassCode = document.getElementById('nav-class-code');

// Tab Titles & Descriptions mapping
const tabInfo = {
  dashboard: { title: "Tableau de bord", desc: "Statistiques globales et activite recente." },
  classes: { title: "Classes", desc: "Creez vos classes et les codes d'acces eleve." },
  lessons: { title: "Lecons", desc: "Configurez des activites d'apprentissage guide." },
  evaluations: { title: "Evaluations", desc: "Configurez des activites d'evaluation chronometree." },
  questions: { title: "Banque de questions", desc: "Ajoutez des questions a vos activites ou generez-les depuis vos cours." },
  results: { title: "Resultats", desc: "Consultez les performances de vos eleves." }
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
  initAiGeneratorModal();
  initLessonFragments();
  initLessonAiModal();
  await fetchClasses();
}

// --- Tab switcher ---
function initSidebar() {
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebarCollapsed = localStorage.getItem('teacher_sidebar_collapsed') === '1';
  const updateSidebarToggle = (collapsed) => {
    if (!sidebarToggle) return;
    sidebarToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    sidebarToggle.setAttribute('aria-label', collapsed ? 'Agrandir le menu' : 'Reduire le menu');
    sidebarToggle.title = collapsed ? 'Agrandir le menu' : 'Reduire le menu';
    sidebarToggle.textContent = collapsed ? '>' : '<';
  };
  gameApp.classList.toggle('sidebar-collapsed', sidebarCollapsed);
  updateSidebarToggle(sidebarCollapsed);

  if (sidebarToggle && !sidebarToggle.dataset.ready) {
    sidebarToggle.dataset.ready = '1';
    sidebarToggle.addEventListener('click', () => {
      const collapsed = !gameApp.classList.contains('sidebar-collapsed');
      gameApp.classList.toggle('sidebar-collapsed', collapsed);
      updateSidebarToggle(collapsed);
      localStorage.setItem('teacher_sidebar_collapsed', collapsed ? '1' : '0');
    });
  }

  document.querySelectorAll('.menu-item').forEach(item => {
    const shortLabels = {
      dashboard: 'TB',
      classes: 'CL',
      lessons: 'LE',
      evaluations: 'EV',
      questions: 'Q',
      results: 'R'
    };
    item.dataset.short = shortLabels[item.dataset.tab] || item.textContent.trim().slice(0, 2).toUpperCase();
    if (item.dataset.ready) return;
    item.dataset.ready = '1';
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
      } else if (tab === 'lessons') {
        fetchWorldsList('lesson');
        fetchLessonWorldDropdowns();
      } else if (tab === 'evaluations') {
        fetchWorldsList('eval');
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
      feedback.textContent = 'Erreur : ' + (data.error || 'Identifiants invalides');
      feedback.style.color = '#ef4444';
    }
  } catch (err) { 
    feedback.textContent = 'Erreur de connexion au serveur'; 
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
      feedback.textContent = 'Compte cree ! Connectez-vous.';
      feedback.style.color = '#10b981';
      document.getElementById('btn-show-login').click();
    } else {
      feedback.textContent = 'Erreur : ' + (data.error || 'Erreur d\'inscription');
      feedback.style.color = '#ef4444';
    }
  } catch (err) { 
    feedback.textContent = 'Erreur de connexion au serveur'; 
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
      else if (activeTab === 'lessons') { fetchWorldsList('lesson'); fetchLessonWorldDropdowns(); }
      else if (activeTab === 'evaluations') fetchWorldsList('eval');
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
  else if (activeTab === 'lessons') { fetchWorldsList('lesson'); fetchLessonWorldDropdowns(); }
  else if (activeTab === 'evaluations') fetchWorldsList('eval');
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
      alert("Erreur : " + (data.error || "Action impossible"));
    }
  } catch (err) {
    alert("Erreur de communication avec le serveur.");
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
          <button class="btn btn-secondary btn-sm" onclick="editClass(${c.id}, '${c.name}', '${c.code}', '${c.subject}', '${c.grade}')">Modifier</button>
          <button class="btn btn-danger btn-sm" onclick="deleteClass(${c.id})">Supprimer</button>
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

// --- World / Activity Management (Lecons & Evaluations separees) ---
const worldModal = document.getElementById('world-modal');
const btnCreateLessonModal = document.getElementById('btn-create-lesson-modal');
const btnCreateEvalModal = document.getElementById('btn-create-eval-modal');
const btnCloseWorldModal = document.getElementById('btn-close-world-modal');
const worldForm = document.getElementById('world-form');

function openWorldModal(mode) {
  const isLesson = mode === 'lesson';
  document.getElementById('world-modal-title').textContent = isLesson ? 'Nouvelle lecon' : 'Nouvelle evaluation';
  document.getElementById('modal-world-id').value = '';
  document.getElementById('world-name-input').value = '';
  document.getElementById('world-topic-input').value = '';
  document.getElementById('world-subject-input').value = 'Mathematiques';
  document.getElementById('world-mode-input').value = mode;
  worldModal.classList.remove('hidden');
}

if (btnCreateLessonModal) btnCreateLessonModal.onclick = () => openWorldModal('lesson');
if (btnCreateEvalModal) btnCreateEvalModal.onclick = () => openWorldModal('eval');

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
      const mode = document.getElementById('world-mode-input').value;
      await fetchWorldsList(mode);
    }
  } catch (err) { console.error(err); }
};

async function fetchWorldsList(modeFilter) {
  if (!currentClassId) return;
  try {
    const res = await fetch(`${API}/classes/${currentClassId}/worlds`);
    const worlds = await res.json();
    const filtered = worlds.filter(w => w.mode === modeFilter);
    const tbodyId = modeFilter === 'lesson' ? 'lessons-list-body' : 'evaluations-list-body';
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = filtered.map(w => `
      <tr>
        <td><strong>${w.name}</strong></td>
        <td>${w.topic}</td>
        <td>${w.subject}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editWorld(${w.id}, '${w.name.replace(/'/g, "\\'")}', '${w.topic.replace(/'/g, "\\'")}', '${w.subject.replace(/'/g, "\\'")}', '${w.mode}')">Modifier</button>
          <button class="btn btn-danger btn-sm" onclick="deleteWorld(${w.id})">Supprimer</button>
        </td>
      </tr>
    `).join('') || `<tr><td colspan="4" class="text-center">Aucune ${modeFilter === 'lesson' ? 'lecon' : 'evaluation'}.</td></tr>`;
  } catch (err) { console.error(err); }
}

window.editWorld = (id, name, topic, subject, mode) => {
  document.getElementById('world-modal-title').textContent = mode === 'lesson' ? 'Modifier la lecon' : 'Modifier l\'evaluation';
  document.getElementById('modal-world-id').value = id;
  document.getElementById('world-name-input').value = name;
  document.getElementById('world-topic-input').value = topic;
  document.getElementById('world-subject-input').value = subject;
  document.getElementById('world-mode-input').value = mode;
  worldModal.classList.remove('hidden');
};

window.deleteWorld = async (id) => {
  if (!confirm("Supprimer cette activite ? Les questions liees seront aussi supprimees.")) return;
  try {
    const res = await fetch(`${API}/worlds/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchWorldsList('lesson');
      await fetchWorldsList('eval');
    }
  } catch (err) { console.error(err); }
};

// --- Lesson Fragments ---
function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildBloomChecks(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = BLOOM_LEVELS.map((b, i) => `
    <label class="ai-bloom-check">
      <input type="checkbox" value="${b.key}" class="${containerId}-input" ${i < 4 ? 'checked' : ''}>
      <span>${b.label}</span>
    </label>
  `).join('');
}

async function fetchLessonWorldDropdowns() {
  if (!currentClassId) return;
  try {
    const res = await fetch(`${API}/classes/${currentClassId}/worlds`);
    const worlds = await res.json();
    const lessons = worlds.filter(w => w.mode === 'lesson');
    const options = lessons.map(w => `<option value="${w.id}" data-subject="${escapeHtml(w.subject)}" data-topic="${escapeHtml(w.topic)}">${escapeHtml(w.name)} — ${escapeHtml(w.topic)}</option>`).join('');
    ['lf-world', 'lesson-ai-world'].forEach(id => {
      const select = document.getElementById(id);
      if (!select) return;
      const previous = select.value;
      select.innerHTML = options || '<option value="">Creez une lecon d\'abord</option>';
      if ([...select.options].some(o => o.value === previous)) select.value = previous;
    });
    await fetchLessonFragments();
  } catch (err) { console.error(err); }
}

async function fetchLessonFragments() {
  const worldId = document.getElementById('lf-world')?.value;
  if (!worldId) {
    const list = document.getElementById('lesson-fragments-list');
    if (list) list.innerHTML = '<p class="text-center">Selectionnez ou creez une lecon.</p>';
    const count = document.getElementById('lf-count');
    if (count) count.textContent = '0';
    return;
  }
  try {
    const res = await fetch(`${API}/worlds/${worldId}/lesson-fragments`);
    const fragments = await res.json();
    const count = document.getElementById('lf-count');
    if (count) count.textContent = fragments.length;
    const list = document.getElementById('lesson-fragments-list');
    if (!list) return;
    list.innerHTML = fragments.map(f => `
      <article class="lesson-fragment-card">
        ${f.image_data ? `<div class="lesson-fragment-thumb">${f.image_data.startsWith('data:image') ? `<img src="${f.image_data}" alt="">` : escapeHtml(f.image_data)}</div>` : ''}
        <div class="lesson-fragment-main">
          <div class="lesson-fragment-meta">Fragment ${f.order_index} • ${escapeHtml(f.bloom_level)}</div>
          <h4>${escapeHtml(f.title)}</h4>
          <p>${escapeHtml(f.content)}</p>
          <strong>Test :</strong> ${escapeHtml(f.check_question?.question || '')}
        </div>
        <button type="button" class="btn btn-danger btn-sm" onclick="deleteLessonFragment(${f.id})">Suppr.</button>
      </article>
    `).join('') || '<p class="text-center">Aucun fragment pour cette lecon.</p>';
  } catch (err) { console.error(err); }
}

function resetLessonFragmentForm() {
  ['lf-title', 'lf-content', 'lf-question', 'lf-a', 'lf-b', 'lf-c', 'lf-d', 'lf-explanation'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('lf-order').value = '1';
  document.getElementById('lf-bloom').value = 'comprehension';
  document.getElementById('lf-correct').value = 'A';
  document.getElementById('lf-time').value = '20';
  document.getElementById('lf-xp').value = '50';
  document.getElementById('lf-image').value = '';
  document.getElementById('lf-image-preview')?.classList.add('hidden');
  lessonFragmentImageData = '';
}

function initLessonFragments() {
  const form = document.getElementById('lesson-fragment-form');
  if (!form || form.dataset.ready) return;
  form.dataset.ready = '1';

  document.getElementById('lf-world')?.addEventListener('change', fetchLessonFragments);
  document.getElementById('btn-reset-lesson-fragment')?.addEventListener('click', resetLessonFragmentForm);
  document.getElementById('lf-image')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    const preview = document.getElementById('lf-image-preview');
    lessonFragmentImageData = '';
    if (!file) {
      preview?.classList.add('hidden');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      lessonFragmentImageData = reader.result;
      if (preview) {
        preview.innerHTML = `<img src="${lessonFragmentImageData}" alt="">`;
        preview.classList.remove('hidden');
      }
    };
    reader.readAsDataURL(file);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const worldSelect = document.getElementById('lf-world');
    const worldId = worldSelect.value;
    if (!worldId) return alert('Creez ou selectionnez une lecon.');

    const payload = {
      class_id: parseInt(currentClassId),
      world_id: parseInt(worldId),
      subject: worldSelect.selectedOptions[0]?.dataset.subject || 'Lecon',
      topic: worldSelect.selectedOptions[0]?.dataset.topic || document.getElementById('lf-title').value,
      order_index: parseInt(document.getElementById('lf-order').value) || 1,
      title: document.getElementById('lf-title').value,
      content: document.getElementById('lf-content').value,
      image_data: lessonFragmentImageData,
      bloom_level: document.getElementById('lf-bloom').value,
      question: {
        type: 'qcm',
        question: document.getElementById('lf-question').value,
        answer_a: document.getElementById('lf-a').value,
        answer_b: document.getElementById('lf-b').value,
        answer_c: document.getElementById('lf-c').value,
        answer_d: document.getElementById('lf-d').value,
        correct_answer: document.getElementById('lf-correct').value,
        explanation: document.getElementById('lf-explanation').value,
        points: 1,
        time_limit: parseInt(document.getElementById('lf-time').value) || 20,
        xp_reward: parseInt(document.getElementById('lf-xp').value) || 50,
      }
    };

    const feedback = document.getElementById('lf-feedback');
    feedback.textContent = 'Enregistrement du fragment...';
    try {
      const res = await fetch(`${API}/lesson-fragments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Erreur de validation');
      feedback.textContent = 'Fragment ajoute.';
      feedback.className = 'feedback-msg feedback-success';
      resetLessonFragmentForm();
      await fetchLessonFragments();
    } catch (err) {
      feedback.textContent = 'Erreur lors de l\'enregistrement.';
      feedback.className = 'feedback-msg feedback-error';
    }
  });
}

window.deleteLessonFragment = async (id) => {
  if (!confirm('Supprimer ce fragment et sa question de verification ?')) return;
  try {
    const res = await fetch(`${API}/lesson-fragments/${id}`, { method: 'DELETE' });
    if (res.ok) await fetchLessonFragments();
  } catch (err) { console.error(err); }
};

function initLessonAiModal() {
  if (lessonAiInitialized) return;
  lessonAiInitialized = true;
  buildBloomChecks('lesson-ai-bloom-checks');

  document.getElementById('btn-open-lesson-ai-modal')?.addEventListener('click', async () => {
    await fetchLessonWorldDropdowns();
    showLessonAiConfig();
    document.getElementById('lesson-ai-modal')?.classList.remove('hidden');
  });
  document.getElementById('btn-close-lesson-ai-modal')?.addEventListener('click', () => {
    document.getElementById('lesson-ai-modal')?.classList.add('hidden');
  });
  document.getElementById('btn-lesson-ai-back')?.addEventListener('click', showLessonAiConfig);
  document.getElementById('btn-lesson-ai-generate')?.addEventListener('click', generateLessonFragmentsPreview);
  document.getElementById('btn-lesson-ai-import')?.addEventListener('click', importLessonFragmentsPreview);
}

function showLessonAiConfig() {
  document.getElementById('lesson-ai-config')?.classList.remove('hidden');
  document.getElementById('lesson-ai-preview-section')?.classList.add('hidden');
  document.getElementById('lesson-ai-loading')?.classList.add('hidden');
}

function getLessonAiBloomLevels() {
  return [...document.querySelectorAll('#lesson-ai-bloom-checks input:checked')].map(el => el.value);
}

function renderLessonAiPreview() {
  const list = document.getElementById('lesson-ai-preview-list');
  const count = document.getElementById('lesson-ai-preview-count');
  if (count) count.textContent = lessonAiPreview.length;
  if (!list) return;
  list.innerHTML = lessonAiPreview.map((f, idx) => `
    <article class="ai-preview-card lesson-preview-card">
      <div class="ai-preview-badge">Fragment ${idx + 1} • ${escapeHtml(f.bloom_level || 'comprehension')}</div>
      <h4>${escapeHtml(f.title || `Fragment ${idx + 1}`)}</h4>
      <p>${escapeHtml(f.content || '')}</p>
      ${f.image_data ? `<div class="lesson-image-suggestion">${escapeHtml(f.image_data)}</div>` : ''}
      <div class="ai-preview-answers">
        <strong>Question :</strong> ${escapeHtml(f.question?.question || '')}<br>
        A. ${escapeHtml(f.question?.answer_a || '')}<br>
        B. ${escapeHtml(f.question?.answer_b || '')}<br>
        C. ${escapeHtml(f.question?.answer_c || '')}<br>
        D. ${escapeHtml(f.question?.answer_d || '')}<br>
        <strong>Bonne reponse :</strong> ${escapeHtml(f.question?.correct_answer || 'A')}
      </div>
    </article>
  `).join('');
}

async function generateLessonFragmentsPreview() {
  const worldId = document.getElementById('lesson-ai-world')?.value;
  const context = document.getElementById('lesson-ai-context')?.value.trim();
  const file = document.getElementById('lesson-ai-file')?.files?.[0];
  const feedback = document.getElementById('lesson-ai-feedback');
  if (!worldId) {
    feedback.textContent = 'Selectionnez une lecon cible.';
    feedback.className = 'ai-feedback ai-feedback-error';
    return;
  }
  if (!context && !file) {
    feedback.textContent = 'Ajoutez un contenu ou un support.';
    feedback.className = 'ai-feedback ai-feedback-error';
    return;
  }

  const formData = new FormData();
  formData.append('context', context || '');
  formData.append('num_fragments', document.getElementById('lesson-ai-count')?.value || '4');
  formData.append('bloom_levels', JSON.stringify(getLessonAiBloomLevels()));
  formData.append('chat_context', document.getElementById('lesson-ai-instructions')?.value || '');
  if (file) formData.append('file', file);

  document.getElementById('lesson-ai-loading')?.classList.remove('hidden');
  feedback.textContent = '';
  try {
    const res = await fetch(`${API}/ai/lesson-generate-preview`, { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Generation impossible');
    lessonAiPreview = data.fragments || [];
    renderLessonAiPreview();
    document.getElementById('lesson-ai-config')?.classList.add('hidden');
    document.getElementById('lesson-ai-preview-section')?.classList.remove('hidden');
  } catch (err) {
    feedback.textContent = err.message;
    feedback.className = 'ai-feedback ai-feedback-error';
  } finally {
    document.getElementById('lesson-ai-loading')?.classList.add('hidden');
  }
}

async function importLessonFragmentsPreview() {
  const select = document.getElementById('lesson-ai-world');
  const worldId = select?.value;
  const feedback = document.getElementById('lesson-ai-import-feedback');
  if (!worldId || !lessonAiPreview.length) return;
  const payload = {
    class_id: parseInt(currentClassId),
    world_id: parseInt(worldId),
    subject: select.selectedOptions[0]?.dataset.subject || 'Lecon',
    topic: select.selectedOptions[0]?.dataset.topic || 'Lecon',
    fragments: lessonAiPreview
  };
  feedback.textContent = 'Import des fragments...';
  try {
    const res = await fetch(`${API}/lesson-fragments/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Import impossible');
    feedback.textContent = data.message || 'Fragments importes.';
    feedback.className = 'ai-feedback ai-feedback-success';
    document.getElementById('lf-world').value = worldId;
    await fetchLessonFragments();
  } catch (err) {
    feedback.textContent = err.message;
    feedback.className = 'ai-feedback ai-feedback-error';
  }
}

// --- Question Builder / 7 Types ---

const TYPE_HELP = {
  qcm: '',
  tf: '',
  short_answer: '',
  matching: 'Ajoutez des paires à associer ci-dessous.',
  dragdrop_text: 'Utilisez {slot0}, {slot1}… dans l\'énoncé pour les emplacements.',
  dragdrop_image: 'Placez des étiquettes sur l\'image via les emplacements X/Y (%).',
  missing_words: 'Utilisez {select0}, {select1}… dans l\'énoncé pour les menus déroulants.',
};

function addMatchingPairRow(left = '', right = '') {
  const list = document.getElementById('matching-pairs-list');
  if (!list) return;
  const row = document.createElement('div');
  row.className = 'matching-pair-row';
  row.innerHTML = `
    <input type="text" class="match-left" value="${left}" placeholder="Gauche" required>
    <input type="text" class="match-right" value="${right}" placeholder="Droite" required>
    <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">✕</button>
  `;
  list.appendChild(row);
}

function addDdiSlotRow(x = 50, y = 50, label = '') {
  const list = document.getElementById('ddi-targets-list');
  if (!list) return;
  const row = document.createElement('div');
  row.className = 'ddi-target-row';
  row.innerHTML = `
    <input type="number" class="ddi-x" value="${x}" placeholder="X %" min="0" max="100" style="width:70px;" required>
    <input type="number" class="ddi-y" value="${y}" placeholder="Y %" min="0" max="100" style="width:70px;" required>
    <input type="text" class="ddi-label" value="${label}" placeholder="Étiquette" required>
    <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">✕</button>
  `;
  list.appendChild(row);
}

function addMissingWordRow(options = '', correct = '') {
  const list = document.getElementById('missing-words-list');
  if (!list) return;
  const idx = list.children.length;
  const row = document.createElement('div');
  row.className = 'mw-select-row';
  row.innerHTML = `
    <span style="font-size:12px; font-weight:bold; min-width:60px;">select${idx} :</span>
    <input type="text" class="mw-options" value="${options}" placeholder="Choix (virgules)" style="flex:1;" required>
    <input type="text" class="mw-correct" value="${correct}" placeholder="Correct" style="width:120px;" required>
    <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">✕</button>
  `;
  list.appendChild(row);
}

function initQuestionBuilder() {
  const qType = document.getElementById('q-type');
  const qTextHelp = document.getElementById('q-text-help');
  if (!qType) return;

  qType.addEventListener('change', () => {
    document.querySelectorAll('.q-type-fields').forEach(f => f.classList.add('hidden'));
    const targetFields = document.getElementById(`fields-${qType.value}`);
    if (targetFields) targetFields.classList.remove('hidden');
    if (qTextHelp) {
      const help = TYPE_HELP[qType.value];
      if (help) {
        qTextHelp.textContent = help;
        qTextHelp.classList.remove('hidden');
      } else {
        qTextHelp.classList.add('hidden');
      }
    }
  });

  document.getElementById('btn-add-matching')?.addEventListener('click', () => addMatchingPairRow());
  document.getElementById('btn-add-ddi-slot')?.addEventListener('click', () => addDdiSlotRow());
  document.getElementById('btn-add-mw')?.addEventListener('click', () => addMissingWordRow());

  const ddiImage = document.getElementById('q-ddi-image');
  const ddiCustomWrap = document.getElementById('q-ddi-custom-wrap');
  if (ddiImage && ddiCustomWrap) {
    ddiImage.addEventListener('change', () => {
      ddiCustomWrap.classList.toggle('hidden', ddiImage.value !== 'custom');
    });
  }
}

async function fetchWorldsDropdown() {
  if (!currentClassId) return;
  try {
    const res = await fetch(`${API}/classes/${currentClassId}/worlds`);
    const worlds = await res.json();
    const dropdown = document.getElementById('q-world');
    dropdown.innerHTML = worlds.map(w => {
      const label = w.mode === 'eval' ? 'Eval' : 'Lecon';
      return `<option value="${w.id}">[${label}] ${w.name} — ${w.topic}</option>`;
    }).join('') || '<option value="">Creer une activite d\'abord</option>';
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
    points: parseInt(document.getElementById('q-points').value) || 1,
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
      feedback.textContent = 'Question enregistree !';
      feedback.className = 'feedback-msg feedback-success';
      resetQuestionForm();
      await fetchQuestionsList();
    } else {
      feedback.textContent = 'Erreur de validation';
      feedback.className = 'feedback-msg feedback-error';
    }
  } catch (err) {
    feedback.textContent = 'Erreur de connexion';
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
  document.getElementById('q-points').value = "1";
  document.getElementById('btn-save-question').textContent = "ENREGISTRER";
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
        <td><span style="background:rgba(255,255,255,0.08); padding:3px 6px; border-radius:4px; font-size:12px;">${(q.type || '').toUpperCase()}</span></td>
        <td><strong>${q.points ?? 1}</strong> pt</td>
        <td>Monde ${q.world_id || '—'}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editQuestion(${JSON.stringify(q).replace(/"/g, '&quot;')})">Modifier</button>
          <button class="btn btn-danger btn-sm" onclick="deleteQuestion(${q.id})">Suppr.</button>
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
  document.getElementById('q-points').value = q.points ?? 1;
  document.getElementById('q-xp').value = q.xp_reward;
  document.getElementById('q-timer').value = q.time_limit || 15;
  document.getElementById('q-text').value = q.question;
  document.getElementById('q-explanation').value = q.explanation || "";

  document.getElementById('btn-save-question').textContent = "METTRE A JOUR";

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

// --- CSV Import (optional UI) ---
const btnDoImport = document.getElementById('btn-do-import');
if (btnDoImport) btnDoImport.onclick = async () => {
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


// ─── GÉNÉRATEUR IA (modal intégré à la banque) ───────────────────────────────────

function initAiGeneratorModal() {
  if (aiModalInitialized) return;
  aiModalInitialized = true;

  buildAiTypeCountsUI();
  buildAiBloomChecksUI();
  updateAiTotalCount();

  document.getElementById('btn-open-ai-modal')?.addEventListener('click', openAiModal);
  document.getElementById('btn-close-ai-modal')?.addEventListener('click', closeAiModal);
  document.getElementById('btn-ai-modal-generate')?.addEventListener('click', generateQuestionsPreview);
  document.getElementById('btn-ai-import')?.addEventListener('click', importGeneratedQuestions);
  document.getElementById('btn-ai-back-config')?.addEventListener('click', showAiConfigPanel);
  document.getElementById('btn-ai-chat-send')?.addEventListener('click', sendAiChatMessage);
  document.getElementById('ai-chat-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendAiChatMessage();
  });

  document.querySelectorAll('#ai-type-counts input').forEach(input => {
    input.addEventListener('input', updateAiTotalCount);
  });

  appendAiChatMessage('assistant', 'Bonjour ! Je peux vous aider à affiner vos consignes avant la génération. Décrivez le niveau de vos élèves ou le type d\'évaluation souhaité.');
}

function buildAiTypeCountsUI() {
  const container = document.getElementById('ai-type-counts');
  if (!container) return;
  container.innerHTML = QUESTION_TYPES.map(t => `
    <label class="ai-type-count-row">
      <span>${t.label}</span>
      <input type="number" min="0" max="100" value="0" data-type="${t.apiKey}" class="ai-type-count-input">
    </label>
  `).join('');
}

function buildAiBloomChecksUI() {
  const container = document.getElementById('ai-bloom-checks');
  if (!container) return;
  container.innerHTML = BLOOM_LEVELS.map((b, i) => `
    <label class="ai-bloom-check">
      <input type="checkbox" value="${b.key}" class="ai-bloom-check-input" ${i < 4 ? 'checked' : ''}>
      <span>${b.label}</span>
    </label>
  `).join('');
}

function updateAiTotalCount() {
  const total = [...document.querySelectorAll('#ai-type-counts input')].reduce((sum, el) => sum + (parseInt(el.value) || 0), 0);
  const badge = document.getElementById('ai-total-count');
  if (badge) badge.textContent = `Total : ${total} question${total > 1 ? 's' : ''}`;
}

async function loadAiModalWorlds() {
  if (!currentClassId) return;
  try {
    const res = await fetch(`${API}/classes/${currentClassId}/worlds`);
    const worlds = await res.json();
    const dropdown = document.getElementById('ai-modal-world');
    if (!dropdown) return;
    dropdown.innerHTML = worlds.map(w => {
      const label = w.mode === 'eval' ? 'Eval' : 'Leçon';
      return `<option value="${w.id}">[${label}] ${w.name} — ${w.topic}</option>`;
    }).join('') || '<option value="">Créer une activité d\'abord</option>';
  } catch (err) { console.error(err); }
}

function openAiModal() {
  if (!currentClassId) {
    alert('Sélectionnez une classe dans le menu en haut.');
    return;
  }
  loadAiModalWorlds();
  showAiConfigPanel();
  document.getElementById('ai-gen-modal')?.classList.remove('hidden');
}

function closeAiModal() {
  document.getElementById('ai-gen-modal')?.classList.add('hidden');
}

function showAiConfigPanel() {
  document.getElementById('ai-gen-config')?.classList.remove('hidden');
  document.getElementById('ai-preview-section')?.classList.add('hidden');
  document.getElementById('ai-gen-loading')?.classList.add('hidden');
}

function appendAiChatMessage(role, content) {
  aiChatHistory.push({ role, content });
  const box = document.getElementById('ai-chat-messages');
  if (!box) return;
  const div = document.createElement('div');
  div.className = `ai-chat-msg ${role}`;
  div.textContent = content;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

async function sendAiChatMessage() {
  const input = document.getElementById('ai-chat-input');
  const message = input?.value.trim();
  if (!message) return;

  appendAiChatMessage('user', message);
  input.value = '';

  try {
    const res = await fetch(`${API}/ai/teacher-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history: aiChatHistory.slice(0, -1),
        lesson_context: document.getElementById('ai-modal-context')?.value || ''
      })
    });
    const data = await res.json();
    if (res.ok) {
      appendAiChatMessage('assistant', data.reply);
    } else {
      appendAiChatMessage('assistant', 'Erreur : ' + (data.error || 'Impossible de contacter le service'));
    }
  } catch (err) {
    appendAiChatMessage('assistant', 'Erreur de connexion au serveur.');
  }
}

function getSelectedBloomLevels() {
  return [...document.querySelectorAll('.ai-bloom-check-input:checked')].map(el => el.value);
}

function getTypeCountsMap() {
  const map = {};
  document.querySelectorAll('#ai-type-counts input').forEach(el => {
    const count = parseInt(el.value) || 0;
    if (count > 0) map[el.dataset.type] = count;
  });
  return map;
}

function formatQuestionPreviewAnswers(q) {
  const type = q.type || 'qcm';
  if (type === 'qcm') {
    return `<div>A) ${q.answer_a || '—'}</div><div>B) ${q.answer_b || '—'}</div><div>C) ${q.answer_c || '—'}</div><div>D) ${q.answer_d || '—'}</div><div><strong>Bonne réponse :</strong> ${q.correct_answer}</div>`;
  }
  if (type === 'tf' || type === 'short_answer') {
    return `<div><strong>Réponse :</strong> ${q.correct_answer}</div>`;
  }
  let extra = q.extra_data;
  if (typeof extra === 'string') {
    try { extra = JSON.parse(extra); } catch (e) { extra = {}; }
  }
  if (type === 'matching') {
    const pairs = extra?.pairs || {};
    return Object.keys(pairs).map(k => `<div>${k} → ${pairs[k]}</div>`).join('') || `<div>${JSON.stringify(extra)}</div>`;
  }
  if (type === 'dragdrop_text') {
    return `<div><strong>Choix :</strong> ${(extra?.choices || []).join(', ')}</div><div><strong>Ordre :</strong> ${(extra?.correct || q.correct_answer || '').toString()}</div>`;
  }
  if (type === 'dragdrop_image') {
    return `<div><strong>Image :</strong> ${extra?.image || '—'}</div><div><strong>Étiquettes :</strong> ${(extra?.labels || []).join(', ')}</div>`;
  }
  if (type === 'missing_words') {
    return `<div><strong>Réponses :</strong> ${(extra?.correct || q.correct_answer || '').toString()}</div>`;
  }
  return `<div>${q.correct_answer || ''}</div>`;
}

function renderAiPreview() {
  const list = document.getElementById('ai-preview-list');
  const countEl = document.getElementById('ai-preview-count');
  if (!list) return;

  countEl.textContent = aiGeneratedPreview.length;
  list.innerHTML = aiGeneratedPreview.map((q, idx) => {
    const typeLabel = QUESTION_TYPES.find(t => t.key === q.type || t.apiKey === q.type)?.label || q.type;
    return `
      <div class="ai-preview-card" data-idx="${idx}">
        <div class="ai-preview-card-header">
          <span class="ai-preview-badge">${typeLabel}</span>
          <span class="ai-preview-badge">${BLOOM_LEVELS.find(b => b.key === q.bloom_level)?.label || q.bloom_level}</span>
          <label class="ai-preview-points">
            Points :
            <input type="number" min="1" max="100" value="${q.points || 1}" data-preview-points="${idx}">
          </label>
        </div>
        <p><strong>${q.question}</strong></p>
        <div class="ai-preview-answers">${formatQuestionPreviewAnswers(q)}</div>
        ${q.explanation ? `<p class="ai-preview-answers" style="margin-top:8px;"><strong>Indication :</strong> ${q.explanation}</p>` : ''}
      </div>
    `;
  }).join('');

  list.querySelectorAll('[data-preview-points]').forEach(input => {
    input.addEventListener('change', () => {
      const idx = parseInt(input.dataset.previewPoints);
      aiGeneratedPreview[idx].points = parseInt(input.value) || 1;
    });
  });
}

async function generateQuestionsPreview() {
  const worldId = document.getElementById('ai-modal-world')?.value;
  const context = document.getElementById('ai-modal-context')?.value.trim() || '';
  const fileInput = document.getElementById('ai-modal-file');
  const feedback = document.getElementById('ai-modal-feedback');
  const typeCounts = getTypeCountsMap();
  const bloomLevels = getSelectedBloomLevels();
  const total = Object.values(typeCounts).reduce((a, b) => a + b, 0);

  if (!worldId) {
    feedback.textContent = '⚠️ Sélectionnez une activité cible.';
    feedback.className = 'ai-feedback ai-feedback-error';
    return;
  }
  if (total <= 0) {
    feedback.textContent = '⚠️ Indiquez au moins une question par type.';
    feedback.className = 'ai-feedback ai-feedback-error';
    return;
  }
  if (!bloomLevels.length) {
    feedback.textContent = '⚠️ Sélectionnez au moins un niveau Bloom.';
    feedback.className = 'ai-feedback ai-feedback-error';
    return;
  }
  if (!context && (!fileInput?.files || !fileInput.files.length)) {
    feedback.textContent = '⚠️ Fournissez un contenu de leçon ou un fichier.';
    feedback.className = 'ai-feedback ai-feedback-error';
    return;
  }

  const chatContext = aiChatHistory.map(m => `${m.role}: ${m.content}`).join('\n');
  const formData = new FormData();
  formData.append('context', context);
  formData.append('type_counts', JSON.stringify(typeCounts));
  formData.append('bloom_levels', JSON.stringify(bloomLevels));
  formData.append('chat_context', chatContext);
  if (fileInput?.files?.[0]) formData.append('file', fileInput.files[0]);

  document.getElementById('ai-gen-config')?.classList.add('hidden');
  document.getElementById('ai-preview-section')?.classList.add('hidden');
  document.getElementById('ai-gen-loading')?.classList.remove('hidden');
  feedback.textContent = '';

  try {
    const res = await fetch(`${API}/ai/generate-preview`, { method: 'POST', body: formData });
    const data = await res.json();
    document.getElementById('ai-gen-loading')?.classList.add('hidden');

    if (res.ok) {
      aiGeneratedPreview = data.questions || [];
      renderAiPreview();
      document.getElementById('ai-preview-section')?.classList.remove('hidden');
      if (data.warnings?.length) {
        feedback.textContent = '⚠️ ' + data.warnings.join(' | ');
        feedback.className = 'ai-feedback ai-feedback-error';
      }
    } else {
      showAiConfigPanel();
      feedback.textContent = '❌ ' + (data.error || 'Erreur lors de la génération');
      feedback.className = 'ai-feedback ai-feedback-error';
    }
  } catch (err) {
    document.getElementById('ai-gen-loading')?.classList.add('hidden');
    showAiConfigPanel();
    feedback.textContent = '❌ Erreur de connexion au serveur.';
    feedback.className = 'ai-feedback ai-feedback-error';
  }
}

async function importGeneratedQuestions() {
  const worldId = document.getElementById('ai-modal-world')?.value;
  const feedback = document.getElementById('ai-import-feedback');
  const btn = document.getElementById('btn-ai-import');

  if (!aiGeneratedPreview.length) return;

  btn.disabled = true;
  feedback.textContent = 'Chargement en cours…';
  feedback.className = 'ai-feedback';

  try {
    const res = await fetch(`${API}/questions/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        class_id: parseInt(currentClassId),
        world_id: parseInt(worldId),
        questions: aiGeneratedPreview
      })
    });
    const data = await res.json();
    if (res.ok) {
      feedback.textContent = `✅ ${data.count} question(s) chargée(s) dans la banque !`;
      feedback.className = 'ai-feedback ai-feedback-success';
      await fetchQuestionsList();
      setTimeout(() => closeAiModal(), 1500);
    } else {
      feedback.textContent = '❌ ' + (data.error || 'Erreur lors du chargement');
      feedback.className = 'ai-feedback ai-feedback-error';
    }
  } catch (err) {
    feedback.textContent = '❌ Erreur de connexion.';
    feedback.className = 'ai-feedback ai-feedback-error';
  } finally {
    btn.disabled = false;
  }
}

/**
 * Simple Markdown renderer (bold, headers, lists, line breaks)
 */
function renderMarkdown(text) {
  return text
    .replace(/^### (.+)$/gm, '<h4 class="ai-h">$1</h4>')
    .replace(/^## (.+)$/gm,  '<h3 class="ai-h">$1</h3>')
    .replace(/^# (.+)$/gm,   '<h2 class="ai-h">$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g,    '<em>$1</em>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*?<\/li>\n?)+/gs, match => `<ul>${match}</ul>`)
    .replace(/\n{2,}/g, '</p><p class="ai-p">')
    .replace(/\n/g, '<br>')
    .replace(/^(.+)$/, '<p class="ai-p">$1</p>');
}
