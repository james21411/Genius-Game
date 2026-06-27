-- Genius Jump EDU — Schéma SQLite complet

CREATE TABLE IF NOT EXISTS teachers (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    UNIQUE NOT NULL,
    password_hash TEXT    NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS classes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    name       TEXT    NOT NULL,
    code       TEXT    UNIQUE NOT NULL,
    subject    TEXT    DEFAULT 'Mathématiques',
    grade      TEXT    DEFAULT 'CM2',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS students (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id   INTEGER NOT NULL,
    name       TEXT    NOT NULL,
    avatar     INTEGER DEFAULT 0,
    xp         INTEGER DEFAULT 0,
    game_level INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS worlds (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id    INTEGER NOT NULL,
    world_index INTEGER NOT NULL,
    name        TEXT    NOT NULL,
    subject     TEXT    NOT NULL,
    topic       TEXT    NOT NULL,
    mode        TEXT    DEFAULT 'lesson',
    is_active   INTEGER DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS questions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    world_id       INTEGER,
    class_id       INTEGER,
    subject        TEXT    NOT NULL,
    topic          TEXT    NOT NULL,
    bloom_level    TEXT    DEFAULT 'knowledge',
    type           TEXT    DEFAULT 'qcm',
    question       TEXT    NOT NULL,
    answer_a       TEXT,
    answer_b       TEXT,
    answer_c       TEXT,
    answer_d       TEXT,
    correct_answer TEXT    NOT NULL,
    explanation    TEXT,
    time_limit     INTEGER DEFAULT 15,
    xp_reward      INTEGER DEFAULT 50,
    difficulty     INTEGER DEFAULT 1,
    points         INTEGER DEFAULT 1,
    extra_data     TEXT,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (world_id) REFERENCES worlds(id)  ON DELETE SET NULL,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id        INTEGER NOT NULL,
    class_id          INTEGER NOT NULL,
    world_id          INTEGER,
    game_level        INTEGER DEFAULT 1,
    mode              TEXT    DEFAULT 'lesson',
    started_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at          DATETIME,
    score             INTEGER DEFAULT 0,
    xp_gained         INTEGER DEFAULT 0,
    questions_total   INTEGER DEFAULT 0,
    questions_correct INTEGER DEFAULT 0,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id)   REFERENCES classes(id)  ON DELETE CASCADE,
    FOREIGN KEY (world_id)   REFERENCES worlds(id)   ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS answers (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id     INTEGER NOT NULL,
    question_id    INTEGER NOT NULL,
    student_id     INTEGER NOT NULL,
    given_answer   TEXT,
    is_correct     INTEGER DEFAULT 0,
    time_taken     REAL,
    attempt_number INTEGER DEFAULT 1,
    answered_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id)  REFERENCES sessions(id)  ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id)  REFERENCES students(id)  ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS badges (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    badge_type TEXT    NOT NULL,
    world_id   INTEGER,
    earned_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS question_stats (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id    INTEGER NOT NULL UNIQUE,
    class_id       INTEGER NOT NULL,
    total_attempts INTEGER DEFAULT 0,
    correct_count  INTEGER DEFAULT 0,
    avg_time       REAL    DEFAULT 0.0,
    last_updated   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id)    REFERENCES classes(id)   ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_answers_session  ON answers(session_id);
CREATE INDEX IF NOT EXISTS idx_answers_student  ON answers(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_student ON sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_class   ON sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_questions_world  ON questions(world_id);
CREATE INDEX IF NOT EXISTS idx_students_class   ON students(class_id);
