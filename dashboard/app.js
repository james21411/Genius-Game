const API = 'http://localhost:5001/api';

// --- State Management ---
let currentTeacherId = localStorage.getItem('teacher_id');
let currentClassId = null;

// --- DOM Elements ---
const authOverlay = document.getElementById('auth-overlay');
const gameApp = document.getElementById('game-app');
const classSelect = document.getElementById('class-select');
const characterSelect = document.getElementById('character-select');
const teacherNameSpan = document.getElementById('teacher-name');
const navClassCode = document.getElementById('nav-class-code');

// --- Initialization ---
const savedCharacter = localStorage.getItem('selectedCharacter') || 'duthant';
if (characterSelect) {
    characterSelect.value = savedCharacter;
    characterSelect.addEventListener('change', (e) => {
        localStorage.setItem('selectedCharacter', e.target.value);
    });
}

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
    teacherNameSpan.textContent = localStorage.getItem('teacher_name') || 'MAÎTRE';
    await fetchClasses();
}

async function fetchWorlds() {
    if (!currentClassId) return;
    try {
        const res = await fetch(`${API}/classes/${currentClassId}/worlds`);
        const worlds = await res.json();
        const worldSelect = document.getElementById('q-world');
        
        // On garde une option "Tous les chapitres" pour la vue bibliothèque
        let options = '<option value="">-- Tous les Chapitres --</option>';
        options += worlds.map(w => `<option value="${w.id}">${w.name} (${w.topic})</option>`).join('');
        worldSelect.innerHTML = options;
        
        fetchQuestionsList(); // Rafraîchir la liste quand les mondes changent
    } catch (err) {
        console.error("Erreur mondes:", err);
    }
}

// Listener pour le changement de chapitre
document.getElementById('q-world').onchange = () => {
    fetchQuestionsList();
};

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
        } else feedback.textContent = '❌ ' + (data.error || 'Erreur');
    } catch (err) { feedback.textContent = '❌ Erreur de connexion'; }
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
            document.getElementById('btn-show-login').click();
        } else feedback.textContent = '❌ ' + (data.error || 'Erreur');
    } catch (err) { feedback.textContent = '❌ Erreur de connexion'; }
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
            fetchStats();
            fetchWorlds();
            fetchQuestionsList();
        } else classSelect.innerHTML = '<option value="">Créer une classe...</option>';
    } catch (err) { console.error("Erreur classes:", err); }
}

classSelect.onchange = (e) => {
    currentClassId = e.target.value;
    updateClassDisplay();
    fetchStats();
    fetchWorlds();
    fetchQuestionsList();
};

function updateClassDisplay() {
    const selectedOption = classSelect.options[classSelect.selectedIndex];
    if (selectedOption) navClassCode.textContent = selectedOption.dataset.code;
}

document.getElementById('btn-new-class').onclick = async () => {
    const className = prompt("Nom de la nouvelle classe (ex: CM2-A) :");
    if (!className) return;
    try {
        const res = await fetch(`${API}/classes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teacher_id: currentTeacherId, name: className })
        });
        if (res.ok) {
            const data = await res.json();
            currentClassId = data.class_id;
            await fetchClasses();
        }
    } catch (err) { alert("Erreur lors de la création"); }
};

// --- World Management (Grimoire) ---
document.getElementById('btn-show-new-world').onclick = () => {
    document.getElementById('new-world-section').classList.toggle('hidden');
};

document.getElementById('btn-save-world').onclick = async () => {
    const name = document.getElementById('new-world-name').value;
    const topic = document.getElementById('new-world-topic').value;
    if (!name || !topic) return alert("Remplissez tous les champs !");

    try {
        const res = await fetch(`${API}/worlds`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ class_id: currentClassId, name, topic })
        });
        if (res.ok) {
            document.getElementById('new-world-section').classList.add('hidden');
            document.getElementById('new-world-name').value = '';
            document.getElementById('new-world-topic').value = '';
            await fetchWorlds();
        }
    } catch (err) { alert("Erreur"); }
};

// --- Tabs Management ---
document.getElementById('tab-add').onclick = () => {
    setActiveTab('tab-add');
    document.getElementById('add-q-container').classList.remove('hidden');
    document.getElementById('questions-list-container').classList.add('hidden');
    document.getElementById('import-section').classList.add('hidden');
    document.getElementById('ai-section').classList.add('hidden');
};

document.getElementById('tab-list').onclick = () => {
    setActiveTab('tab-list');
    document.getElementById('add-q-container').classList.add('hidden');
    document.getElementById('questions-list-container').classList.remove('hidden');
    document.getElementById('import-section').classList.add('hidden');
    document.getElementById('ai-section').classList.add('hidden');
    fetchQuestionsList();
};

document.getElementById('tab-import').onclick = () => {
    setActiveTab('tab-import');
    document.getElementById('import-section').classList.remove('hidden');
    document.getElementById('add-q-container').classList.add('hidden');
    document.getElementById('questions-list-container').classList.add('hidden');
    document.getElementById('ai-section').classList.add('hidden');
};

document.getElementById('tab-ai').onclick = () => {
    setActiveTab('tab-ai');
    document.getElementById('ai-section').classList.remove('hidden');
    document.getElementById('add-q-container').classList.add('hidden');
    document.getElementById('questions-list-container').classList.add('hidden');
    document.getElementById('import-section').classList.add('hidden');
};

function setActiveTab(id) {
    ['tab-add', 'tab-list', 'tab-import', 'tab-ai'].forEach(tid => {
        document.getElementById(tid).classList.toggle('active', tid === id);
    });
}

document.getElementById('btn-ai-generate').onclick = async () => {
    const fileInput = document.getElementById('ai-file');
    const context = document.getElementById('ai-context').value;
    const num = document.getElementById('ai-num').value;
    const bloom = document.getElementById('ai-bloom').value;
    const worldId = document.getElementById('q-world').value;
    
    if (!fileInput.files[0] && !context) return alert("Fournissez un fichier ou du texte !");
    if (!worldId) return alert("Sélectionnez un chapitre !");

    const feedback = document.getElementById('ai-feedback');
    feedback.textContent = "🔮 Alchimie en cours (Analyse du support)...";

    const formData = new FormData();
    if (fileInput.files[0]) formData.append('file', fileInput.files[0]);
    formData.append('context', context);
    formData.append('num', num);
    formData.append('bloom', bloom);
    formData.append('class_id', currentClassId);
    formData.append('world_id', worldId);

    try {
        const res = await fetch(`${API}/ai/generate`, {
            method: 'POST',
            body: formData // On n'envoie pas de header Content-Type manuellement avec FormData
        });
        const data = await res.json();
        if (res.ok) {
            feedback.textContent = `✅ ${data.count} questions forgées avec succès !`;
            fetchQuestionsList();
        } else {
            feedback.textContent = "❌ " + (data.error || "Erreur d'alchimie");
        }
    } catch (err) {
        feedback.textContent = "❌ Erreur de connexion au sanctuaire IA";
    }
};

document.getElementById('q-type').onchange = (e) => {
    const isVF = e.target.value === 'vf';
    document.getElementById('q-ans-c').parentElement.classList.toggle('hidden', isVF);
    document.getElementById('q-ans-d').parentElement.classList.toggle('hidden', isVF);
    if (isVF) {
        document.getElementById('q-ans-a').value = "Vrai";
        document.getElementById('q-ans-b').value = "Faux";
        document.getElementById('q-correct').innerHTML = `
            <option value="A">Vrai (A)</option>
            <option value="B">Faux (B)</option>
        `;
    } else {
        document.getElementById('q-correct').innerHTML = `
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
        `;
    }
};

document.getElementById('btn-do-import').onclick = async () => {
    if (!currentClassId) return alert("Sélectionnez une classe !");
    const worldId = document.getElementById('q-world').value;
    if (!worldId) return alert("Sélectionnez un chapitre !");
    
    const file = document.getElementById('csv-file').files[0];
    if (!file) return alert("Sélectionnez un fichier .csv");

    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const lines = text.split('\n').slice(1); // On saute l'entête
        let count = 0;

        for (let line of lines) {
            const parts = line.split(',');
            if (parts.length < 6) continue;

            const payload = {
                class_id: parseInt(currentClassId),
                world_id: parseInt(worldId),
                subject: 'Importé',
                topic: 'CSV',
                bloom_level: 'knowledge',
                question: parts[0].trim(),
                answer_a: parts[1].trim(),
                answer_b: parts[2].trim(),
                answer_c: parts[3].trim(),
                answer_d: parts[4].trim(),
                correct_answer: parts[5].trim().toUpperCase(),
                explanation: parts[6] ? parts[6].trim() : ""
            };

            await fetch(`${API}/questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            count++;
        }
        document.getElementById('import-feedback').textContent = `✅ ${count} questions importées !`;
        fetchQuestionsList();
    };
    reader.readAsText(file);
};

async function fetchQuestionsList() {
    if (!currentClassId) return;
    const worldId = document.getElementById('q-world').value;
    
    let url = `${API}/questions?class_id=${currentClassId}`;
    if (worldId) url += `&world_id=${worldId}`;

    try {
        const res = await fetch(url);
        const questions = await res.json();
        document.getElementById('q-count').textContent = questions.length;
        
        const tbody = document.querySelector('#all-questions-table tbody');
        tbody.innerHTML = questions.length ? '' : '<tr><td colspan="4" style="text-align:center;">Aucune question</td></tr>';
        
        questions.forEach(q => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis;">${q.question}</td>
                <td>${q.subject}</td>
                <td>${q.bloom_level}</td>
                <td><button class="arcade-btn grey-btn mini-btn" disabled>Suppr.</button></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) { console.error(err); }
}

// --- Dashboard Logic ---
document.getElementById('btn-export').onclick = async () => {
    if (!currentClassId) return;
    try {
        const res = await fetch(`${API}/stats?class_id=${currentClassId}`);
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rapport_guilde_classe_${currentClassId}.json`;
        a.click();
    } catch (err) { alert("Erreur d'export"); }
};

async function fetchStats() {
    if (!currentClassId) return;
    try {
        const res = await fetch(`${API}/stats?class_id=${currentClassId}`);
        if(res.ok) renderDashboard(await res.json());
    } catch(err) { console.error(err); }
}

function renderDashboard(data) {
    const { summary, students, heatmap } = data;
    document.getElementById('stat-active').textContent = summary.active_students || 0;
    document.getElementById('stat-avg').textContent = (summary.class_avg || 0) + '%';
    document.getElementById('stat-sessions').textContent = students.length;

    const tbodyHeat = document.querySelector('#heatmap-table tbody');
    tbodyHeat.innerHTML = heatmap.length ? '' : '<tr><td colspan="3" style="text-align:center;">Aucune donnée</td></tr>';
    heatmap.forEach(q => {
        const rate = Math.round(q.success_rate || 0);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${q.question}</td><td>LVL ${q.difficulty}</td><td>${rate}%</td>`;
        tbodyHeat.appendChild(tr);
    });

    const tbodyStud = document.querySelector('#students-table tbody');
    tbodyStud.innerHTML = students.length ? '' : '<tr><td colspan="4" style="text-align:center;">Aucun élève</td></tr>';
    students.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${s.name}</td><td>${s.xp}</td><td>LVL ${s.game_level}</td><td>Actif</td>`;
        tbodyStud.appendChild(tr);
    });
}

setInterval(fetchStats, 15000);

// --- Question Creation ---
document.getElementById('add-question-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const worldId = document.getElementById('q-world').value;
    if (!worldId) return alert("Créez ou sélectionnez un chapitre d'abord !");
    
    const feedback = document.getElementById('q-feedback');
    feedback.textContent = 'Envoi...';

    const payload = {
        class_id: parseInt(currentClassId),
        world_id: parseInt(worldId), 
        type: document.getElementById('q-type').value,
        subject: document.getElementById('q-subject').value,
        topic: document.getElementById('q-topic').value,
        bloom_level: document.getElementById('q-bloom').value,
        question: document.getElementById('q-text').value,
        answer_a: document.getElementById('q-ans-a').value,
        answer_b: document.getElementById('q-ans-b').value,
        answer_c: document.getElementById('q-ans-c').value,
        answer_d: document.getElementById('q-ans-d').value,
        correct_answer: document.getElementById('q-correct').value,
        explanation: document.getElementById('q-exp').value,
        xp_reward: parseInt(document.getElementById('q-xp').value)
    };

    try {
        const res = await fetch(`${API}/questions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if(res.ok) {
            feedback.textContent = '✅ Ajouté !';
            e.target.reset();
            fetchQuestionsList();
        }
    } catch(err) { feedback.textContent = '❌ Erreur'; }
});
