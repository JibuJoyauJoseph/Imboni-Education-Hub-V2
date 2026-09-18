const pool = require('../config/db');
const { assertEnrolled } = require('./courseController');

// POST /api/courses/:courseId/assignments
exports.createAssignment = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, instructions, max_score, due_date } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required.' });
    const [[course]] = await pool.query('SELECT id FROM courses WHERE id = ? AND lecturer_id = ?', [courseId, req.user.id]);
    if (!course) return res.status(404).json({ message: 'Course not found.' });

    const filePath = req.file ? `/uploads/${req.file.filename}` : null;
    const [result] = await pool.query(
      'INSERT INTO assignments (course_id, created_by, title, instructions, max_score, due_date, file_path) VALUES (?,?,?,?,?,?,?)',
      [courseId, req.user.id, title, instructions || null, max_score || 100, due_date || null, filePath]
    );
    res.status(201).json({ message: 'Assignment posted.', assignment_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not create assignment.', error: err.message });
  }
};

// GET /api/courses/:courseId/assignments
exports.listAssignments = async (req, res) => {
  try {
    const { courseId } = req.params;
    const [rows] = await pool.query('SELECT * FROM assignments WHERE course_id = ? ORDER BY due_date ASC', [courseId]);
    res.json({ assignments: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load assignments.', error: err.message });
  }
};

// POST /api/assignments/:id/submit  (student submission)
exports.submitAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const [[assignment]] = await pool.query('SELECT * FROM assignments WHERE id = ?', [id]);
    if (!assignment) return res.status(404).json({ message: 'Assignment not found.' });

    const enrolled = await assertEnrolled(req.user.id, assignment.course_id);
    if (!enrolled) return res.status(403).json({ message: 'You must be enrolled in this course to submit.' });

    const filePath = req.file ? `/uploads/${req.file.filename}` : null;
    await pool.query(
      `INSERT INTO submissions (assignment_id, student_id, file_path)
       VALUES (?,?,?) ON DUPLICATE KEY UPDATE file_path = VALUES(file_path), submitted_at = NOW()`,
      [id, req.user.id, filePath]
    );
    res.json({ message: 'Assignment submitted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not submit assignment.', error: err.message });
  }
};

// GET /api/assignments/:id/submissions  (lecturer views + grades — gradebook)
exports.listSubmissions = async (req, res) => {
  try {
    const { id } = req.params;
    const [[assignment]] = await pool.query('SELECT id FROM assignments a JOIN courses c ON c.id = a.course_id WHERE a.id = ? AND c.lecturer_id = ?', [id, req.user.id]);
    if (!assignment) return res.status(404).json({ message: 'Assignment not found.' });
    const [rows] = await pool.query(
      `SELECT s.*, u.full_names AS student_name FROM submissions s JOIN users u ON u.id = s.student_id
       WHERE s.assignment_id = ? ORDER BY s.submitted_at DESC`,
      [id]
    );
    res.json({ submissions: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load submissions.', error: err.message });
  }
};

// PATCH /api/submissions/:id/grade  (gradebook entry)
exports.gradeSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { score, feedback } = req.body;
    if (score === undefined) return res.status(400).json({ message: 'Score is required.' });
    const [[submission]] = await pool.query('SELECT s.id FROM submissions s JOIN assignments a ON a.id = s.assignment_id JOIN courses c ON c.id = a.course_id WHERE s.id = ? AND c.lecturer_id = ?', [id, req.user.id]);
    if (!submission) return res.status(404).json({ message: 'Submission not found.' });

    await pool.query(
      'UPDATE submissions SET score = ?, feedback = ?, graded_by = ?, graded_at = NOW() WHERE id = ?',
      [score, feedback || null, req.user.id, id]
    );
    res.json({ message: 'Grade recorded.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not record grade.', error: err.message });
  }
};
