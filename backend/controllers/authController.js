const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ message: 'Incorrect email or password.' });
    if (!user.is_active) return res.status(403).json({ message: 'This account has been deactivated.' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ message: 'Incorrect email or password.' });

    // Rule 2: students registered by self-signup must be approved first.
    if (user.role === 'student' && user.approval_status === 'pending') {
      return res.status(403).json({
        message: 'Your registration is pending admin approval. Please check back soon.',
        approval_status: 'pending'
      });
    }
    if (user.approval_status === 'rejected') {
      return res.status(403).json({ message: 'Your registration was rejected. Contact your school admin.' });
    }

    const token = signToken(user);
    delete user.password_hash;

    res.json({
      token,
      user,
      must_change_password: !!user.must_change_password // Rule 6
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Login failed.', error: err.message });
  }
};

// POST /api/auth/change-password  (forced on first login for admin-created accounts)
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const user = rows[0];
    const match = await bcrypt.compare(currentPassword || '', user.password_hash);
    if (!match) return res.status(401).json({ message: 'Current password is incorrect.' });

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = ?, is_default_password = FALSE, must_change_password = FALSE WHERE id = ?',
      [hash, req.user.id]
    );
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not change password.', error: err.message });
  }
};

// POST /api/auth/forgot-password
// Generates a single-use, time-limited reset token for the given email.
// NOTE: There is no SMTP mailer configured in this build, so the plaintext
// token is returned in the response for development/testing. In production
// this token should be emailed to the user and never returned by the API.
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    const [rows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    const user = rows[0];

    if (!user) {
      // Do not reveal whether the account exists.
      return res.json({ message: 'If that email is registered, a reset link has been sent.' });
    }

    // Invalidate any outstanding tokens for this user.
    await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [user.id]);

    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(resetToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, tokenHash, expiresAt]
    );

    res.json({
      message: 'If that email is registered, a reset link has been sent.',
      reset_token: resetToken,
      expires_at: expiresAt,
      note: 'Development build: no mailer is configured, so the token is returned here. In production it would be emailed to the user.'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not create reset request.', error: err.message });
  }
};

// POST /api/auth/reset-password
// Validates the token and sets a new password.
exports.resetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
      return res.status(400).json({ message: 'Email, reset token, and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }

    const [rows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    const user = rows[0];
    if (!user) return res.status(400).json({ message: 'Invalid or expired reset token.' });

    const tokenHash = hashToken(token);
    const [tokenRows] = await pool.query(
      `SELECT id FROM password_reset_tokens
       WHERE user_id = ? AND token_hash = ? AND used_at IS NULL AND expires_at > NOW()
       ORDER BY id DESC LIMIT 1`,
      [user.id, tokenHash]
    );
    const reset = tokenRows[0];
    if (!reset) return res.status(400).json({ message: 'Invalid or expired reset token.' });

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = ?, is_default_password = FALSE, must_change_password = FALSE WHERE id = ?',
      [hash, user.id]
    );
    // Mark this token as used so it cannot be reused.
    await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?', [reset.id]);

    res.json({ message: 'Password has been reset. You can now log in with your new password.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not reset password.', error: err.message });
  }
};

// GET /api/auth/me
exports.me = async (req, res) => {
  res.json({ user: req.user });
};
