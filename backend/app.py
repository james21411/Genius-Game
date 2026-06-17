from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import os
import hashlib
import random
import string
import json
import google.generativeai as genai
import PyPDF2
import io

app = Flask(__name__)
CORS(app)

# --- CONFIGURATION GEMINI ---
# Remplacez par votre clé API réelle ou définissez GEMINI_API_KEY en variable d'env
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', 'AIzaSyCOdhbViNV4LefjSatAbSozn9iAS-xKtOo')
GEMINI_MODEL_NAME = os.environ.get('GEMINI_MODEL_NAME', 'gemini-pro-latest')
genai.configure(api_key=GEMINI_API_KEY)



DB_PATH = os.path.join(os.path.dirname(__file__), 'geniusjump.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

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
    
    if not teacher_id or not name:
        return jsonify({"error": "Nom de classe requis"}), 400
    
    code = generate_class_code()
    
    conn = get_db()
    conn.execute("INSERT INTO classes (teacher_id, name, code, subject, grade) VALUES (?, ?, ?, ?, ?)",
                 (teacher_id, name, code, subject, grade))
    conn.commit()
    class_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    
    return jsonify({"class_id": class_id, "code": code}), 201

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
    
    if not class_id or not name or not topic:
        return jsonify({"error": "Données manquantes"}), 400
    
    conn = get_db()
    # Trouver le dernier index de monde
    last_idx = conn.execute("SELECT MAX(world_index) FROM worlds WHERE class_id = ?", (class_id,)).fetchone()[0] or 0
    
    conn.execute("""
        INSERT INTO worlds (class_id, world_index, name, subject, topic, mode, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (class_id, last_idx + 1, name, subject, topic, 'lesson', 1))
    conn.commit()
    world_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    
    return jsonify({"world_id": world_id}), 201

# --- GAME API (Existing logic) ---

@app.route('/api/students/join', methods=['POST'])
def join_class():
    data = request.json
    name = data.get('name')
    code = data.get('code')
    
    conn = get_db()
    class_row = conn.execute("SELECT id FROM classes WHERE code = ?", (code,)).fetchone()
    if not class_row:
        conn.close()
        return jsonify({"error": "Code de classe invalide"}), 404
    
    class_id = class_row['id']
    student = conn.execute("SELECT id, class_id FROM students WHERE name = ? AND class_id = ?", (name, class_id)).fetchone()
    
    if not student:
        conn.execute("INSERT INTO students (class_id, name) VALUES (?, ?)", (class_id, name))
        conn.commit()
        student = conn.execute("SELECT id, class_id FROM students WHERE name = ? AND class_id = ?", (name, class_id)).fetchone()
    
    conn.close()
    return jsonify(dict(student))

@app.route('/api/questions', methods=['GET'])
def get_questions():
    class_id = request.args.get('class_id')
    world_id = request.args.get('world_id')
    
    conn = get_db()
    if world_id:
        questions = conn.execute("SELECT * FROM questions WHERE world_id = ?", (world_id,)).fetchall()
    elif class_id:
        questions = conn.execute("SELECT * FROM questions WHERE class_id = ?", (class_id,)).fetchall()
    else:
        questions = conn.execute("SELECT * FROM questions LIMIT 20").fetchall()
    conn.close()
    return jsonify([dict(row) for row in questions])

@app.route('/api/questions', methods=['POST'])
def add_question():
    data = request.json
    conn = get_db()
    conn.execute("""
        INSERT INTO questions (world_id, class_id, type, subject, topic, bloom_level, question, 
                             answer_a, answer_b, answer_c, answer_d, correct_answer, explanation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (data.get('world_id'), data.get('class_id'), data.get('type', 'qcm'), data.get('subject'), data.get('topic'),
          data.get('bloom_level'), data.get('question'), data.get('answer_a'), data.get('answer_b'),
          data.get('answer_c'), data.get('answer_d'), data.get('correct_answer'), data.get('explanation')))
    conn.commit()
    conn.close()
    return jsonify({"message": "Question ajoutée"}), 201

# --- ANALYTICS ---

@app.route('/api/stats', methods=['GET'])
def get_stats():
    class_id = request.args.get('class_id')
    if not class_id:
        return jsonify({"error": "ID de classe requis"}), 400
    
    conn = get_db()
    students = conn.execute("SELECT id, name, xp, game_level FROM students WHERE class_id = ?", (class_id,)).fetchall()
    
    # Heatmap (Succès par question)
    heatmap = conn.execute("""
        SELECT q.question, q.topic, q.difficulty,
               CAST(COUNT(CASE WHEN a.is_correct = 1 THEN 1 END) AS FLOAT) / COUNT(*) * 100 as success_rate
        FROM questions q
        JOIN answers a ON q.id = a.question_id
        WHERE q.class_id = ?
        GROUP BY q.id
    """, (class_id,)).fetchall()
    
    conn.close()
    return jsonify({
        "summary": {
            "active_students": len(students),
            "class_avg": round(sum(h['success_rate'] for h in heatmap) / len(heatmap), 1) if heatmap else 0
        },
        "students": [dict(s) for s in students],
        "heatmap": [dict(h) for h in heatmap]
    })

@app.route('/api/ai/generate', methods=['POST'])
def ai_generate():
    # Avec FormData, les données sont dans request.form et les fichiers dans request.files
    context = request.form.get('context', '')
    num = int(request.form.get('num', 5))
    class_id = request.form.get('class_id')
    world_id = request.form.get('world_id')
    bloom = request.form.get('bloom', 'knowledge')
    
    # Extraction de texte si un fichier est fourni
    file = request.files.get('file')
    if file:
        filename = file.filename.lower()
        if filename.endswith('.pdf'):
            try:
                reader = PyPDF2.PdfReader(io.BytesIO(file.read()))
                extracted_text = ""
                for page in reader.pages:
                    extracted_text += page.extract_text() + "\n"
                context = extracted_text + "\n" + context
            except Exception as e:
                return jsonify({"error": f"Erreur lecture PDF: {str(e)}"}), 400
        elif filename.endswith('.txt'):
            context = file.read().decode('utf-8') + "\n" + context

    if not context.strip():
        return jsonify({"error": "Aucun contenu à analyser"}), 400

    # --- APPEL RÉEL GEMINI ---
    prompt = f"""
    En tant qu'expert pédagogique, génère {num} questions éducatives à partir du support suivant :
    "{context}"
    
    Paramètres :
    - Niveau Bloom ciblé : {bloom}
    - Format : JSON uniquement
    - Champs requis par question : topic, bloom_level, question, answer_a, answer_b, answer_c, answer_d, correct_answer (A/B/C/D), explanation.
    
    Réponds EXCLUSIVEMENT avec un tableau JSON valide.
    """
    
    try:
        model = genai.GenerativeModel(GEMINI_MODEL_NAME)
        response = model.generate_content(prompt)
        # Nettoyage du texte (Gemini peut mettre des backticks markdown)
        json_text = response.text.replace('```json', '').replace('```', '').strip()
        generated_questions = json.loads(json_text)
        
        db = get_db()
        questions_added = 0
        for q in generated_questions:
            db.execute('''
                INSERT INTO questions (class_id, world_id, type, subject, topic, bloom_level, question, 
                                     answer_a, answer_b, answer_c, answer_d, correct_answer, explanation)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (class_id, world_id, 'qcm', 'IA Gemini', q.get('topic'), bloom, q.get('question'), 
                  q.get('answer_a'), q.get('answer_b'), q.get('answer_c'), q.get('answer_d'), 
                  q.get('correct_answer', 'A'), q.get('explanation')))
            questions_added += 1
        
        db.commit()
        return jsonify({"count": questions_added, "message": "Questions forgées par Gemini"})
    except Exception as e:
        return jsonify({"error": f"Erreur Gemini: {str(e)}"}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
