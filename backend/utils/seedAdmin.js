require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function seedAdmin() {
  const email = process.env.PLATFORM_ADMIN_EMAIL || 'admin@imboni.rw';
  const name = process.env.PLATFORM_ADMIN_NAME || 'IMBONI Platform Admin';
  const password = process.env.PLATFORM_ADMIN_PASSWORD || '';
  if (password.length < 16 || password === 'ChangeMe123!') {
    throw new Error('Set PLATFORM_ADMIN_PASSWORD to a unique value of at least 16 characters.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [[existing]] = await pool.query('SELECT id, role FROM users WHERE email = ? LIMIT 1', [email]);
  if (existing && existing.role !== 'platform_admin') {
    throw new Error('The configured platform admin email belongs to a non-platform account.');
  }

  if (existing) {
    await pool.query(
      `UPDATE users SET full_names = ?, password_hash = ?, is_default_password = FALSE,
       must_change_password = TRUE, is_active = TRUE, approval_status = 'approved'
       WHERE id = ?`,
      [name, passwordHash, existing.id]
    );
  } else {
    await pool.query(
      `INSERT INTO users (school_id, role, full_names, email, password_hash,
                          is_default_password, must_change_password, approval_status)
       VALUES (NULL, 'platform_admin', ?, ?, ?, FALSE, TRUE, 'approved')`,
      [name, email, passwordHash]
    );
  }

  console.log(`Platform admin ${email} is ready; the password was not displayed.`);
}

seedAdmin()
  .catch(error => {
    console.error('Could not bootstrap platform admin:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());