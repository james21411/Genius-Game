import argparse
import io
from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import os
import hashlib
import random
import string
import json
from dotenv import load_dotenv
import google.generativeai as genai

try:
    import PyPDF2
except ImportError:
    PyPDF2 = None

from system_prompt import build_system_prompt
from student_analyzer import get_student_profile
from generation_prompts import get_generation_prompt, get_lesson_fragments_prompt

# Charger les variables d'environnement depuis .env
load_dotenv()

app = Flask(__name__)
CORS(app)

# --- CONFIGURATION GEMINI ---
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
GEMINI_MODEL_NAME = os.environ.get('GEMINI_MODEL_NAME', 'gemini-2.5-flash')

if GEMINI_API_KEY and GEMINI_API_KEY != 'YOUR_GEMINI_API_KEY_HERE':
    genai.configure(api_key=GEMINI_API_KEY)
    print(f"OK Gemini API configuree avec le modele: {GEMINI_MODEL_NAME}")
else:
    print("WARN  GEMINI_API_KEY non définie dans .env - le chatbot IA sera désactivé")

# Charger la base de connaissance
KNOWLEDGE_BASE = {}
knowledge_path = os.path.join(os.path.dirname(__file__), 'knowledge_base.json')
if os.path.exists(knowledge_path):
    try:
        with open(knowledge_path, 'r', encoding='utf-8') as f:
            KNOWLEDGE_BASE = json.load(f)
        print(f"OK Base de connaissance chargée ({len(KNOWLEDGE_BASE)} sections)")
    except Exception as e:
        print(f"WARN  Erreur chargement base de connaissance: {e}")



DB_PATH = os.path.join(os.path.dirname(__file__), 'geniusjump.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def ensure_schema():
    conn = get_db()
    cols = [row[1] for row in conn.execute("PRAGMA table_info(questions)").fetchall()]
    if cols and 'points' not in cols:
        conn.execute("ALTER TABLE questions ADD COLUMN points INTEGER DEFAULT 1")
    if cols and 'lesson_fragment_id' not in cols:
        conn.execute("ALTER TABLE questions ADD COLUMN lesson_fragment_id INTEGER")

    conn.execute("""
        CREATE TABLE IF NOT EXISTS lesson_fragments (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            world_id    INTEGER NOT NULL,
            class_id    INTEGER NOT NULL,
            order_index INTEGER DEFAULT 1,
            title       TEXT,
            content     TEXT    NOT NULL,
            image_data  TEXT,
            bloom_level TEXT    DEFAULT 'comprehension',
            question_id INTEGER,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE,
            FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
            FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE SET NULL
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_lesson_fragments_world ON lesson_fragments(world_id)")
    conn.commit()
    conn.close()

ensure_schema()

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def generate_class_code():
    return ''.join(random.choices(string.ascii_uppercase, k=4)) + '-' + \
           ''.join(random.choices(string.digits, k=4))

# --- AUTHENTICATION ---

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    
    if not name or not email or not password:
        return jsonify({"error": "Données manquantes"}), 400
    
    password_hash = hash_password(password)
    
    try:
        conn = get_db()
        conn.execute("INSERT INTO teachers (name, email, password_hash) VALUES (?, ?, ?)",
                     (name, email, password_hash))
        conn.commit()
        teacher_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        conn.close()
        return jsonify({"message": "Compte créé", "teacher_id": teacher_id}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "Email déjà utilisé"}), 400

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    conn = get_db()
    teacher = conn.execute("SELECT id, name, password_hash FROM teachers WHERE email = ?", (email,)).fetchone()
    conn.close()
    
    if teacher and teacher['password_hash'] == hash_password(password):
        return jsonify({
            "teacher_id": teacher['id'],
            "name": teacher['name']
        }), 200
    
    return jsonify({"error": "Identifiants invalides"}), 401

# --- CLASS MANAGEMENT ---

@app.route('/api/classes', methods=['GET'])
def get_classes():
    teacher_id = request.args.get('teacher_id')
    if not teacher_id:
        return jsonify({"error": "Non autorisé"}), 401
    
    conn = get_db()
    classes = conn.execute("SELECT * FROM classes WHERE teacher_id = ?", (teacher_id,)).fetchall()
    conn.close()
    return jsonify([dict(row) for row in classes])

@app.route('/api/classes', methods=['POST'])
def create_class():
    data = request.json
    teacher_id = data.get('teacher_id')
    name = data.get('name')
    subject = data.get('subject', 'Général')
    grade = data.get('grade', 'Inconnu')
    code = data.get('code')
    
    if not teacher_id or not name:
        return jsonify({"error": "Nom de classe requis"}), 400
        
    if code:
        code = code.strip().upper()
    else:
        code = generate_class_code()
        
    conn = get_db()
    existing = conn.execute("SELECT id FROM classes WHERE code = ?", (code,)).fetchone()
    if existing:
        conn.close()
        return jsonify({"error": f"La clé '{code}' est déjà utilisée par une autre classe."}), 400
        
    try:
        conn.execute("INSERT INTO classes (teacher_id, name, code, subject, grade) VALUES (?, ?, ?, ?, ?)",
                     (teacher_id, name, code, subject, grade))
        conn.commit()
        class_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        conn.close()
        return jsonify({"class_id": class_id, "code": code}), 201
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 500

@app.route('/api/classes/<int:class_id>', methods=['PUT'])
def update_class(class_id):
    data = request.json
    name = data.get('name')
    code = data.get('code')
    subject = data.get('subject', 'Général')
    grade = data.get('grade', 'Inconnu')
    
    if not name or not code:
        return jsonify({"error": "Nom et clé de classe requis"}), 400
        
    code = code.strip().upper()
    conn = get_db()
    existing = conn.execute("SELECT id FROM classes WHERE code = ? AND id != ?", (code, class_id)).fetchone()
    if existing:
        conn.close()
        return jsonify({"error": f"La clé '{code}' est déjà utilisée par une autre classe."}), 400
        
    conn.execute("""
        UPDATE classes SET name = ?, code = ?, subject = ?, grade = ?
        WHERE id = ?
    """, (name, code, subject, grade, class_id))
    conn.commit()
    conn.close()
    return jsonify({"message": "Classe mise à jour", "code": code}), 200

@app.route('/api/classes/<int:class_id>', methods=['DELETE'])
def delete_class(class_id):
    conn = get_db()
    conn.execute("DELETE FROM classes WHERE id = ?", (class_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Classe supprimée"}), 200

# --- STUDENT ENROLLMENT ---

@app.route('/api/classes/<int:class_id>/students', methods=['GET'])
def get_class_students(class_id):
    conn = get_db()
    students = conn.execute("SELECT * FROM students WHERE class_id = ?", (class_id,)).fetchall()
    conn.close()
    return jsonify([dict(row) for row in students])

@app.route('/api/classes/<int:class_id>/enroll', methods=['POST'])
def enroll_student(class_id):
    data = request.json
    name = data.get('name')
    
    if not name:
        return jsonify({"error": "Nom de l'élève requis"}), 400
    
    conn = get_db()
    conn.execute("INSERT INTO students (class_id, name) VALUES (?, ?)", (class_id, name))
    conn.commit()
    student_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    
    return jsonify({"student_id": student_id}), 201

# --- EVALUATION / WORLD MANAGEMENT ---

@app.route('/api/classes/<int:class_id>/worlds', methods=['GET'])
def get_worlds(class_id):
    conn = get_db()
    worlds = conn.execute("SELECT * FROM worlds WHERE class_id = ?", (class_id,)).fetchall()
    conn.close()
    return jsonify([dict(row) for row in worlds])

@app.route('/api/worlds', methods=['POST'])
def create_world():
    data = request.json
    class_id = data.get('class_id')
    name = data.get('name')
    topic = data.get('topic')
    subject = data.get('subject', 'Général')
    mode = data.get('mode', 'lesson')
    
    if not class_id or not name or not topic:
        return jsonify({"error": "Données manquantes"}), 400
    
    conn = get_db()
    last_idx = conn.execute("SELECT MAX(world_index) FROM worlds WHERE class_id = ?", (class_id,)).fetchone()[0] or 0
    
    conn.execute("""
        INSERT INTO worlds (class_id, world_index, name, subject, topic, mode, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (class_id, last_idx + 1, name, subject, topic, mode, 1))
    conn.commit()
    world_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    
    return jsonify({"world_id": world_id}), 201

@app.route('/api/worlds/<int:world_id>', methods=['PUT'])
def update_world(world_id):
    data = request.json
    name = data.get('name')
    topic = data.get('topic')
    subject = data.get('subject', 'Général')
    mode = data.get('mode', 'lesson')
    
    if not name or not topic:
        return jsonify({"error": "Nom et thème requis"}), 400
        
    conn = get_db()
    conn.execute("""
        UPDATE worlds SET name = ?, topic = ?, subject = ?, mode = ?
        WHERE id = ?
    """, (name, topic, subject, mode, world_id))
    conn.commit()
    conn.close()
    return jsonify({"message": "Monde mis à jour"}), 200

@app.route('/api/worlds/<int:world_id>', methods=['DELETE'])
def delete_world(world_id):
    conn = get_db()
    conn.execute("DELETE FROM worlds WHERE id = ?", (world_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Monde supprimé"}), 200

# --- GAME API (Existing logic) ---

@app.route('/api/students/join', methods=['POST'])
def join_class():
    data = request.json
    name = (data.get('name') or '').strip()
    code = (data.get('code') or '').strip().upper()

    if not name or not code:
        return jsonify({"error": "Nom et code de classe requis"}), 400
    
    conn = get_db()
    class_row = conn.execute("SELECT id FROM classes WHERE UPPER(TRIM(code)) = ?", (code,)).fetchone()
    if not class_row:
        conn.close()
        return jsonify({"error": "Code de classe invalide"}), 404
    
    class_id = class_row['id']
    student = conn.execute("SELECT id, class_id, xp FROM students WHERE name = ? AND class_id = ?", (name, class_id)).fetchone()
    
    if not student:
        conn.execute("INSERT INTO students (class_id, name) VALUES (?, ?)", (class_id, name))
        conn.commit()
        student = conn.execute("SELECT id, class_id, xp FROM students WHERE name = ? AND class_id = ?", (name, class_id)).fetchone()
    
    conn.close()
    return jsonify(dict(student))

@app.route('/api/sessions', methods=['POST'])
def create_session():
    data = request.json
    student_id = data.get('student_id')
    class_id = data.get('class_id')
    world_id = data.get('world_id')
    game_level = data.get('game_level', 1)
    mode = data.get('mode', 'lesson')
    
    if not student_id or not class_id:
        return jsonify({"error": "Données manquantes"}), 400
        
    conn = get_db()
    conn.execute("""
        INSERT INTO sessions (student_id, class_id, world_id, game_level, mode)
        VALUES (?, ?, ?, ?, ?)
    """, (student_id, class_id, world_id, game_level, mode))
    conn.commit()
    session_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    return jsonify({"session_id": session_id}), 201

@app.route('/api/answers', methods=['POST'])
def record_answer():
    data = request.json
    session_id = data.get('session_id')
    question_id = data.get('question_id')
    student_id = data.get('student_id')
    given_answer = data.get('given_answer')
    is_correct = data.get('is_correct', 0)
    time_taken = data.get('time_taken', 0.0)
    attempt_number = data.get('attempt_number', 1)
    
    if not session_id or not question_id or not student_id:
        return jsonify({"error": "Données manquantes"}), 400
        
    if isinstance(given_answer, (dict, list)):
        given_answer = json.dumps(given_answer)
    else:
        given_answer = str(given_answer)
        
    conn = get_db()
    conn.execute("""
        INSERT INTO answers (session_id, question_id, student_id, given_answer, is_correct, time_taken, attempt_number)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (session_id, question_id, student_id, given_answer, is_correct, time_taken, attempt_number))
    
    # Update student XP
    if is_correct:
        q_row = conn.execute("SELECT xp_reward FROM questions WHERE id = ?", (question_id,)).fetchone()
        xp_gain = q_row['xp_reward'] if q_row else 50
        conn.execute("UPDATE students SET xp = xp + ? WHERE id = ?", (xp_gain, student_id))
        
    conn.commit()
    conn.close()
    return jsonify({"message": "Réponse enregistrée"}), 201

@app.route('/api/questions', methods=['GET'])
def get_questions():
    class_id = request.args.get('class_id')
    world_id = request.args.get('world_id')
    
    conn = get_db()
    base_select = """
        SELECT q.*, lf.title AS lesson_title, lf.content AS lesson_content,
               lf.image_data AS lesson_image_data, lf.order_index AS lesson_order
        FROM questions q
        LEFT JOIN lesson_fragments lf ON lf.id = q.lesson_fragment_id
    """
    if world_id:
        questions = conn.execute(base_select + " WHERE q.world_id = ? ORDER BY COALESCE(lf.order_index, q.id), q.id", (world_id,)).fetchall()
    elif class_id:
        questions = conn.execute(base_select + " WHERE q.class_id = ? ORDER BY q.id", (class_id,)).fetchall()
    else:
        questions = conn.execute(base_select + " ORDER BY q.id LIMIT 20").fetchall()
    conn.close()
    return jsonify([dict(row) for row in questions])

@app.route('/api/questions', methods=['POST'])
def add_question():
    data = request.json
    conn = get_db()
    conn.execute("""
        INSERT INTO questions (world_id, class_id, type, subject, topic, bloom_level, question, 
                             answer_a, answer_b, answer_c, answer_d, correct_answer, explanation,
                             time_limit, xp_reward, difficulty, points, extra_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (data.get('world_id'), data.get('class_id'), data.get('type', 'qcm'), data.get('subject'), data.get('topic'),
          data.get('bloom_level'), data.get('question'), data.get('answer_a'), data.get('answer_b'),
          data.get('answer_c'), data.get('answer_d'), data.get('correct_answer'), data.get('explanation'),
          data.get('time_limit', 15), data.get('xp_reward', 50), data.get('difficulty', 1),
          data.get('points', 1), data.get('extra_data')))
    conn.commit()
    conn.close()
    return jsonify({"message": "Question ajoutée"}), 201

@app.route('/api/questions/<int:question_id>', methods=['PUT'])
def update_question(question_id):
    data = request.json
    conn = get_db()
    conn.execute("""
        UPDATE questions SET 
            type = ?, subject = ?, topic = ?, bloom_level = ?, question = ?,
            answer_a = ?, answer_b = ?, answer_c = ?, answer_d = ?,
            correct_answer = ?, explanation = ?, xp_reward = ?, time_limit = ?, points = ?, extra_data = ?
        WHERE id = ?
    """, (data.get('type'), data.get('subject'), data.get('topic'), data.get('bloom_level'), data.get('question'),
          data.get('answer_a'), data.get('answer_b'), data.get('answer_c'), data.get('answer_d'),
          data.get('correct_answer'), data.get('explanation'), data.get('xp_reward', 50), data.get('time_limit', 15),
          data.get('points', 1), data.get('extra_data'), question_id))
    conn.commit()
    conn.close()
    return jsonify({"message": "Question mise à jour"}), 200

@app.route('/api/questions/<int:question_id>', methods=['DELETE'])
def delete_question(question_id):
    conn = get_db()
    conn.execute("DELETE FROM questions WHERE id = ?", (question_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Question supprimée"}), 200

# --- ANALYTICS ---

@app.route('/api/stats', methods=['GET'])
def get_stats():
    class_id = request.args.get('class_id')
    mode = request.args.get('mode')
    world_id = request.args.get('world_id')
    if not class_id:
        return jsonify({"error": "ID de classe requis"}), 400
    
    conn = get_db()
    students = conn.execute("SELECT id, name, xp, game_level FROM students WHERE class_id = ?", (class_id,)).fetchall()
    
    # Heatmap (Succès par question)
    heatmap_params = [class_id]
    heatmap_mode_clause = ""
    if mode in ('lesson', 'eval'):
        heatmap_mode_clause = " AND w.mode = ?"
        heatmap_params.append(mode)
    if world_id:
        heatmap_mode_clause += " AND q.world_id = ?"
        heatmap_params.append(world_id)

    heatmap = conn.execute(f"""
        SELECT q.question, q.topic, q.difficulty, q.world_id, w.mode,
               CAST(COUNT(CASE WHEN a.is_correct = 1 THEN 1 END) AS FLOAT) / COUNT(*) * 100 as success_rate
        FROM questions q
        LEFT JOIN worlds w ON w.id = q.world_id
        JOIN answers a ON q.id = a.question_id
        WHERE q.class_id = ?{heatmap_mode_clause}
        GROUP BY q.id
    """, heatmap_params).fetchall()
    
    conn.close()
    return jsonify({
        "summary": {
            "active_students": len(students),
            "class_avg": round(sum(h['success_rate'] for h in heatmap) / len(heatmap), 1) if heatmap else 0
        },
        "students": [dict(s) for s in students],
        "heatmap": [dict(h) for h in heatmap]
    })

def _extract_context_from_request():
    context = request.form.get('context', '') if request.form else ''
    if request.is_json and request.json:
        context = request.json.get('context', context)

    file = request.files.get('file') if request.files else None
    if file and file.filename:
        filename = file.filename.lower()
        if filename.endswith('.pdf'):
            if not PyPDF2:
                raise ValueError("PyPDF2 non installé — impossible de lire le PDF")
            reader = PyPDF2.PdfReader(io.BytesIO(file.read()))
            extracted_text = ""
            for page in reader.pages:
                extracted_text += (page.extract_text() or "") + "\n"
            context = extracted_text + "\n" + context
        elif filename.endswith('.txt'):
            context = file.read().decode('utf-8', errors='replace') + "\n" + context

    return context.strip()


def _parse_json_field(raw, default=None):
    if default is None:
        default = {}
    if not raw:
        return default
    if isinstance(raw, (dict, list)):
        return raw
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return default


def _normalize_generated_question(q, q_type):
    extra_data = q.get('extra_data')
    if isinstance(extra_data, str):
        try:
            extra_data = json.loads(extra_data)
        except (json.JSONDecodeError, TypeError):
            extra_data = {}
    if isinstance(extra_data, dict):
        if q_type == 'matching' and 'pairs' not in extra_data:
            left = extra_data.get('left_items', [])
            right = extra_data.get('right_items', [])
            if left and right and len(left) == len(right):
                extra_data['pairs'] = {str(l): str(r) for l, r in zip(left, right)}
        extra_data = json.dumps(extra_data, ensure_ascii=False)
    elif extra_data is None:
        extra_data = ''

    correct_answer = q.get('correct_answer')
    if q_type == 'matching' and (not correct_answer or correct_answer == ''):
        try:
            parsed = json.loads(extra_data) if isinstance(extra_data, str) else extra_data
            if isinstance(parsed, dict) and parsed.get('pairs'):
                correct_answer = json.dumps(parsed['pairs'], ensure_ascii=False)
        except (json.JSONDecodeError, TypeError):
            pass

    stored_type = 'dragdrop_text' if q_type == 'dragdrop' else q_type

    return {
        'type': stored_type,
        'subject': q.get('subject') or 'IA Gemini',
        'topic': q.get('topic') or 'Généré IA',
        'bloom_level': q.get('bloom_level') or 'comprehension',
        'question': q.get('question') or '',
        'answer_a': q.get('answer_a') or '',
        'answer_b': q.get('answer_b') or '',
        'answer_c': q.get('answer_c') or '',
        'answer_d': q.get('answer_d') or '',
        'correct_answer': correct_answer if correct_answer is not None else '',
        'explanation': q.get('explanation') or '',
        'extra_data': extra_data,
        'points': int(q.get('points') or 1),
        'time_limit': int(q.get('time_limit') or 15),
        'xp_reward': int(q.get('xp_reward') or 50),
    }


def _call_gemini_for_questions(context, count, bloom_levels, q_type, extra_instructions=''):
    if not GEMINI_API_KEY or GEMINI_API_KEY == 'YOUR_GEMINI_API_KEY_HERE':
        raise RuntimeError("Chatbot IA non configuré. Ajoutez GEMINI_API_KEY dans .env")

    prompt = get_generation_prompt(context, count, bloom_levels, q_type, extra_instructions)
    model = genai.GenerativeModel(GEMINI_MODEL_NAME)
    response = model.generate_content(prompt)
    json_text = response.text.replace('```json', '').replace('```', '').strip()
    generated = json.loads(json_text)
    if not isinstance(generated, list):
        raise ValueError("La réponse Gemini n'est pas un tableau JSON")
    return generated


def _normalize_lesson_fragment(fragment, order_index=1):
    question = fragment.get('question') or {}
    normalized_question = _normalize_generated_question({
        'type': 'qcm',
        'topic': fragment.get('title') or question.get('topic') or 'Leçon',
        'bloom_level': fragment.get('bloom_level') or question.get('bloom_level') or 'comprehension',
        'question': question.get('question') or '',
        'answer_a': question.get('answer_a') or '',
        'answer_b': question.get('answer_b') or '',
        'answer_c': question.get('answer_c') or '',
        'answer_d': question.get('answer_d') or '',
        'correct_answer': question.get('correct_answer') or 'A',
        'explanation': question.get('explanation') or '',
        'points': question.get('points') or 1,
        'time_limit': question.get('time_limit') or 20,
        'xp_reward': question.get('xp_reward') or 50,
    }, 'qcm')

    return {
        'order_index': int(fragment.get('order_index') or order_index),
        'title': fragment.get('title') or f'Fragment {order_index}',
        'content': fragment.get('content') or '',
        'image_data': fragment.get('image_data') or fragment.get('image_prompt') or '',
        'bloom_level': fragment.get('bloom_level') or normalized_question['bloom_level'] or 'comprehension',
        'question': normalized_question,
    }


def _call_gemini_for_lesson_fragments(context, count, bloom_levels, extra_instructions=''):
    if not GEMINI_API_KEY or GEMINI_API_KEY == 'YOUR_GEMINI_API_KEY_HERE':
        raise RuntimeError("Chatbot IA non configuré. Ajoutez GEMINI_API_KEY dans .env")

    prompt = get_lesson_fragments_prompt(context, count, bloom_levels, extra_instructions)
    model = genai.GenerativeModel(GEMINI_MODEL_NAME)
    response = model.generate_content(prompt)
    json_text = response.text.replace('```json', '').replace('```', '').strip()
    generated = json.loads(json_text)
    if not isinstance(generated, list):
        raise ValueError("La réponse Gemini n'est pas un tableau JSON")
    return generated


def _insert_question_row(db, class_id, world_id, q_type, q):
    normalized = _normalize_generated_question(q, q_type)
    db.execute('''
        INSERT INTO questions (class_id, world_id, type, subject, topic, bloom_level, question,
                             answer_a, answer_b, answer_c, answer_d, correct_answer, explanation,
                             extra_data, points, time_limit, xp_reward)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        class_id, world_id, normalized['type'], normalized['subject'], normalized['topic'],
        normalized['bloom_level'], normalized['question'],
        normalized['answer_a'], normalized['answer_b'], normalized['answer_c'], normalized['answer_d'],
        normalized['correct_answer'], normalized['explanation'], normalized['extra_data'],
        normalized['points'], normalized['time_limit'], normalized['xp_reward']
    ))


@app.route('/api/questions/bulk', methods=['POST'])
def bulk_add_questions():
    data = request.json or {}
    class_id = data.get('class_id')
    world_id = data.get('world_id')
    questions = data.get('questions', [])

    if not class_id or not world_id:
        return jsonify({"error": "class_id et world_id requis"}), 400
    if not questions:
        return jsonify({"error": "Aucune question à importer"}), 400

    db = get_db()
    inserted = 0
    try:
        for q in questions:
            q_type = q.get('type', 'qcm')
            if q_type == 'dragdrop':
                q_type = 'dragdrop_text'
            row = {
                'subject': q.get('subject', 'IA Gemini'),
                'topic': q.get('topic', 'Généré IA'),
                'bloom_level': q.get('bloom_level', 'comprehension'),
                'question': q.get('question', ''),
                'answer_a': q.get('answer_a', ''),
                'answer_b': q.get('answer_b', ''),
                'answer_c': q.get('answer_c', ''),
                'answer_d': q.get('answer_d', ''),
                'correct_answer': q.get('correct_answer', ''),
                'explanation': q.get('explanation', ''),
                'extra_data': q.get('extra_data'),
                'points': q.get('points', 1),
                'time_limit': q.get('time_limit', 15),
                'xp_reward': q.get('xp_reward', 50),
            }
            extra_data = row['extra_data']
            if isinstance(extra_data, dict):
                extra_data = json.dumps(extra_data, ensure_ascii=False)
            db.execute('''
                INSERT INTO questions (class_id, world_id, type, subject, topic, bloom_level, question,
                                     answer_a, answer_b, answer_c, answer_d, correct_answer, explanation,
                                     extra_data, points, time_limit, xp_reward)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                class_id, world_id, q_type, row['subject'], row['topic'], row['bloom_level'], row['question'],
                row['answer_a'], row['answer_b'], row['answer_c'], row['answer_d'],
                row['correct_answer'], row['explanation'], extra_data or '',
                row['points'], row['time_limit'], row['xp_reward']
            ))
            inserted += 1
        db.commit()
    finally:
        db.close()

    return jsonify({"count": inserted, "message": f"{inserted} question(s) ajoutée(s) à la banque"})


@app.route('/api/worlds/<int:world_id>/lesson-fragments', methods=['GET'])
def get_lesson_fragments(world_id):
    conn = get_db()
    rows = conn.execute("""
        SELECT lf.*, q.type, q.question, q.answer_a, q.answer_b, q.answer_c, q.answer_d,
               q.correct_answer, q.explanation, q.points, q.time_limit, q.xp_reward
        FROM lesson_fragments lf
        LEFT JOIN questions q ON q.id = lf.question_id
        WHERE lf.world_id = ?
        ORDER BY lf.order_index ASC, lf.id ASC
    """, (world_id,)).fetchall()
    conn.close()

    fragments = []
    for row in rows:
        item = dict(row)
        item['check_question'] = {
            'id': item.get('question_id'),
            'type': item.get('type') or 'qcm',
            'question': item.get('question') or '',
            'answer_a': item.get('answer_a') or '',
            'answer_b': item.get('answer_b') or '',
            'answer_c': item.get('answer_c') or '',
            'answer_d': item.get('answer_d') or '',
            'correct_answer': item.get('correct_answer') or 'A',
            'explanation': item.get('explanation') or '',
            'points': item.get('points') or 1,
            'time_limit': item.get('time_limit') or 20,
            'xp_reward': item.get('xp_reward') or 50,
        }
        for key in ('type', 'question', 'answer_a', 'answer_b', 'answer_c', 'answer_d',
                    'correct_answer', 'explanation', 'points', 'time_limit', 'xp_reward'):
            item.pop(key, None)
        fragments.append(item)
    return jsonify(fragments)


@app.route('/api/lesson-fragments', methods=['POST'])
def add_lesson_fragment():
    data = request.json or {}
    class_id = data.get('class_id')
    world_id = data.get('world_id')
    fragment = _normalize_lesson_fragment(data, data.get('order_index') or 1)

    if not class_id or not world_id or not fragment['content']:
        return jsonify({"error": "class_id, world_id et contenu requis"}), 400

    conn = get_db()
    try:
        q = fragment['question']
        conn.execute("""
            INSERT INTO questions (class_id, world_id, type, subject, topic, bloom_level, question,
                                 answer_a, answer_b, answer_c, answer_d, correct_answer, explanation,
                                 extra_data, points, time_limit, xp_reward, lesson_fragment_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
        """, (
            class_id, world_id, 'qcm', data.get('subject') or 'Leçon',
            data.get('topic') or fragment['title'], fragment['bloom_level'], q['question'],
            q['answer_a'], q['answer_b'], q['answer_c'], q['answer_d'],
            q['correct_answer'], q['explanation'], '', q['points'], q['time_limit'], q['xp_reward']
        ))
        question_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        conn.execute("""
            INSERT INTO lesson_fragments (world_id, class_id, order_index, title, content, image_data, bloom_level, question_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            world_id, class_id, fragment['order_index'], fragment['title'], fragment['content'],
            fragment['image_data'], fragment['bloom_level'], question_id
        ))
        fragment_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        conn.execute("UPDATE questions SET lesson_fragment_id = ? WHERE id = ?", (fragment_id, question_id))
        conn.commit()
    finally:
        conn.close()

    return jsonify({"fragment_id": fragment_id, "question_id": question_id}), 201


@app.route('/api/lesson-fragments/<int:fragment_id>', methods=['DELETE'])
def delete_lesson_fragment(fragment_id):
    conn = get_db()
    row = conn.execute("SELECT question_id FROM lesson_fragments WHERE id = ?", (fragment_id,)).fetchone()
    if row and row['question_id']:
        conn.execute("DELETE FROM questions WHERE id = ?", (row['question_id'],))
    conn.execute("DELETE FROM lesson_fragments WHERE id = ?", (fragment_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Fragment supprimé"}), 200


@app.route('/api/lesson-fragments/bulk', methods=['POST'])
def bulk_add_lesson_fragments():
    data = request.json or {}
    class_id = data.get('class_id')
    world_id = data.get('world_id')
    fragments = data.get('fragments', [])
    subject = data.get('subject') or 'Leçon'
    topic = data.get('topic') or 'Leçon'

    if not class_id or not world_id:
        return jsonify({"error": "class_id et world_id requis"}), 400
    if not fragments:
        return jsonify({"error": "Aucun fragment à importer"}), 400

    conn = get_db()
    inserted = 0
    try:
        for idx, raw in enumerate(fragments, start=1):
            fragment = _normalize_lesson_fragment(raw, idx)
            if not fragment['content']:
                continue
            q = fragment['question']
            conn.execute("""
                INSERT INTO questions (class_id, world_id, type, subject, topic, bloom_level, question,
                                     answer_a, answer_b, answer_c, answer_d, correct_answer, explanation,
                                     extra_data, points, time_limit, xp_reward, lesson_fragment_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
            """, (
                class_id, world_id, 'qcm', subject, topic, fragment['bloom_level'], q['question'],
                q['answer_a'], q['answer_b'], q['answer_c'], q['answer_d'],
                q['correct_answer'], q['explanation'], '', q['points'], q['time_limit'], q['xp_reward']
            ))
            question_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
            conn.execute("""
                INSERT INTO lesson_fragments (world_id, class_id, order_index, title, content, image_data, bloom_level, question_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                world_id, class_id, fragment['order_index'], fragment['title'], fragment['content'],
                fragment['image_data'], fragment['bloom_level'], question_id
            ))
            fragment_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
            conn.execute("UPDATE questions SET lesson_fragment_id = ? WHERE id = ?", (fragment_id, question_id))
            inserted += 1
        conn.commit()
    finally:
        conn.close()

    return jsonify({"count": inserted, "message": f"{inserted} fragment(s) de leçon importé(s)"})


@app.route('/api/ai/generate-preview', methods=['POST'])
def ai_generate_preview():
    try:
        context = _extract_context_from_request()
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    type_counts = _parse_json_field(request.form.get('type_counts') if request.form else None, {})
    if request.is_json and request.json:
        type_counts = request.json.get('type_counts', type_counts)

    bloom_levels = _parse_json_field(request.form.get('bloom_levels') if request.form else None, ['comprehension'])
    if request.is_json and request.json:
        bloom_levels = request.json.get('bloom_levels', bloom_levels)

    chat_context = request.form.get('chat_context', '') if request.form else ''
    if request.is_json and request.json:
        chat_context = request.json.get('chat_context', chat_context)

    if not context:
        return jsonify({"error": "Aucun contenu à analyser (texte ou fichier requis)"}), 400

    if not type_counts or sum(int(v or 0) for v in type_counts.values()) <= 0:
        return jsonify({"error": "Configurez au moins une question par type"}), 400

    if not bloom_levels:
        bloom_levels = ['comprehension']

    all_questions = []
    errors = []

    for q_type, count in type_counts.items():
        count = int(count or 0)
        if count <= 0:
            continue
        try:
            generated = _call_gemini_for_questions(context, count, bloom_levels, q_type, chat_context)
            for item in generated:
                normalized = _normalize_generated_question(item, q_type)
                all_questions.append(normalized)
        except Exception as e:
            errors.append(f"{q_type}: {str(e)}")

    if not all_questions:
        return jsonify({"error": errors[0] if errors else "Aucune question générée"}), 500

    return jsonify({
        "questions": all_questions,
        "count": len(all_questions),
        "warnings": errors
    })


@app.route('/api/ai/lesson-generate-preview', methods=['POST'])
def ai_lesson_generate_preview():
    try:
        context = _extract_context_from_request()
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    num_fragments = int(request.form.get('num_fragments', 4) if request.form else 4)
    if request.is_json and request.json:
        num_fragments = int(request.json.get('num_fragments', num_fragments))
    num_fragments = max(1, min(num_fragments, 20))

    bloom_levels = _parse_json_field(request.form.get('bloom_levels') if request.form else None, ['comprehension'])
    if request.is_json and request.json:
        bloom_levels = request.json.get('bloom_levels', bloom_levels)

    chat_context = request.form.get('chat_context', '') if request.form else ''
    if request.is_json and request.json:
        chat_context = request.json.get('chat_context', chat_context)

    if not context:
        return jsonify({"error": "Aucun contenu à analyser (texte ou fichier requis)"}), 400
    if not bloom_levels:
        bloom_levels = ['comprehension']

    try:
        generated = _call_gemini_for_lesson_fragments(context, num_fragments, bloom_levels, chat_context)
        fragments = [_normalize_lesson_fragment(item, idx + 1) for idx, item in enumerate(generated)]
        return jsonify({"fragments": fragments, "count": len(fragments), "warnings": []})
    except Exception as e:
        return jsonify({"error": f"Erreur Gemini: {str(e)}"}), 500


@app.route('/api/ai/teacher-chat', methods=['POST'])
def ai_teacher_chat():
    if not GEMINI_API_KEY or GEMINI_API_KEY == 'YOUR_GEMINI_API_KEY_HERE':
        return jsonify({"error": "IA non configurée"}), 503

    data = request.json or {}
    message = (data.get('message') or '').strip()
    history = data.get('history', [])
    lesson_context = (data.get('lesson_context') or '').strip()

    if not message:
        return jsonify({"error": "Message vide"}), 400

    history_text = ""
    for item in history[-8:]:
        role = item.get('role', 'user')
        content = item.get('content', '')
        history_text += f"{role.upper()}: {content}\n"

    prompt = f"""Tu es un assistant pédagogique pour enseignants utilisant Genius Jump EDU.
Aide l'enseignant à préparer des questions d'évaluation (QCM, vrai/faux, association, etc.).

Contexte du cours (extrait) :
{lesson_context[:3000] if lesson_context else '(non fourni)'}

Historique :
{history_text}

ENSEIGNANT: {message}

Réponds en français, de façon concise et utile."""

    try:
        model = genai.GenerativeModel(GEMINI_MODEL_NAME)
        response = model.generate_content(prompt)
        return jsonify({"reply": response.text.strip()})
    except Exception as e:
        return jsonify({"error": f"Erreur Gemini: {str(e)}"}), 500


@app.route('/api/ai/generate', methods=['POST'])
def ai_generate():
    # Compatibilité : génération directe (ancien flux Labo IA)
    try:
        context = _extract_context_from_request()
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    num = int(request.form.get('num', 5))
    class_id = request.form.get('class_id')
    world_id = request.form.get('world_id')
    bloom = request.form.get('bloom', 'knowledge')
    q_type = request.form.get('question_type', 'qcm')

    if not context:
        return jsonify({"error": "Aucun contenu à analyser"}), 400

    try:
        generated_questions = _call_gemini_for_questions(context, num, bloom, q_type)
        db = get_db()
        questions_added = 0
        for q in generated_questions:
            _insert_question_row(db, class_id, world_id, q_type, q)
            questions_added += 1
        db.commit()
        db.close()
        return jsonify({"count": questions_added, "message": "Questions forgées par Gemini"})
    except Exception as e:
        return jsonify({"error": f"Erreur Gemini: {str(e)}"}), 500


# --- CHATBOT IA ENDPOINT ---

@app.route('/api/chat', methods=['POST'])
def chat_with_gemini():
    """
    Endpoint pour le chatbot IA intégré au jeu.
    Accepte une question de l'utilisateur et retourne une réponse générée par Gemini.
    Utilise la base de connaissance pour contextualiser les réponses.
    """
    if not GEMINI_API_KEY or GEMINI_API_KEY == 'YOUR_GEMINI_API_KEY_HERE':
        return jsonify({"error": "Chatbot IA non configuré. Veuillez ajouter votre clé API Gemini dans .env"}), 503
    
    data = request.json
    user_query = data.get('query', '').strip()
    world_id = data.get('world_id')  # Pour contextualiser les réponses
    student_name = data.get('student_name', 'Aventurier')
    student_id = data.get('student_id')
    chat_history = data.get('history', [])
    game_context = data.get('game_context', {})
    
    if not user_query:
        return jsonify({"error": "Requête vide"}), 400
    
    try:
        conn = get_db()
        
        # Charger le contexte du monde (sujet/topic) si disponible
        world_context = None
        if world_id:
            world = conn.execute("SELECT name, subject, topic FROM worlds WHERE id = ?", (world_id,)).fetchone()
            if world:
                world_context = dict(world)
                
        # Analyser le profil de l'élève si un ID est fourni
        student_profile = None
        if student_id:
            student_profile = get_student_profile(conn, student_id)
            
        conn.close()
        
        # Construire la base de connaissance pertinente
        knowledge_context = ""
        if KNOWLEDGE_BASE:
            knowledge_context += "\n--- BASE DE CONNAISSANCES ---\n"
            # On inclut des extraits pertinents de la base de connaissances
            if 'game_mechanics' in KNOWLEDGE_BASE:
                knowledge_context += "Mécaniques du jeu :\n"
                for key, val in list(KNOWLEDGE_BASE['game_mechanics'].items())[:3]:
                    knowledge_context += f"- {val}\n"
            if 'pedagogy' in KNOWLEDGE_BASE:
                knowledge_context += "\nPédagogie :\n"
                knowledge_context += f"- {KNOWLEDGE_BASE['pedagogy'].get('general_tips', '')}\n"
            if world_context and 'subjects_tips' in KNOWLEDGE_BASE:
                subject_key = "math" if "Math" in world_context.get('subject', '') else "french"
                if subject_key in KNOWLEDGE_BASE['subjects_tips']:
                    knowledge_context += f"\nAstuces ({subject_key}):\n"
                    for key, val in list(KNOWLEDGE_BASE['subjects_tips'][subject_key].items())[:2]:
                        knowledge_context += f"- {val}\n"
            if 'faq' in KNOWLEDGE_BASE:
                 knowledge_context += "\nFAQ :\n"
                 for key, val in list(KNOWLEDGE_BASE['faq'].items())[:2]:
                     knowledge_context += f"- {val}\n"
            knowledge_context += "-----------------------------\n\n"
        
        # Contexte du jeu en temps réel
        realtime_context = ""
        if game_context:
            realtime_context += "--- ÉTAT DU JEU EN TEMPS RÉEL ---\n"
            realtime_context += f"- Vies restantes : {game_context.get('lives', 3)}\n"
            realtime_context += f"- Pièces (🪙) : {game_context.get('coins', 0)}\n"
            if game_context.get('last_wrong_answer'):
                 realtime_context += f"- L'élève vient de se tromper sur la question : '{game_context.get('last_wrong_answer')}'\n"
            realtime_context += "---------------------------------\n\n"

        # Construire le System Prompt via le module
        system_instructions = build_system_prompt(student_name, world_context, student_profile)
        
        # Préparer les messages pour l'API Gemini (Chat)
        messages = [
            {"role": "user", "parts": [system_instructions + knowledge_context + realtime_context + "J'ai compris mes instructions."]},
            {"role": "model", "parts": ["Parfait, je suis prêt ! Que puis-je faire pour toi ?"]}
        ]
        
        # Ajouter l'historique de conversation (les 3 derniers échanges)
        for msg in chat_history[-6:]:
            role = "user" if msg.get("sender") == "user" else "model"
            messages.append({"role": role, "parts": [msg.get("text")]})
            
        # Ajouter la question actuelle
        messages.append({"role": "user", "parts": [user_query]})
        
        model = genai.GenerativeModel(GEMINI_MODEL_NAME)
        response = model.generate_content(messages)
        reply = response.text.strip()
        
        return jsonify({
            "reply": reply,
            "status": "success"
        }), 200
        
    except Exception as e:
        print(f"Erreur Gemini chat: {str(e)}")
        return jsonify({"error": f"Erreur lors de la génération de la réponse: {str(e)}"}), 500

# --- ANALYSE IA DASHBOARD ENDPOINT ---

@app.route('/api/ai/analyze', methods=['GET'])
def ai_analyze_class():
    """
    Endpoint pour le dashboard enseignant.
    Génère une analyse pédagogique de la classe basée sur les statistiques en base de données.
    """
    class_id = request.args.get('class_id')
    if not class_id:
        return jsonify({"error": "class_id requis"}), 400
        
    if not GEMINI_API_KEY or GEMINI_API_KEY == 'YOUR_GEMINI_API_KEY_HERE':
        return jsonify({"error": "Clé API Gemini non configurée"}), 503
        
    try:
        conn = get_db()
        
        # 1. Récupérer les stats globales de la classe
        stats = conn.execute("""
            SELECT 
                COUNT(DISTINCT student_id) as active_students,
                COUNT(*) as total_answers,
                SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct_answers
            FROM answers a
            JOIN students s ON a.student_id = s.id
            WHERE s.class_id = ?
        """, (class_id,)).fetchone()
        
        if not stats or stats['total_answers'] == 0:
            return jsonify({"analysis": "Pas assez de données pour analyser cette classe. Demandez aux élèves de jouer !"}), 200
            
        success_rate = round((stats['correct_answers'] / stats['total_answers']) * 100)
        
        # 2. Récupérer les questions les plus difficiles (Heatmap)
        hard_questions = conn.execute("""
            SELECT 
                q.question, 
                q.topic,
                COUNT(*) as attempts,
                SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) as successes
            FROM answers a
            JOIN questions q ON a.question_id = q.id
            JOIN students s ON a.student_id = s.id
            WHERE s.class_id = ?
            GROUP BY q.id
            HAVING attempts >= 2
            ORDER BY (CAST(successes AS FLOAT) / attempts) ASC
            LIMIT 5
        """, (class_id,)).fetchall()
        
        conn.close()
        
        # Construire le prompt d'analyse
        context = f"Statistiques de la classe :\n- Élèves actifs: {stats['active_students']}\n- Taux de réussite global: {success_rate}%\n\nQuestions posant le plus de problèmes :\n"
        for q in hard_questions:
            rate = round((q['successes'] / q['attempts']) * 100)
            context += f"- Thème: {q['topic']} | Question: '{q['question']}' | Taux de réussite: {rate}%\n"
            
        prompt = f"""Tu es un conseiller pédagogique expert.
Analyse les statistiques suivantes d'une classe jouant à un jeu éducatif.

{context}

Rédige une courte analyse (en markdown) avec :
1. Un constat global sur la classe (1-2 phrases)
2. L'identification des concepts qui bloquent
3. 2 ou 3 recommandations concrètes pour l'enseignant (ex: sujets à revoir en classe, type d'exercices à proposer)

Sois professionnel mais encourageant."""

        model = genai.GenerativeModel(GEMINI_MODEL_NAME)
        response = model.generate_content(prompt)
        
        return jsonify({"analysis": response.text.strip()})
        
    except Exception as e:
        print(f"Erreur Gemini Analyze: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('-port', '--port', type=int, default=5001, help='Port to run the server on')
    args = parser.parse_args()
    print(f"OK Démarrage du serveur sur le port {args.port}")
    app.run(host='0.0.0.0', port=args.port, debug=True)
