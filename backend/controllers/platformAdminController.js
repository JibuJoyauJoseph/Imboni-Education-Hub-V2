const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { generateDefaultPassword } = require('../utils/generateCredentials');

// POST /api/platform/schools
// "Website -> Sch1, Sch2, Sch3 ... -> Admin registers school -> School is registered"
// Also creates that school's first school_admin account with default credentials.
exports.registerSchool = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { name, school_type, address, contact_email, contact_phone, admin_full_names, admin_email } = req.body;
    if (!name || !school_type || !admin_full_names || !admin_email) {
      return res.status(400).json({ message: 'School name, type, and school admin details are required.' });
    }
    if (!['secondary', 'university'].includes(school_type)) {
      return res.status(400).json({ message: "school_type must be 'secondary' or 'university'." });
    }

    await conn.beginTransaction();

    const periodStart = new Date();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 3); // Rule 5: 3-month cycle

    const [schoolResult] = await conn.query(
      `INSERT INTO schools (name, school_type, address, contact_email, contact_phone,
                             subscription_status, subscription_fee, current_period_start, current_period_end, registered_by)
       VALUES (?,?,?,?,?, 'pending', 50000.00, ?, ?, ?)`,
      [name, school_type, address || null, contact_email || null, contact_phone || null,
        periodStart.toISOString().slice(0, 10), periodEnd.toISOString().slice(0, 10), req.user.id]
    );
    const schoolId = schoolResult.insertId;

    await conn.query(
      `INSERT INTO subscription_payments (school_id, amount, period_start, period_end, status)
       VALUES (?, 50000.00, ?, ?, 'pending')`,
      [schoolId, periodStart.toISOString().slice(0, 10), periodEnd.toISOString().slice(0, 10)]
    );

    const defaultPassword = generateDefaultPassword();
    const hash = await bcrypt.hash(defaultPassword, 10);
    const [adminResult] = await conn.query(
      `INSERT INTO users (school_id, role, full_names, email, password_hash,
                           is_default_password, must_change_password, approval_status, approved_by, approved_at)
       VALUES (?, 'school_admin', ?, ?, ?, TRUE, TRUE, 'approved', ?, NOW())`,
      [schoolId, admin_full_names, admin_email, hash, req.user.id]
    );

    await conn.commit();
    res.status(201).json({
      message: `${name} registered. Subscription is pending payment (50,000 RWF / 3 months).`,
      school_id: schoolId,
      school_admin_credentials: { email: admin_email, default_password: defaultPassword, user_id: adminResult.insertId }
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Could not register school.', error: err.message });
  } finally {
    conn.release();
  }
};

// GET /api/platform/schools
exports.listSchools = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.*,
              (SELECT COUNT(*) FROM users u WHERE u.school_id = s.id AND u.role='student' AND u.approval_status='approved') AS active_students,
              (SELECT COUNT(*) FROM users u WHERE u.school_id = s.id AND u.role='lecturer') AS lecturer_count
       FROM schools s ORDER BY s.created_at DESC`
    );
    res.json({ schools: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load schools.', error: err.message });
  }
};

// POST /api/platform/schools/:id/payments
// Rule 5: record a 50,000 RWF payment, extend subscription by 3 months, unlock access.
exports.recordPayment = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const [[school]] = await conn.query('SELECT * FROM schools WHERE id = ?', [id]);
    if (!school) return res.status(404).json({ message: 'School not found.' });

    const base = school.current_period_end && new Date(school.current_period_end) > new Date()
      ? new Date(school.current_period_end)
      : new Date();
    const newStart = new Date(base);
    const newEnd = new Date(base);
    newEnd.setMonth(newEnd.getMonth() + 3);

    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO subscription_payments (school_id, amount, period_start, period_end, status, paid_at, recorded_by)
       VALUES (?,?,?,?, 'paid', NOW(), ?)`,
      [id, amount || 50000.00, newStart.toISOString().slice(0, 10), newEnd.toISOString().slice(0, 10), req.user.id]
    );
    await conn.query(
      `UPDATE schools SET subscription_status = 'active', current_period_start = ?, current_period_end = ? WHERE id = ?`,
      [newStart.toISOString().slice(0, 10), newEnd.toISOString().slice(0, 10), id]
    );
    await conn.commit();
    res.json({ message: `Payment recorded. ${school.name} is active until ${newEnd.toISOString().slice(0, 10)}.` });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Could not record payment.', error: err.message });
  } finally {
    conn.release();
  }
};

// GET /api/platform/schools/public  (for the registration dropdown — no auth)
exports.listSchoolsPublic = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, school_type FROM schools WHERE subscription_status = 'active' ORDER BY name ASC`
    );
    res.json({ schools: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load schools.', error: err.message });
  }
};

// POST /api/platform/resources (platform admin publishes free material)
exports.createPlatformResource = async (req, res) => {
  try {
    const { title, category, description, resource_url } = req.body;
    if (!title || !category) return res.status(400).json({ message: 'Title and category are required.' });
    if (!req.file && !resource_url) {
      return res.status(400).json({ message: 'Upload a file or provide a resource URL.' });
    }

    const filePath = req.file ? `/uploads/${req.file.filename}` : null;
    const [result] = await pool.query(
      `INSERT INTO platform_resources (title, category, description, file_path, resource_url, created_by)
       VALUES (?,?,?,?,?,?)`,
      [title, category, description || null, filePath, resource_url || null, req.user.id]
    );
    res.status(201).json({ message: 'Free platform resource published.', resource_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not publish platform resource.', error: err.message });
  }
};

// GET /api/platform/resources (admin management list)
exports.listPlatformResources = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM platform_resources ORDER BY category ASC, title ASC');
    res.json({ resources: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load platform resources.', error: err.message });
  }
};

// GET /api/platform/resources/public (landing page course catalog)
exports.listPublicPlatformResources = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, category, description, file_path, resource_url, created_at
       FROM platform_resources WHERE published = TRUE ORDER BY category ASC, title ASC`
    );
    res.json({ resources: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load free platform resources.', error: err.message });
  }
};
