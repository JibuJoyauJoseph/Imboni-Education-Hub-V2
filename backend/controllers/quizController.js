const pool = require('../config/db');
const { assertEnrolled } = require('./courseController');

const normalizeDateTime = value => {
  if (!value) return null;
  return String(value).replace('T', ' ').slice(0, 19);
};

// POST /api/courses/:courseId/quizzes
// body: { title, time_limit_minutes, open_at, close_at,
//         questions: [{ question_text, points, options: [{option_text, is_correct}] }] }
exports.createQuiz = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { courseId } = req.params;
    const { title, time_limit_minutes, open_at, close_at, questions } = req.body;
    if (!title?.trim() || !Array.isArray(questions) || !questions.length) {
      return res.status(400).json({ message: 'Title and at least one question are required.' });
    }
    if (questions.some(question => !question.question_text?.trim() || !Array.isArray(question.options) || question.options.length < 2 || question.options.some(option => !option.option_text?.trim()) || question.options.filter(option => option.is_correct).length !== 1)) {
      return res.status(400).json({ message: 'Each question needs text, at least two options, and exactly one correct answer.' });
    }
    const [[course]] = await pool.query('SELECT id FROM courses WHERE id = ? AND lecturer_id = ?', [courseId, req.user.id]);
    if (!course) return res.status(404).json({ message: 'Course not found.' });

    await conn.beginTransaction();
    const [quizResult] = await conn.query(
      'INSERT INTO quizzes (course_id, created_by, title, time_limit_minutes, open_at, close_at) VALUES (?,?,?,?,?,?)',
      [courseId, req.user.id, title.trim(), time_limit_minutes || 30, normalizeDateTime(open_at), normalizeDateTime(close_at)]
    );
    const quizId = quizResult.insertId;

    for (const q of questions) {
      const [qResult] = await conn.query(
        'INSERT INTO quiz_questions (quiz_id, question_text, question_type, points) VALUES (?,?,?,?)',
        [quizId, q.question_text.trim(), q.question_type || 'mcq', q.points || 1]
      );
      for (const opt of q.options || []) {
        await conn.query(
          'INSERT INTO quiz_options (question_id, option_text, is_correct) VALUES (?,?,?)',
          [qResult.insertId, opt.option_text.trim(), !!opt.is_correct]
        );
      }
    }
    await conn.commit();
    res.status(201).json({ message: 'Quiz created.', quiz_id: quizId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Could not create quiz.', error: err.message });
  } finally {
    conn.release();
  }
};

// GET /api/quizzes/:id  (questions + options, hiding is_correct for students)
exports.getQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    const [[quiz]] = await pool.query('SELECT * FROM quizzes WHERE id = ?', [id]);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found.' });

    const [questions] = await pool.query('SELECT id, question_text, question_type, points FROM quiz_questions WHERE quiz_id = ?', [id]);
    for (const q of questions) {
      const cols = req.user.role === 'student' ? 'id, option_text' : 'id, option_text, is_correct';
      const [options] = await pool.query(`SELECT ${cols} FROM quiz_options WHERE question_id = ?`, [q.id]);
      q.options = options;
    }
    res.json({ quiz, questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load quiz.', error: err.message });
  }
};

// POST /api/quizzes/:id/attempt
// body: { answers: [{ question_id, selected_option_id }] }
// Rule: "quiz auto-grading" — computed instantly on submit.
exports.submitAttempt = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const { answers } = req.body;
    const [[quiz]] = await conn.query('SELECT * FROM quizzes WHERE id = ?', [id]);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found.' });

    const enrolled = await assertEnrolled(req.user.id, quiz.course_id);
    if (!enrolled) return res.status(403).json({ message: 'You must be enrolled in this course to attempt the quiz.' });

    await conn.beginTransaction();
    const [attemptResult] = await conn.query(
      'INSERT INTO quiz_attempts (quiz_id, student_id, submitted_at) VALUES (?,?,NOW())',
      [id, req.user.id]
    );
    const attemptId = attemptResult.insertId;

    let autoScore = 0;
    let maxScore = 0;
    for (const ans of answers || []) {
      const [[question]] = await conn.query('SELECT * FROM quiz_questions WHERE id = ? AND quiz_id = ?', [ans.question_id, id]);
      if (!question) continue;
      maxScore += Number(question.points);

      let isCorrect = false;
      if (ans.selected_option_id) {
        const [[option]] = await conn.query('SELECT * FROM quiz_options WHERE id = ? AND question_id = ?', [ans.selected_option_id, question.id]);
        isCorrect = !!(option && option.is_correct);
      }
      if (isCorrect) autoScore += Number(question.points);

      await conn.query(
        'INSERT INTO quiz_attempt_answers (attempt_id, question_id, selected_option_id, is_correct) VALUES (?,?,?,?)',
        [attemptId, ans.question_id, ans.selected_option_id || null, isCorrect]
      );
    }

    await conn.query('UPDATE quiz_attempts SET auto_score = ?, max_score = ? WHERE id = ?', [autoScore, maxScore, attemptId]);
    await conn.commit();

    res.json({ message: 'Quiz submitted and graded automatically.', score: autoScore, max_score: maxScore });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Could not submit quiz.', error: err.message });
  } finally {
    conn.release();
  }
};

// GET /api/courses/:courseId/quizzes
exports.listQuizzes = async (req, res) => {
  try {
    const { courseId } = req.params;
    const [rows] = await pool.query('SELECT id, title, time_limit_minutes, open_at, close_at FROM quizzes WHERE course_id = ?', [courseId]);
    res.json({ quizzes: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load quizzes.', error: err.message });
  }
};

// GET /api/courses/:courseId/quiz-attempts (lecturer gradebook)
exports.listAttempts = async (req, res) => {
  try {
    const { courseId } = req.params;
    const [[course]] = await pool.query('SELECT id FROM courses WHERE id = ? AND lecturer_id = ?', [courseId, req.user.id]);
    if (!course) return res.status(404).json({ message: 'Course not found.' });
    const [attempts] = await pool.query(
      `SELECT qa.id, qa.quiz_id, q.title AS quiz_title, qa.student_id,
              u.full_names AS student_name, u.email, qa.auto_score, qa.max_score,
              qa.started_at, qa.submitted_at
       FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id
       JOIN users u ON u.id = qa.student_id
       WHERE q.course_id = ? ORDER BY qa.submitted_at DESC`,
      [courseId]
    );
    res.json({ attempts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load quiz results.', error: err.message });
  }
};
