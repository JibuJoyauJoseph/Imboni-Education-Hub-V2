const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { generateDefaultPassword } = require('../utils/generateCredentials');

// POST /api/admin/users
// Rule 6: Admin can add new lecturers & students directly. Account is
// created with a default password; owner must change it on first login.
exports.createUser = async (req, res) => {
  try {
    const { role, full_names, email, phone, education_level, national_id, faculty, department, program_type, trade, year_of_study } = req.body;
    if (!['lecturer', 'student'].includes(role)) {
      return res.status(400).json({ message: "Role must be 'lecturer' or 'student'." });
    }
    if (!full_names || !email) return res.status(400).json({ message: 'Full names and email are required.' });

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ message: 'An account with this email already exists.' });

    const defaultPassword = generateDefaultPassword();
    const hash = await bcrypt.hash(defaultPassword, 10);
    const schoolId = req.user.school_id; // school_admin can only create for their own school

    const [result] = await pool.query(
      `INSERT INTO users (school_id, role, full_names, email, phone, password_hash,
                           is_default_password, must_change_password, approval_status,
                           approved_by, approved_at)
       VALUES (?,?,?,?,?,?,TRUE,TRUE,'approved',?,NOW())`,
      [schoolId, role, full_names, email, phone || null, hash, req.user.id]
    );
    const userId = result.insertId;

    if (role === 'student') {
      await pool.query(
        `INSERT INTO student_profiles (user_id, education_level, national_id, faculty, department, program_type, trade, year_of_study)
         VALUES (?,?,?,?,?,?,?,?)`,
        [userId, education_level || 'university', national_id || null, faculty || null, department || null, program_type || null, trade || null, year_of_study || null]
      );
      await pool.query('INSERT INTO kanban_boards (student_id) VALUES (?)', [userId]);
    }

    res.status(201).json({
      message: `${role === 'lecturer' ? 'Lecturer' : 'Student'} account created.`,
      credentials: { email, default_password: defaultPassword },
      user_id: userId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not create account.', error: err.message });
  }
};

// GET /api/admin/students/pending
exports.listPendingStudents = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.full_names, u.email, u.created_at,
              sp.education_level, sp.trade, sp.year_of_study, sp.faculty, sp.department, sp.program_type
       FROM users u LEFT JOIN student_profiles sp ON sp.user_id = u.id
       WHERE u.school_id = ? AND u.role = 'student' AND u.approval_status = 'pending'
       ORDER BY u.created_at ASC`,
      [req.user.school_id]
    );
    res.json({ pending_students: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load pending students.', error: err.message });
  }
};

// PATCH /api/admin/students/:id/approve
// Rule 2 & 3: admin approves/rejects new student accounts.
exports.decideStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { decision } = req.body; // 'approved' | 'rejected'
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ message: "Decision must be 'approved' or 'rejected'." });
    }
    const [[student]] = await pool.query(
      'SELECT * FROM users WHERE id = ? AND school_id = ? AND role = "student"',
      [id, req.user.school_id]
    );
    if (!student) return res.status(404).json({ message: 'Student not found in your school.' });

    await pool.query(
      'UPDATE users SET approval_status = ?, approved_by = ?, approved_at = NOW() WHERE id = ?',
      [decision, req.user.id, id]
    );
    await pool.query(
      'INSERT INTO notifications (user_id, title, body) VALUES (?,?,?)',
      [id, decision === 'approved' ? 'Account approved' : 'Account rejected',
        decision === 'approved'
          ? 'Your account has been approved. You can now log in and access your dashboard.'
          : 'Your registration was rejected. Please contact your school admin.']
    );

    res.json({ message: `Student ${decision}.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not update student status.', error: err.message });
  }
};

// GET /api/admin/users  (roster for the school)
exports.listSchoolUsers = async (req, res) => {
  try {
    const { role } = req.query;
    let sql = 'SELECT id, role, full_names, email, phone, approval_status, is_active, is_default_password, created_at FROM users WHERE school_id = ?';
    const params = [req.user.school_id];
    if (role) { sql += ' AND role = ?'; params.push(role); }
    sql += ' ORDER BY created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json({ users: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load users.', error: err.message });
  }
};

// PATCH /api/admin/users/:id/deactivate
exports.setUserActive = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    await pool.query('UPDATE users SET is_active = ? WHERE id = ? AND school_id = ?', [!!is_active, id, req.user.school_id]);
    res.json({ message: `User ${is_active ? 'activated' : 'deactivated'}.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not update user.', error: err.message });
  }
};
