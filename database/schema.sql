cd-- =====================================================================
-- IMBONI EDUCATION HUB — DATABASE SCHEMA
-- Rebuilt to match the handwritten system spec (Aug 2026)
-- MySQL 8+
-- =====================================================================

CREATE DATABASE IF NOT EXISTS imboni_hub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE imboni_hub;

-- ---------------------------------------------------------------------
-- 1. SCHOOLS  (Website -> Sch1, Sch2, Sch3 ... registered by admin)
--    Rule 5: schools pay 50,000 RWF every 3 months so their students
--    can use the platform for free.
-- ---------------------------------------------------------------------
CREATE TABLE schools (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    name                VARCHAR(150) NOT NULL,
    school_type         ENUM('secondary','university') NOT NULL,
    address             VARCHAR(255),
    contact_email       VARCHAR(150),
    contact_phone       VARCHAR(30),
    subscription_status ENUM('active','expired','pending') NOT NULL DEFAULT 'pending',
    subscription_fee    DECIMAL(10,2) NOT NULL DEFAULT 50000.00, -- RWF, per 3-month cycle
    current_period_start DATE,
    current_period_end   DATE,
    registered_by       INT NULL,          -- platform admin who registered the school
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Billing history — one row per 3-month subscription cycle (Rule 5)
CREATE TABLE subscription_payments (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    school_id       INT NOT NULL,
    amount          DECIMAL(10,2) NOT NULL DEFAULT 50000.00,
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    status          ENUM('pending','paid','overdue') NOT NULL DEFAULT 'pending',
    paid_at         TIMESTAMP NULL,
    recorded_by     INT NULL,              -- admin who marked it paid
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 2. USERS  (platform_admin, admin(school-level), lecturer, student)
--    Rule 6: admin creates lecturer/student accounts with a default
--    name + password, changed on first login.
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    school_id           INT NULL,          -- NULL only for platform_admin
    role                ENUM('platform_admin','school_admin','lecturer','student') NOT NULL,
    full_names          VARCHAR(150) NOT NULL,
    email               VARCHAR(150) UNIQUE NOT NULL,
    phone               VARCHAR(30),
    password_hash       VARCHAR(255) NOT NULL,
    is_default_password BOOLEAN NOT NULL DEFAULT FALSE,  -- Rule 6: force change on first login
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,

    -- Rule 2: every student that registers waits for admin approval.
    approval_status     ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved',
    approved_by         INT NULL,
    approved_at         TIMESTAMP NULL,

    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 2B. PASSWORD RESET TOKENS  (forgot / reset password flow)
--     Tokens are hashed; each is single-use and expires after 30 min.
-- ---------------------------------------------------------------------
CREATE TABLE password_reset_tokens (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    token_hash  VARCHAR(64) NOT NULL,        -- SHA-256 hex of the token
    expires_at  DATETIME NOT NULL,
    used_at     TIMESTAMP NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_token_hash (token_hash),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 3. STUDENT PROFILES
--    Rule 7 + registration branching:
--    University student  -> full names, ID, faculty, department,
--                            program (day/evening/weekend/in-service), uni name
--    Secondary student    -> school name, full names, trade, year of study
--    A student belongs to exactly ONE school's space (enforced via users.school_id,
--    which is set once at approval and never changed).
-- ---------------------------------------------------------------------
CREATE TABLE student_profiles (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    user_id             INT NOT NULL UNIQUE,
    education_level     ENUM('university','secondary') NOT NULL,

    -- University branch
    national_id         VARCHAR(50),
    faculty             VARCHAR(150),
    department          VARCHAR(150),
    program_type        ENUM('day','evening','weekend','in_service') NULL,

    -- Secondary branch
    trade                VARCHAR(150),   -- e.g. Software Development, Electrical, etc.
    year_of_study        VARCHAR(20),    -- e.g. "Year 3"

    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 4. COURSES  (owned by a lecturer, scoped to a school)
-- ---------------------------------------------------------------------
CREATE TABLE courses (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    school_id       INT NOT NULL,
    lecturer_id     INT NOT NULL,
    name            VARCHAR(150) NOT NULL,
    code            VARCHAR(30),
    description     TEXT,
    trade_or_program VARCHAR(150),   -- helps students find "the one they belong to"
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (lecturer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 5. COURSE JOIN REQUESTS
--    Rule 8: student clicks "Join" on the course/lecturer he belongs to;
--    request goes to the LECTURER for approval. Rule 8 also states a
--    student will not register multiple times to different courses
--    carelessly — he requests, gets approved, then sees teams/resources.
-- ---------------------------------------------------------------------
CREATE TABLE course_join_requests (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    student_id      INT NOT NULL,
    course_id       INT NOT NULL,
    status          ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    requested_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    decided_by      INT NULL,        -- lecturer
    decided_at      TIMESTAMP NULL,
    UNIQUE KEY uniq_student_course (student_id, course_id),
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Confirmed enrollments (created automatically once a join request is approved)
CREATE TABLE enrollments (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    student_id      INT NOT NULL,
    course_id       INT NOT NULL,
    enrolled_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_enrollment (student_id, course_id),
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 6. TEAMS  (students "form teams to do groupworks")
-- ---------------------------------------------------------------------
CREATE TABLE teams (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    course_id       INT NOT NULL,
    name            VARCHAR(150) NOT NULL,
    created_by      INT NOT NULL,      -- student who formed the team
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE team_members (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    team_id         INT NOT NULL,
    student_id      INT NOT NULL,
    joined_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_team_member (team_id, student_id),
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Team join requests require approval from the team creator or lecturer.
CREATE TABLE team_join_requests (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    team_id         INT NOT NULL,
    student_id      INT NOT NULL,
    status          ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    requested_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    decided_at      TIMESTAMP NULL,
    decided_by      INT NULL,
    UNIQUE KEY uniq_team_join_request (team_id, student_id),
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
-- 7. RESOURCES / NOTES  (lecturer shares notes -> students access free)
-- ---------------------------------------------------------------------
CREATE TABLE resources (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    course_id       INT NOT NULL,
    uploaded_by     INT NOT NULL,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    file_path       VARCHAR(255),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 7B. PLATFORM FREE RESOURCES
--     Free IT learning resources published by the platform admin for all
--     approved students, regardless of their school or enrollment.
-- ---------------------------------------------------------------------
CREATE TABLE platform_resources (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    title           VARCHAR(200) NOT NULL,
    category        VARCHAR(100) NOT NULL,
    description     TEXT,
    file_path       VARCHAR(255),
    resource_url    VARCHAR(500),
    published       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      INT NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 8. ASSIGNMENTS + SUBMISSIONS + GRADEBOOK
-- ---------------------------------------------------------------------
CREATE TABLE assignments (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    course_id       INT NOT NULL,
    created_by      INT NOT NULL,
    title           VARCHAR(200) NOT NULL,
    instructions    TEXT,
    max_score       DECIMAL(6,2) NOT NULL DEFAULT 100,
    due_date        DATETIME,
    file_path       VARCHAR(255),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE submissions (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id   INT NOT NULL,
    student_id      INT NOT NULL,
    file_path       VARCHAR(255),
    submitted_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    score           DECIMAL(6,2) NULL,
    feedback        TEXT,
    graded_by       INT NULL,
    graded_at       TIMESTAMP NULL,
    UNIQUE KEY uniq_submission (assignment_id, student_id),
    FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 9. QUIZZES  (lecturer sets quiz, system auto-grades)
-- ---------------------------------------------------------------------
CREATE TABLE quizzes (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    course_id       INT NOT NULL,
    created_by      INT NOT NULL,
    title           VARCHAR(200) NOT NULL,
    time_limit_minutes INT DEFAULT 30,
    open_at         DATETIME,
    close_at        DATETIME,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE quiz_questions (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    quiz_id         INT NOT NULL,
    question_text   TEXT NOT NULL,
    question_type   ENUM('mcq','true_false') NOT NULL DEFAULT 'mcq',
    points          DECIMAL(5,2) NOT NULL DEFAULT 1,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

CREATE TABLE quiz_options (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    question_id     INT NOT NULL,
    option_text     VARCHAR(255) NOT NULL,
    is_correct      BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE
);

CREATE TABLE quiz_attempts (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    quiz_id         INT NOT NULL,
    student_id      INT NOT NULL,
    started_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submitted_at    TIMESTAMP NULL,
    auto_score      DECIMAL(6,2) NULL,   -- computed instantly on submit
    max_score       DECIMAL(6,2) NULL,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE quiz_attempt_answers (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    attempt_id      INT NOT NULL,
    question_id     INT NOT NULL,
    selected_option_id INT NULL,
    is_correct      BOOLEAN,
    FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE,
    FOREIGN KEY (selected_option_id) REFERENCES quiz_options(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
-- 10. LIVE SESSIONS + ATTENDANCE  (lecturer hosts live sessions, tracks attendance)
-- ---------------------------------------------------------------------
CREATE TABLE live_sessions (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    course_id       INT NOT NULL,
    hosted_by       INT NOT NULL,
    title           VARCHAR(200) NOT NULL,
    meeting_link    VARCHAR(255),
    scheduled_at    DATETIME NOT NULL,
    duration_minutes INT DEFAULT 60,
    status          ENUM('scheduled','live','ended','cancelled') DEFAULT 'scheduled',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (hosted_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE attendance_records (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    session_id      INT NOT NULL,
    student_id      INT NOT NULL,
    status          ENUM('present','absent','late') NOT NULL DEFAULT 'present',
    marked_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_attendance (session_id, student_id),
    FOREIGN KEY (session_id) REFERENCES live_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 11. DISCUSSION FORUMS  (students can host discussion forums)
-- ---------------------------------------------------------------------
CREATE TABLE forum_threads (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    course_id       INT NOT NULL,
    created_by      INT NOT NULL,
    title           VARCHAR(200) NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE forum_posts (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    thread_id       INT NOT NULL,
    posted_by       INT NOT NULL,
    body            TEXT NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (thread_id) REFERENCES forum_threads(id) ON DELETE CASCADE,
    FOREIGN KEY (posted_by) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 12. KANBAN DASHBOARD  (per-student personal board across all courses)
-- ---------------------------------------------------------------------
CREATE TABLE kanban_boards (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    student_id      INT NOT NULL UNIQUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE kanban_tasks (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    board_id        INT NOT NULL,
    course_id       INT NULL,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    status          ENUM('todo','in_progress','done') NOT NULL DEFAULT 'todo',
    due_date        DATE NULL,
    position         INT DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES kanban_boards(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
-- 13. AI TUTOR  (per-student conversation history)
-- ---------------------------------------------------------------------
CREATE TABLE ai_tutor_conversations (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    student_id      INT NOT NULL,
    course_id       INT NULL,
    title           VARCHAR(200) DEFAULT 'New chat',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
);

CREATE TABLE ai_tutor_messages (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    sender          ENUM('student','ai') NOT NULL,
    message         TEXT NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES ai_tutor_conversations(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 14. NOTIFICATIONS  (approval results, join-request decisions, etc.)
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    title           VARCHAR(200) NOT NULL,
    body            TEXT,
    is_read         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- Seed: one platform admin (password should be reset immediately)
-- password hash below = bcrypt("ChangeMe123!") — placeholder, regenerate in prod
-- ---------------------------------------------------------------------
INSERT INTO users (school_id, role, full_names, email, password_hash, is_default_password, approval_status)
VALUES (NULL, 'platform_admin', 'IMBONI Platform Admin', 'admin@imboni.rw',
    '$2a$10$e/SOM7B9G56YyZUVG7Uab.TU8ml2kdFMTSJb/JgL2lUDjLTUZ5tbG', TRUE, 'approved');

-- Starter catalog for Rwanda-relevant IT learning. Add files or links from
-- the platform admin dashboard as the content becomes available.
INSERT INTO platform_resources (title, category, description, created_by)
SELECT catalog.title, catalog.category, catalog.description, u.id
FROM (
    SELECT 'Computer Fundamentals' AS title, 'Digital Skills' AS category, 'Computer hardware, operating systems, files, productivity, and safe internet use.' AS description
    UNION ALL SELECT 'Office Productivity', 'Digital Skills', 'Word processing, spreadsheets, presentations, email, and collaborative work.'
    UNION ALL SELECT 'Programming Fundamentals', 'Programming', 'Logic, algorithms, problem solving, Git, and introduction to software development.'
    UNION ALL SELECT 'Python Programming', 'Programming', 'Python syntax, functions, object-oriented programming, and practical automation.'
    UNION ALL SELECT 'JavaScript and Web Development', 'Programming', 'Modern JavaScript, browser APIs, responsive HTML, and CSS.'
    UNION ALL SELECT 'React Frontend Development', 'Software Development', 'Components, state, routing, forms, and accessible React applications.'
    UNION ALL SELECT 'Backend Development with Node.js', 'Software Development', 'Express APIs, authentication, validation, and production backend patterns.'
    UNION ALL SELECT 'Mobile App Development', 'Software Development', 'Mobile UX and application development with cross-platform tools.'
    UNION ALL SELECT 'Data Structures and Algorithms', 'Computer Science', 'Core data structures, algorithm analysis, and interview problem solving.'
    UNION ALL SELECT 'Computer Networking', 'Networking', 'TCP/IP, addressing, routing, switching, wireless, and network troubleshooting.'
    UNION ALL SELECT 'CCNA Preparation', 'Networking', 'Cisco fundamentals, VLANs, routing protocols, WANs, and network security basics.'
    UNION ALL SELECT 'Linux System Administration', 'Systems', 'Linux commands, users, permissions, services, shell scripting, and server operations.'
    UNION ALL SELECT 'Windows Server Administration', 'Systems', 'Active Directory, networking services, policies, and Windows server management.'
    UNION ALL SELECT 'Cybersecurity Fundamentals', 'Cybersecurity', 'Threats, vulnerabilities, security controls, risk, and defensive practices.'
    UNION ALL SELECT 'Ethical Hacking', 'Cybersecurity', 'Reconnaissance, vulnerability assessment, secure testing, and responsible disclosure.'
    UNION ALL SELECT 'Digital Forensics', 'Cybersecurity', 'Evidence handling, incident response, log analysis, and forensic investigation.'
    UNION ALL SELECT 'Database Design and SQL', 'Data and Databases', 'Relational modeling, SQL queries, normalization, and transactions.'
    UNION ALL SELECT 'MySQL Database Administration', 'Data and Databases', 'MySQL setup, users, backups, indexing, performance, and recovery.'
    UNION ALL SELECT 'Data Analysis with Excel', 'Data and Analytics', 'Formulas, pivot tables, dashboards, and decision-making with data.'
    UNION ALL SELECT 'Data Analysis with Python', 'Data and Analytics', 'Pandas, NumPy, visualization, cleaning, and reproducible analysis.'
    UNION ALL SELECT 'Artificial Intelligence and Machine Learning', 'AI and Emerging Tech', 'AI concepts, supervised learning, evaluation, and responsible use.'
    UNION ALL SELECT 'Cloud Computing Fundamentals', 'Cloud and DevOps', 'Cloud concepts, service models, deployment, identity, and cost awareness.'
    UNION ALL SELECT 'DevOps and CI/CD', 'Cloud and DevOps', 'Git workflows, automated testing, pipelines, containers, and deployment.'
    UNION ALL SELECT 'UI/UX and Product Design', 'Design', 'User research, wireframes, usability, prototyping, and inclusive design.'
    UNION ALL SELECT 'IT Project Management', 'Professional Skills', 'Agile methods, planning, documentation, teamwork, and delivery.'
    UNION ALL SELECT 'Technical Support and IT Service Management', 'Professional Skills', 'Troubleshooting, help desk practice, service management, and documentation.'
) AS catalog
CROSS JOIN users u
WHERE u.email = 'admin@imboni.rw';

UPDATE platform_resources SET resource_url = CASE title
    WHEN 'Computer Fundamentals' THEN 'https://learn.microsoft.com/training/browse/?terms=computer%20basics'
    WHEN 'Office Productivity' THEN 'https://support.microsoft.com/training'
    WHEN 'Programming Fundamentals' THEN 'https://www.kaggle.com/learn/intro-to-programming'
    WHEN 'Python Programming' THEN 'https://www.kaggle.com/learn/python'
    WHEN 'JavaScript and Web Development' THEN 'https://developer.mozilla.org/en-US/docs/Learn_web_development'
    WHEN 'React Frontend Development' THEN 'https://www.freecodecamp.org/learn/front-end-development-libraries-v9/'
    WHEN 'Backend Development with Node.js' THEN 'https://www.freecodecamp.org/learn/back-end-development-and-apis-v9/'
    WHEN 'Mobile App Development' THEN 'https://developer.android.com/courses'
    WHEN 'Data Structures and Algorithms' THEN 'https://www.freecodecamp.org/learn/coding-interview-prep/'
    WHEN 'Computer Networking' THEN 'https://www.netacad.com/courses/networking'
    WHEN 'CCNA Preparation' THEN 'https://www.netacad.com/courses/ccna'
    WHEN 'Linux System Administration' THEN 'https://www.freecodecamp.org/news/learn-linux-for-beginners-book-basic-to-advanced/'
    WHEN 'Windows Server Administration' THEN 'https://learn.microsoft.com/training/browse/?terms=Windows%20Server'
    WHEN 'Cybersecurity Fundamentals' THEN 'https://skillsbuild.org/students/course-catalog/cybersecurity'
    WHEN 'Ethical Hacking' THEN 'https://www.coursera.org/browse/information-technology/cybersecurity'
    WHEN 'Digital Forensics' THEN 'https://www.coursera.org/browse/information-technology/cybersecurity'
    WHEN 'Database Design and SQL' THEN 'https://www.kaggle.com/learn/intro-to-sql'
    WHEN 'MySQL Database Administration' THEN 'https://dev.mysql.com/doc/'
    WHEN 'Data Analysis with Excel' THEN 'https://support.microsoft.com/training'
    WHEN 'Data Analysis with Python' THEN 'https://www.kaggle.com/learn/pandas'
    WHEN 'Artificial Intelligence and Machine Learning' THEN 'https://www.kaggle.com/learn/intro-to-machine-learning'
    WHEN 'Cloud Computing Fundamentals' THEN 'https://learn.microsoft.com/training/'
    WHEN 'DevOps and CI/CD' THEN 'https://www.freecodecamp.org/news/learn-continuous-integration-delivery-and-deployment/'
    WHEN 'UI/UX and Product Design' THEN 'https://www.coursera.org/learn/foundations-user-experience-design'
    WHEN 'IT Project Management' THEN 'https://skillsbuild.org/learn-with-ibm-bob'
    WHEN 'Technical Support and IT Service Management' THEN 'https://skillsbuild.org/learning-catalog'
    ELSE resource_url
END
WHERE resource_url IS NULL;
