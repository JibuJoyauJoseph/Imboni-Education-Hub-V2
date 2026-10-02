const pool = require('../config/db');
const { assertEnrolled, canAccessCourse } = require('./courseController');
const emailService = require('../utils/emailService');

// POST /api/courses/:courseId/assignments
exports.createAssignment = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, instructions, max_score, due_date } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required.' });
    const [[course]] = await pool.query('SELECT id, name, school_id FROM courses WHERE id = ? AND lecturer_id = ?', [courseId, req.user.id]);
    if (!course) return res.status(404).json({ message: 'Course not found.' });

    const filePath = req.file ? `/uploads/${req.file.filename}` : null;
    const [result] = await pool.query(
      'INSERT INTO assignments (course_id, created_by, title, instructions, max_score, due_date, file_path) VALUES (?,?,?,?,?,?,?)',
      [courseId, req.user.id, title, instructions || null, max_score || 100, due_date || null, filePath]
    );
    const [recipients] = await pool.query(
      `SELECT u.id, u.email, u.full_names FROM enrollments e
       JOIN users u ON u.id = e.student_id
       WHERE e.course_id = ? AND u.role = 'student' AND u.approval_status = 'approved' AND u.is_active = TRUE`,
      [courseId]
    );
    if (recipients.length) {
      await pool.query(
        'INSERT INTO notifications (user_id, title, body) VALUES ?',
        [recipients.map(student => [student.id, 'New assignment', `${title} was posted in ${course.name}.`])]
      );
      emailService.sendNewAssignmentNotice({
        recipients, title, courseName: course.name,
        dueDate: due_date ? new Date(due_date).toLocaleString() : null,
        courseId: course.id, schoolId: course.school_id
      }).catch(err => console.error('[assignmentController] Could not send new-assignment emails:', err.message));
    }
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
    const courseAccess = await canAccessCourse(req.user, courseId);
    if (courseAccess === null) return res.status(404).json({ message: 'Course not found.' });
    if (!courseAccess) return res.status(403).json({ message: 'You cannot access this course.' });
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
    const answerText = req.body.answer_text?.trim() || null;
    const [[assignment]] = await pool.query('SELECT * FROM assignments WHERE id = ?', [id]);
    if (!assignment) return res.status(404).json({ message: 'Assignment not found.' });

    const enrolled = await assertEnrolled(req.user.id, assignment.course_id);
    if (!enrolled) return res.status(403).json({ message: 'You must be enrolled in this course to submit.' });
    if (!answerText && !req.file) return res.status(400).json({ message: 'Write a response or attach a file before submitting.' });

    const filePath = req.file ? `/uploads/${req.file.filename}` : null;
    await pool.query(
      `INSERT INTO submissions (assignment_id, student_id, file_path, answer_text)
       VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE
       file_path = COALESCE(VALUES(file_path), file_path),
       answer_text = COALESCE(VALUES(answer_text), answer_text), submitted_at = NOW()`,
      [id, req.user.id, filePath, answerText]
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
