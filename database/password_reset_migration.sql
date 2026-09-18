-- =====================================================================
-- PASSWORD RESET — forgot / reset password flow
-- Adds a token store so users can reset a forgotten password.
-- Tokens are stored as SHA-256 hashes; the plaintext token is shown to
-- the user (via the API response in this dev build, since there is no
-- SMTP mailer yet). Each token expires after 30 minutes and can only
-- be used once.
-- =====================================================================

USE imboni_hub;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    token_hash  VARCHAR(64) NOT NULL,        -- SHA-256 hex of the token
    expires_at  DATETIME NOT NULL,
    used_at     TIMESTAMP NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_token_hash (token_hash),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
