const bcrypt = require('bcryptjs');
const pool = require('../config/db');

// POST /api/students/register
// Rule 7 (registration branching):
//   Step 1: choose education_level = 'university' | 'secondary'
//   University -> full_names, national_id, faculty, department, program_type, school_id (uni)
//   Secondary  -> full_names, school_id, trade, year_of_study
// Rule 2: every registering student waits for admin approval (approval_status = 'pending')
// Rule 7 (institution lock): school_id is fixed at registration and the
//   student can never join another institution's space.
exports.registerStudent = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      education_level, school_id, full_names, email, phone, password,
      national_id, faculty, department, program_type,
      trade, year_of_study
    } = req.body;

    if (!education_level || !['university', 'secondary'].includes(education_level)) {
      return res.status(400).json({ message: "Choose whether you're a student of secondary school or university." });
    }
    if (!school_id || !full_names || !email || !password) {
      return res.status(400).json({ message: 'School, full names, email and password are required.' });
    }
    if (education_level === 'university') {
      if (!national_id || !faculty || !department || !program_type) {
        return res.status(400).json({ message: 'University students must provide ID, faculty, department and program type.' });
      }
    } else {
      if (!trade || !year_of_study) {
        return res.status(400).json({ message: 'Secondary students must provide their trade and year of study.' });
      }
    }

    const [[school]] = await conn.query('SELECT * FROM schools WHERE id = ?', [school_id]);
    if (!school) return res.status(404).json({ message: 'Selected school was not found.' });
    if (school.school_type !== education_level) {
      return res.status(400).json({ message: `${school.name} is registered as a ${school.school_type} institution, not ${education_level}.` });
    }

    const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ message: 'An account with this email already exists.' });

    await conn.beginTransaction();

    const hash = await bcrypt.hash(password, 10);
    const [userResult] = await conn.query(
      `INSERT INTO users (school_id, role, full_names, email, phone, password_hash, approval_status)
       VALUES (?, 'student', ?, ?, ?, ?, 'pending')`,
      [school_id, full_names, email, phone || null, hash]
    );
    const userId = userResult.insertId;

    await conn.query(
      `INSERT INTO student_profiles
        (user_id, education_level, national_id, faculty, department, program_type, trade, year_of_study)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        userId, education_level,
        education_level === 'university' ? national_id : null,
        education_level === 'university' ? faculty : null,
        education_level === 'university' ? department : null,
        education_level === 'university' ? program_type : null,
        education_level === 'secondary' ? trade : null,
        education_level === 'secondary' ? year_of_study : null
      ]
    );

    // Personal kanban board is created immediately so it's ready once approved.
    await conn.query('INSERT INTO kanban_boards (student_id) VALUES (?)', [userId]);

    await conn.commit();
    res.status(201).json({
      message: 'Registration submitted. Your account will be reviewed by the school admin before you can log in.',
      user_id: userId
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Registration failed.', error: err.message });
  } finally {
    conn.release();
  }
};

// GET /api/students/me/dashboard
// Rule 1: on successful login a student is auto-routed to a dashboard with
// courses he's taking, pending tasks, assignments, and grades (if any).
exports.getMyDashboard = async (req, res) => {
  try {
    const studentId = req.user.id;

    const [courses] = await pool.query(
      `SELECT c.id, c.name, c.code, u.full_names AS lecturer_name
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       JOIN users u ON u.id = c.lecturer_id
       WHERE e.student_id = ?`,
      [studentId]
    );

    const [pendingJoinRequests] = await pool.query(
      `SELECT jr.id, jr.course_id, c.name AS course_name, jr.status, jr.requested_at
       FROM course_join_requests jr JOIN courses c ON c.id = jr.course_id
       WHERE jr.student_id = ? AND jr.status = 'pending'`,
      [studentId]
    );

    const [pendingAssignments] = await pool.query(
      `SELECT a.id, a.title, a.due_date, c.id AS course_id, c.name AS course_name
       FROM assignments a
       JOIN courses c ON c.id = a.course_id
       JOIN enrollments e ON e.course_id = a.course_id AND e.student_id = ?
       LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ?
       WHERE s.id IS NULL
       ORDER BY a.due_date ASC`,
      [studentId, studentId]
    );

    const [grades] = await pool.query(
      `SELECT a.title, c.name AS course_name, s.score, a.max_score, s.graded_at
       FROM submissions s
       JOIN assignments a ON a.id = s.assignment_id
       JOIN courses c ON c.id = a.course_id
       WHERE s.student_id = ? AND s.score IS NOT NULL
       ORDER BY s.graded_at DESC LIMIT 20`,
      [studentId]
    );

    const [teams] = await pool.query(
      `SELECT t.id, t.name, c.name AS course_name, t.created_by,
              creator.full_names AS created_by_name
       FROM team_members tm
       JOIN teams t ON t.id = tm.team_id
       JOIN courses c ON c.id = t.course_id
       JOIN users creator ON creator.id = t.created_by
       WHERE tm.student_id = ?`,
      [studentId]
    );

    const [availableTeams] = await pool.query(
      `SELECT t.id, t.name, c.name AS course_name, t.created_by,
              creator.full_names AS created_by_name,
              (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) AS member_count,
              (SELECT status FROM team_join_requests r WHERE r.team_id = t.id AND r.student_id = ? ORDER BY r.id DESC LIMIT 1) AS request_status
       FROM teams t
       JOIN courses c ON c.id = t.course_id
       JOIN users creator ON creator.id = t.created_by
       JOIN enrollments e ON e.course_id = t.course_id AND e.student_id = ?
       WHERE NOT EXISTS (SELECT 1 FROM team_members own WHERE own.team_id = t.id AND own.student_id = ?)
       ORDER BY c.name, t.created_at DESC`,
      [studentId, studentId, studentId]
    );

    const [teamRequests] = await pool.query(
      `SELECT r.id, r.team_id, r.status, r.requested_at, t.name AS team_name,
              c.name AS course_name, u.full_names AS requested_by_name
       FROM team_join_requests r
       JOIN teams t ON t.id = r.team_id
       JOIN courses c ON c.id = t.course_id
       JOIN users u ON u.id = r.student_id
       WHERE t.created_by = ? AND r.status = 'pending'
       ORDER BY r.requested_at DESC`,
      [studentId]
    );

    res.json({
      courses,
      pending_join_requests: pendingJoinRequests,
      pending_assignments: pendingAssignments,
      recent_grades: grades,
      teams,
      available_teams: availableTeams,
      team_join_requests: teamRequests
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load dashboard.', error: err.message });
  }
};

// GET /api/students/courses/available
// Rule 8: student sees the courses/lecturers available IN HIS SCHOOL and
// clicks "Join" on the one he's supposed to be in.
exports.getAvailableCourses = async (req, res) => {
  try {
    const [courses] = await pool.query(
      `SELECT c.id, c.name, c.code, c.trade_or_program, u.full_names AS lecturer_name,
              (SELECT status FROM course_join_requests jr WHERE jr.course_id = c.id AND jr.student_id = ?) AS my_request_status
       FROM courses c JOIN users u ON u.id = c.lecturer_id
       WHERE c.school_id = ?`,
      [req.user.id, req.user.school_id]
    );
    res.json({ courses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load available courses.', error: err.message });
  }
};
