const pool = require('../config/db');

// POST /api/courses  (lecturer creates a course within their school)
exports.createCourse = async (req, res) => {
  try {
    const { name, code, description, trade_or_program } = req.body;
    if (!name) return res.status(400).json({ message: 'Course name is required.' });

    const [result] = await pool.query(
      `INSERT INTO courses (school_id, lecturer_id, name, code, description, trade_or_program)
       VALUES (?,?,?,?,?,?)`,
      [req.user.school_id, req.user.id, name, code || null, description || null, trade_or_program || null]
    );
    res.status(201).json({ message: 'Course created.', course_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not create course.', error: err.message });
  }
};

// GET /api/courses  (lecturer's own courses, or admin's school-wide list)
exports.listCourses = async (req, res) => {
  try {
    let sql = `SELECT c.*, u.full_names AS lecturer_name,
               (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS student_count
               FROM courses c JOIN users u ON u.id = c.lecturer_id WHERE c.school_id = ?`;
    const params = [req.user.school_id];
    if (req.user.role === 'lecturer') { sql += ' AND c.lecturer_id = ?'; params.push(req.user.id); }
    sql += ' ORDER BY c.created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json({ courses: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load courses.', error: err.message });
  }
};

// POST /api/courses/:id/join
// Rule 8: student clicks "Join" -> request auto-sent to the lecturer for approval.
// Rule 8: a student will not (carelessly) register multiple times to different courses —
// enforced by the UNIQUE(student_id, course_id) constraint on course_join_requests.
exports.requestToJoin = async (req, res) => {
  try {
    const { id: courseId } = req.params;
    const [[course]] = await pool.query('SELECT * FROM courses WHERE id = ? AND school_id = ?', [courseId, req.user.school_id]);
    if (!course) return res.status(404).json({ message: 'Course not found in your school.' });

    const [existing] = await pool.query(
      'SELECT * FROM course_join_requests WHERE student_id = ? AND course_id = ?',
      [req.user.id, courseId]
    );
    if (existing.length) {
      return res.status(409).json({ message: `You already have a ${existing[0].status} request for this course.` });
    }

    await pool.query(
      'INSERT INTO course_join_requests (student_id, course_id, status) VALUES (?,?,"pending")',
      [req.user.id, courseId]
    );
    await pool.query(
      'INSERT INTO notifications (user_id, title, body) VALUES (?,?,?)',
      [course.lecturer_id, 'New join request', `${req.user.full_names} requested to join ${course.name}.`]
    );
    res.status(201).json({ message: 'Join request sent. Waiting for the lecturer to approve.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not send join request.', error: err.message });
  }
};

// GET /api/courses/:id/requests  (lecturer views pending join requests)
exports.listJoinRequests = async (req, res) => {
  try {
    const { id: courseId } = req.params;
    const [[course]] = await pool.query('SELECT * FROM courses WHERE id = ? AND lecturer_id = ?', [courseId, req.user.id]);
    if (!course) return res.status(404).json({ message: 'Course not found.' });

    const [rows] = await pool.query(
      `SELECT jr.id, jr.status, jr.requested_at, u.id AS student_id, u.full_names, u.email
       FROM course_join_requests jr JOIN users u ON u.id = jr.student_id
       WHERE jr.course_id = ? ORDER BY jr.requested_at DESC`,
      [courseId]
    );
    res.json({ requests: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load join requests.', error: err.message });
  }
};

// PATCH /api/courses/requests/:requestId
// Rule 8: after approval, the student can see teams to join, resources, tasks, grades.
exports.decideJoinRequest = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { requestId } = req.params;
    const { decision } = req.body; // 'approved' | 'rejected'
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ message: "Decision must be 'approved' or 'rejected'." });
    }

    const [[request]] = await conn.query(
      `SELECT jr.*, c.lecturer_id, c.name AS course_name FROM course_join_requests jr
       JOIN courses c ON c.id = jr.course_id WHERE jr.id = ?`,
      [requestId]
    );
    if (!request || request.lecturer_id !== req.user.id) {
      return res.status(404).json({ message: 'Join request not found.' });
    }

    await conn.beginTransaction();
    await conn.query(
      'UPDATE course_join_requests SET status = ?, decided_by = ?, decided_at = NOW() WHERE id = ?',
      [decision, req.user.id, requestId]
    );
    if (decision === 'approved') {
      await conn.query(
        'INSERT IGNORE INTO enrollments (student_id, course_id) VALUES (?,?)',
        [request.student_id, request.course_id]
      );
    }
    await conn.query(
      'INSERT INTO notifications (user_id, title, body) VALUES (?,?,?)',
      [request.student_id,
        decision === 'approved' ? 'Join request approved' : 'Join request rejected',
        decision === 'approved'
          ? `You're now enrolled in ${request.course_name}. You can see its teams, resources and tasks.`
          : `Your request to join ${request.course_name} was rejected.`]
    );
    await conn.commit();
    res.json({ message: `Join request ${decision}.` });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Could not decide on join request.', error: err.message });
  } finally {
    conn.release();
  }
};

// Small helper other controllers reuse to confirm a student is enrolled
// before letting them touch course-scoped resources (teams, resources, forum...).
exports.assertEnrolled = async (studentId, courseId) => {
  const [rows] = await pool.query(
    'SELECT id FROM enrollments WHERE student_id = ? AND course_id = ?',
    [studentId, courseId]
  );
  return rows.length > 0;
};
