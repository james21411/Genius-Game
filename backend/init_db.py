#!/usr/bin/env python3
"""
Genius Jump EDU — Initialisation de la base de données SQLite
+ Seed des questions par défaut (20 questions multi-matières)
"""
import sqlite3, os, hashlib, random, string

DB_PATH = os.path.join(os.path.dirname(__file__), 'geniusjump.db')
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), 'schema.sql')

def init_db():
    conn = sqlite3.connect(DB_PATH)
    with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
        conn.executescript(f.read())
    conn.commit()
    print("✅ Schéma créé.")
    return conn

def seed_teacher(conn):
    pw_hash = hashlib.sha256(b"admin1234").hexdigest()
    conn.execute("""
        INSERT OR IGNORE INTO teachers (name, email, password_hash)
        VALUES (?, ?, ?)
    """, ("Prof. Demo", "demo@geniusjump.edu", pw_hash))
    conn.commit()
    teacher_id = conn.execute("SELECT id FROM teachers WHERE email=?",
                              ("demo@geniusjump.edu",)).fetchone()[0]
    print(f"✅ Enseignant demo créé (id={teacher_id})")
    return teacher_id

def generate_code():
    return ''.join(random.choices(string.ascii_uppercase, k=4)) + '-' + \
           ''.join(random.choices(string.digits, k=4))

def seed_class(conn, teacher_id):
    code = "DEMO-2026"
    conn.execute("""
        INSERT OR IGNORE INTO classes (teacher_id, name, code, subject, grade)
        VALUES (?, ?, ?, ?, ?)
    """, (teacher_id, "Classe Démo CM2", code, "Mathématiques", "CM2"))
    conn.commit()
    class_id = conn.execute("SELECT id FROM classes WHERE code=?", (code,)).fetchone()[0]
    print(f"✅ Classe créée : {code} (id={class_id})")
    return class_id

def seed_world(conn, class_id):
    conn.execute("""
        INSERT OR IGNORE INTO worlds (class_id, world_index, name, subject, topic, mode, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (class_id, 1, "Monde des Fractions", "Mathématiques", "Fractions", "lesson", 1))
    conn.commit()
    world_id = conn.execute(
        "SELECT id FROM worlds WHERE class_id=? AND world_index=1", (class_id,)
    ).fetchone()[0]
    print(f"✅ Monde créé (id={world_id})")
    return world_id

# ─── 20 Questions par défaut ─────────────────────────────────────────────────
DEFAULT_QUESTIONS = [
    # Mathématiques — Tables
    ("Mathématiques","Tables","knowledge","qcm",
     "Combien font 7 × 8 ?","54","56","63","48","B",
     "7 × 8 = 56. Astuce : 7×4 = 28, 28×2 = 56",15,50,1),
    ("Mathématiques","Tables","knowledge","qcm",
     "Combien font 9 × 6 ?","45","52","54","63","C",
     "9 × 6 = 54. Rappel : 9 × 6 = 10×6 − 6 = 54",15,50,1),
    ("Mathématiques","Tables","comprehension","qcm",
     "Quel résultat est supérieur à 50 ?","6×8","7×7","5×9","4×12","D",
     "4×12 = 48 — attention ! En fait 6×8=48, 7×7=49, 5×9=45, 4×12=48. Aucun n'est > 50 dans cette liste. Révise !",20,80,2),
    # Mathématiques — Fractions
    ("Mathématiques","Fractions","knowledge","qcm",
     "Quel est le dénominateur de 3/4 ?","3","4","7","12","B",
     "Le dénominateur est le nombre sous la barre de fraction : ici c'est 4.",15,50,1),
    ("Mathématiques","Fractions","knowledge","qcm",
     "Quel est le numérateur de 5/8 ?","8","5","3","13","B",
     "Le numérateur est le nombre AU-DESSUS de la barre : ici c'est 5.",15,50,1),
    ("Mathématiques","Fractions","application","qcm",
     "Combien font 1/2 + 1/4 ?","1/6","3/4","2/6","1/8","B",
     "1/2 = 2/4, donc 2/4 + 1/4 = 3/4.",20,120,2),
    ("Mathématiques","Fractions","comprehension","vrai_faux",
     "1/3 est plus grand que 1/2.",None,None,None,None,"faux",
     "Plus le dénominateur est grand, plus la fraction est petite. 1/3 < 1/2.",15,80,1),
    # Français — Conjugaison
    ("Français","Conjugaison","knowledge","qcm",
     "Conjugue 'aller' à la 1ère personne du présent.","vais","allons","vont","vas","A",
     "Je VAIS à l'école. Le verbe 'aller' est irrégulier au présent.",15,50,1),
    ("Français","Conjugaison","knowledge","qcm",
     "Quel est le participe passé du verbe 'prendre' ?","prendé","prit","pris","prendu","C",
     "Le participe passé de 'prendre' est PRIS. Ex : J'ai pris mon sac.",15,50,1),
    ("Français","Conjugaison","comprehension","qcm",
     "Dans 'Nous mangeons', quel est le temps utilisé ?","Passé composé","Futur","Imparfait","Présent","D",
     "'Mangeons' est la conjugaison de 'manger' au présent de l'indicatif.",15,80,1),
    # Français — Grammaire
    ("Français","Grammaire","knowledge","qcm",
     "Quel est le nom dans la phrase : 'Le chat dort.'","Le","chat","dort","Le chat","B",
     "'Chat' est un nom commun. Il désigne un animal.",15,50,1),
    ("Français","Grammaire","knowledge","vrai_faux",
     "Un adjectif qualificatif s'accorde avec le nom qu'il accompagne.",None,None,None,None,"vrai",
     "Oui ! L'adjectif s'accorde en genre et en nombre avec le nom. Ex : une belle fleur / de belles fleurs.",15,50,1),
    ("Français","Grammaire","application","qcm",
     "Laquelle de ces phrases contient un COD ?","Je dors bien.","Il chante faux.","Elle lit un livre.","Nous courons vite.","C",
     "Dans 'Elle lit un livre', 'un livre' est le COD (Complément d'Objet Direct) du verbe 'lit'.",20,120,2),
    # Sciences
    ("Sciences","Corps humain","knowledge","qcm",
     "Combien d'os compte le corps humain adulte ?","106","206","306","406","B",
     "Le squelette adulte compte environ 206 os. À la naissance on en a environ 270 !",15,50,1),
    ("Sciences","Corps humain","knowledge","vrai_faux",
     "Le cœur est un muscle.",None,None,None,None,"vrai",
     "Oui ! Le cœur est un muscle creux appelé myocarde. Il se contracte environ 70 fois par minute.",15,50,1),
    ("Sciences","Nature","comprehension","qcm",
     "Quelle est la fonction de la chlorophylle chez les plantes ?","Transporter l'eau","Capter la lumière","Stocker les graines","Protéger les racines","B",
     "La chlorophylle est le pigment vert des plantes. Elle capte l'énergie lumineuse pour la photosynthèse.",20,80,2),
    # Histoire-Géographie
    ("Histoire-Géo","France","knowledge","qcm",
     "Quelle est la capitale de la France ?","Lyon","Marseille","Paris","Bordeaux","C",
     "Paris est la capitale de la France depuis des siècles. Elle est aussi la ville la plus peuplée du pays.",15,50,1),
    ("Histoire-Géo","France","knowledge","qcm",
     "En quelle année a eu lieu la Révolution française ?","1689","1776","1789","1815","C",
     "La Révolution française a commencé en 1789 avec la prise de la Bastille le 14 juillet.",15,50,1),
    ("Histoire-Géo","Chronologie","comprehension","qcm",
     "Quel événement a eu lieu en premier ?","La Révolution française","La Première Guerre mondiale","La découverte de l'Amérique","La Seconde Guerre mondiale","C",
     "Christophe Colomb a découvert l'Amérique en 1492. La Révolution française date de 1789.",20,80,2),
    ("Histoire-Géo","Europe","knowledge","qcm",
     "Quelle est la monnaie utilisée en France ?","Le franc","La livre","Le dollar","L'euro","D",
     "La France utilise l'euro (€) depuis 2002. Avant, c'était le franc français.",15,50,1),
]

def seed_questions(conn, world_id, class_id):
    for q in DEFAULT_QUESTIONS:
        conn.execute("""
            INSERT OR IGNORE INTO questions
            (world_id, class_id, subject, topic, bloom_level, type,
             question, answer_a, answer_b, answer_c, answer_d,
             correct_answer, explanation, time_limit, xp_reward, difficulty)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (world_id, class_id) + q)
    conn.commit()
    count = conn.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
    print(f"✅ {count} questions insérées.")

def seed_demo_student(conn, class_id):
    conn.execute("""
        INSERT OR IGNORE INTO students (class_id, name, avatar, xp, game_level)
        VALUES (?, ?, ?, ?, ?)
    """, (class_id, "Élève Demo", 0, 0, 1))
    conn.commit()
    print("✅ Élève demo créé.")

if __name__ == '__main__':
    conn = init_db()
    teacher_id = seed_teacher(conn)
    class_id   = seed_class(conn, teacher_id)
    world_id   = seed_world(conn, class_id)
    seed_questions(conn, world_id, class_id)
    seed_demo_student(conn, class_id)
    conn.close()
    print(f"\n🎉 Base de données prête : {DB_PATH}")
    print("   Code de classe démo : DEMO-2026")
