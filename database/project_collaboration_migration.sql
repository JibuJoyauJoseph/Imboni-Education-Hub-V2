-- IMBONI project collaboration workspace
-- Run after schema.sql on MySQL 8+.

USE imboni_hub;

-- Keep existing assignment uploads compatible with the lecturer portal.
SET @assignment_file_path_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assignments' AND COLUMN_NAME = 'file_path');
SET @assignment_file_path_sql = IF(@assignment_file_path_exists = 0, 'ALTER TABLE assignments ADD COLUMN file_path VARCHAR(255) NULL AFTER due_date', 'SELECT 1');
PREPARE assignment_file_path_statement FROM @assignment_file_path_sql;
EXECUTE assignment_file_path_statement;
DEALLOCATE PREPARE assignment_file_path_statement;

CREATE TABLE IF NOT EXISTS projects (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    school_id   INT NULL,
    created_by  INT NOT NULL,
    name        VARCHAR(150) NOT NULL,
    slug        VARCHAR(180) NOT NULL UNIQUE,
    description TEXT,
    status      ENUM('active','archived') NOT NULL DEFAULT 'active',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_members (
    project_id INT NOT NULL,
    user_id    INT NOT NULL,
    role       ENUM('lead','developer','designer','reviewer','member') NOT NULL DEFAULT 'member',
    joined_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, user_id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_tasks (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    project_id  INT NOT NULL,
    created_by  INT NOT NULL,
    assignee_id INT NULL,
    title       VARCHAR(200) NOT NULL,
    description TEXT,
    status      ENUM('backlog','doing','review','done') NOT NULL DEFAULT 'backlog',
    priority    ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
    due_date    DATE NULL,
    position    INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_project_tasks_status (project_id, status, position)
);

CREATE TABLE IF NOT EXISTS project_milestones (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    project_id  INT NOT NULL,
    title       VARCHAR(200) NOT NULL,
    due_date    DATE NULL,
    progress    TINYINT UNSIGNED NOT NULL DEFAULT 0,
    created_by  INT NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_reviews (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    project_id  INT NOT NULL,
    created_by  INT NOT NULL,
    title       VARCHAR(200) NOT NULL,
    description TEXT,
    status      ENUM('open','approved','changes_requested') NOT NULL DEFAULT 'open',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_review_comments (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    review_id   INT NOT NULL,
    user_id     INT NOT NULL,
    body        TEXT NOT NULL,
    file_path   VARCHAR(255),
    line_number INT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (review_id) REFERENCES project_reviews(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_commits (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    author_id  INT NOT NULL,
    branch     VARCHAR(100) NOT NULL DEFAULT 'main',
    message    VARCHAR(255) NOT NULL,
    hash       CHAR(40) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_files (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    project_id  INT NOT NULL,
    uploaded_by INT NOT NULL,
    name        VARCHAR(255) NOT NULL,
    file_path   VARCHAR(500) NOT NULL,
    mime_type   VARCHAR(150),
    size_bytes  BIGINT UNSIGNED,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_wiki_pages (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    author_id  INT NOT NULL,
    title      VARCHAR(200) NOT NULL,
    body       MEDIUMTEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Team membership requests are separate from confirmed members so a team
-- creator can approve or reject students before they join.
CREATE TABLE IF NOT EXISTS team_join_requests (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    team_id     INT NOT NULL,
    student_id  INT NOT NULL,
    status      ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    decided_at  TIMESTAMP NULL,
    decided_by  INT NULL,
    UNIQUE KEY uniq_team_join_request (team_id, student_id),
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL
);
