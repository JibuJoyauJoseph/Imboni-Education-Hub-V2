const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');
const emailService = require('../utils/emailService');

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const LOGIN_OTP_TTL_MS = 10 * 60 * 1000;
const LOGIN_OTP_ROLES = new Set(['platform_admin', 'school_admin', 'lecturer']);

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function hashLoginOtp(challengeId, code) {
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${challengeId}:${code}`).digest('hex');
}

function maskEmail(email) {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

function createSession(user) {
  const token = signToken(user);
  delete user.password_hash;
  return { token, user, must_change_password: !!user.must_change_password };
}

async function issueLoginOtp(user) {
  const [[{ recentCount }]] = await pool.query(
    'SELECT COUNT(*) AS recentCount FROM email_login_otps WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)',
    [user.id]
  );
  if (Number(recentCount) >= 3) return { error: 'Too many sign-in codes requested. Try again in 15 minutes.', status: 429 };

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const expiresAt = new Date(Date.now() + LOGIN_OTP_TTL_MS);
  const [result] = await pool.query(
    'INSERT INTO email_login_otps (user_id, code_hash, expires_at) VALUES (?,?,?)',
    [user.id, '0'.repeat(64), expiresAt]
  );
  const challengeId = result.insertId;
  await pool.query('UPDATE email_login_otps SET code_hash = ? WHERE id = ?', [hashLoginOtp(challengeId, code), challengeId]);

  const delivery = await emailService.sendLoginOtp({ email: user.email, name: user.full_names, code, userId: user.id, schoolId: user.school_id });
  if (!delivery.sent) {
    await pool.query('UPDATE email_login_otps SET used_at = NOW() WHERE id = ?', [challengeId]);
    return { error: 'Email sign-in is temporarily unavailable. Contact your school administrator.', status: 503 };
  }
  return { challenge_id: challengeId, email_hint: maskEmail(user.email) };
}

function genericOtpError(res) {
  return res.status(400).json({ message: 'The sign-in code is invalid or expired. Request a new code and try again.' });
}

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });

    const [rows] = await pool.query(
      `SELECT u.*, s.name AS school_name
       FROM users u LEFT JOIN schools s ON s.id = u.school_id
       WHERE u.email = ? LIMIT 1`,
      [email]
    );
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

    if (LOGIN_OTP_ROLES.has(user.role)) {
      const challenge = await issueLoginOtp(user);
      if (challenge.error) return res.status(challenge.status).json({ message: challenge.error });
      return res.json({ requires_otp: true, ...challenge });
    }

    res.json(createSession(user));
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
    await emailService.sendPasswordChanged({ email: user.email, name: user.full_names, userId: user.id, schoolId: user.school_id });
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not change password.', error: err.message });
  }
};

// POST /api/auth/forgot-password
// Generates a single-use, time-limited reset token for the given email.
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    const [rows] = await pool.query('SELECT id, email, full_names, school_id FROM users WHERE email = ? LIMIT 1', [email]);
    const user = rows[0];

    if (!user) {
      // Do not reveal whether the account exists.
      return res.json({ message: 'If that email is registered, a reset link has been sent.' });
    }

    const [[{ recentResetCount }]] = await pool.query(
      'SELECT COUNT(*) AS recentResetCount FROM password_reset_tokens WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)',
      [user.id]
    );
    if (Number(recentResetCount) >= 3) {
      return res.json({ message: 'If that email is registered, a password reset link has been sent.' });
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
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password#email=${encodeURIComponent(email)}&token=${encodeURIComponent(resetToken)}`;
    const delivery = await emailService.sendPasswordReset({ email: user.email, name: user.full_names, token: resetToken, resetLink, userId: user.id, schoolId: user.school_id });
    if (!delivery.sent) {
      await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND token_hash = ?', [user.id, tokenHash]);
    }
    res.json({ message: 'If that email is registered, a password reset link has been sent.' });
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

    const [rows] = await pool.query('SELECT id, email, full_names, school_id FROM users WHERE email = ? LIMIT 1', [email]);
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
    await emailService.sendPasswordChanged({ email: user.email, name: user.full_names, userId: user.id, schoolId: user.school_id });

    res.json({ message: 'Password has been reset. You can now log in with your new password.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not reset password.', error: err.message });
  }
};

// POST /api/auth/verify-login-otp
exports.verifyLoginOtp = async (req, res) => {
  try {
    const challengeId = Number(req.body.challenge_id);
    const code = String(req.body.code || '').trim();
    if (!Number.isSafeInteger(challengeId) || challengeId <= 0 || !/^\d{6}$/.test(code)) return genericOtpError(res);

    const [[challenge]] = await pool.query(
      `SELECT otp.id, otp.user_id, otp.code_hash, otp.expires_at, otp.used_at, otp.attempts,
              u.email, u.full_names, u.role, u.password_hash, u.must_change_password,
              u.is_active, u.approval_status
       FROM email_login_otps otp JOIN users u ON u.id = otp.user_id WHERE otp.id = ?`,
      [challengeId]
    );
    if (!challenge || challenge.used_at || new Date(challenge.expires_at) <= new Date() || challenge.attempts >= 5) return genericOtpError(res);

    const suppliedHash = hashLoginOtp(challengeId, code);
    const matches = crypto.timingSafeEqual(Buffer.from(suppliedHash, 'hex'), Buffer.from(challenge.code_hash, 'hex'));
    if (!matches) {
      await pool.query(
        'UPDATE email_login_otps SET attempts = attempts + 1, used_at = IF(attempts + 1 >= 5, NOW(), used_at) WHERE id = ? AND used_at IS NULL',
        [challengeId]
      );
      return genericOtpError(res);
    }

    const [consumeResult] = await pool.query(
      'UPDATE email_login_otps SET used_at = NOW() WHERE id = ? AND used_at IS NULL AND expires_at > NOW() AND attempts < 5',
      [challengeId]
    );
    if (!consumeResult.affectedRows) return genericOtpError(res);
    const [[user]] = await pool.query(
      `SELECT u.*, s.name AS school_name
       FROM users u LEFT JOIN schools s ON s.id = u.school_id
       WHERE u.id = ?`,
      [challenge.user_id]
    );
    if (!user?.is_active) return res.status(403).json({ message: 'This account has been deactivated.' });
    if (user.approval_status !== 'approved') return res.status(403).json({ message: 'This account is not approved.' });

    res.json(createSession(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not verify sign-in code.' });
  }
};

// POST /api/auth/resend-login-otp
exports.resendLoginOtp = async (req, res) => {
  try {
    const challengeId = Number(req.body.challenge_id);
    if (!Number.isSafeInteger(challengeId) || challengeId <= 0) return genericOtpError(res);
    const [[challenge]] = await pool.query(
      `SELECT otp.id AS challenge_id, otp.user_id, otp.created_at,
              u.email, u.full_names, u.role, u.is_active, u.school_id
       FROM email_login_otps otp JOIN users u ON u.id = otp.user_id WHERE otp.id = ?`,
      [challengeId]
    );
    if (!challenge || !challenge.is_active || !LOGIN_OTP_ROLES.has(challenge.role) || Date.now() - new Date(challenge.created_at).getTime() > 15 * 60 * 1000) return genericOtpError(res);

    await pool.query('UPDATE email_login_otps SET used_at = NOW() WHERE id = ?', [challenge.challenge_id]);
    const nextChallenge = await issueLoginOtp({
      id: challenge.user_id, email: challenge.email, full_names: challenge.full_names, school_id: challenge.school_id
    });
    if (nextChallenge.error) return res.status(nextChallenge.status).json({ message: nextChallenge.error });
    res.json({ requires_otp: true, ...nextChallenge });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not resend sign-in code.' });
  }
};

// GET /api/auth/me
exports.me = async (req, res) => {
  res.json({ user: req.user });
};
