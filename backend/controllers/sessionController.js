const pool = require('../config/db');

const normalizeDateTime = value => {
  if (!value) return null;
  return String(value).replace('T', ' ').slice(0, 19);
};

// POST /api/courses/:courseId/sessions  (lecturer hosts a live session)
exports.createSession = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, meeting_link, scheduled_at, duration_minutes } = req.body;
    if (!title || !scheduled_at) return res.status(400).json({ message: 'Title and scheduled time are required.' });
    const [[course]] = await pool.query('SELECT id FROM courses WHERE id = ? AND lecturer_id = ?', [courseId, req.user.id]);
    if (!course) return res.status(404).json({ message: 'Course not found.' });

    const [result] = await pool.query(
      'INSERT INTO live_sessions (course_id, hosted_by, title, meeting_link, scheduled_at, duration_minutes) VALUES (?,?,?,?,?,?)',
      [courseId, req.user.id, title, meeting_link || null, normalizeDateTime(scheduled_at), duration_minutes || 60]
    );
    res.status(201).json({ message: 'Live session scheduled.', session_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not schedule session.', error: err.message });
  }
};

// GET /api/courses/:courseId/sessions
exports.listSessions = async (req, res) => {
  try {
    const { courseId } = req.params;
    const [rows] = await pool.query('SELECT * FROM live_sessions WHERE course_id = ? AND hosted_by = ? ORDER BY scheduled_at DESC', [courseId, req.user.id]);
    res.json({ sessions: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load sessions.', error: err.message });
  }
};

// PATCH /api/sessions/:id/status
exports.updateSessionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // scheduled | live | ended | cancelled
    if (!['scheduled', 'live', 'ended', 'cancelled'].includes(status)) return res.status(400).json({ message: 'Invalid session status.' });
    const [result] = await pool.query('UPDATE live_sessions SET status = ? WHERE id = ? AND hosted_by = ?', [status, id, req.user.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Session not found.' });
    res.json({ message: 'Session status updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not update session.', error: err.message });
  }
};

// POST /api/sessions/:id/attendance  (lecturer marks attendance)
// body: { records: [{ student_id, status }] }
exports.markAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { records } = req.body;
    const [[session]] = await pool.query('SELECT id FROM live_sessions WHERE id = ? AND hosted_by = ?', [id, req.user.id]);
    if (!session) return res.status(404).json({ message: 'Session not found.' });
    const [[sessionCourse]] = await pool.query('SELECT course_id FROM live_sessions WHERE id = ?', [id]);
    if (!sessionCourse) return res.status(404).json({ message: 'Session not found.' });
    for (const r of records || []) {
      if (!['present', 'absent', 'late'].includes(r.status || 'present')) return res.status(400).json({ message: 'Invalid attendance status.' });
      const [[approved]] = await pool.query(
        'SELECT student_id FROM course_join_requests WHERE course_id = ? AND student_id = ? AND status = "approved"',
        [sessionCourse.course_id, r.student_id]
      );
      if (!approved) return res.status(400).json({ message: 'Attendance can only be recorded for approved course students.' });
      await pool.query(
        `INSERT INTO attendance_records (session_id, student_id, status)
         VALUES (?,?,?) ON DUPLICATE KEY UPDATE status = VALUES(status), marked_at = NOW()`,
        [id, r.student_id, r.status || 'present']
      );
    }
    res.json({ message: 'Attendance recorded.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not record attendance.', error: err.message });
  }
};

// GET /api/sessions/:id/attendance
exports.getAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const [[session]] = await pool.query('SELECT id FROM live_sessions WHERE id = ? AND hosted_by = ?', [id, req.user.id]);
    if (!session) return res.status(404).json({ message: 'Session not found.' });
    const [rows] = await pool.query(
      `SELECT ar.*, u.full_names FROM attendance_records ar JOIN users u ON u.id = ar.student_id WHERE ar.session_id = ?`,
      [id]
    );
    res.json({ attendance: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load attendance.', error: err.message });
  }
};
