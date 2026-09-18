const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Verifies the JWT and attaches the current user row to req.user.
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Not authenticated. Please log in.' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [payload.id]);
    const user = rows[0];
    if (!user) return res.status(401).json({ message: 'Account not found.' });
    if (!user.is_active) return res.status(403).json({ message: 'This account has been deactivated.' });

    delete user.password_hash;
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Session expired or invalid. Please log in again.' });
  }
}

// Rule 2: every student that registers waits for admin approval before
// they can use anything beyond their pending-approval screen.
function requireApproved(req, res, next) {
  if (req.user.approval_status !== 'approved') {
    return res.status(403).json({
      message: 'Your account is awaiting admin approval. You will get access once approved.'
    });
  }
  next();
}

// Role-gate factory, e.g. requireRole('school_admin','platform_admin')
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to do that.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireApproved, requireRole };
