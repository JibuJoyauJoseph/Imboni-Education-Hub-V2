const pool = require('../config/db');
const { assertEnrolled } = require('./courseController');

// POST /api/courses/:courseId/forum/threads  (student or lecturer hosts a discussion)
exports.createThread = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title } = req.body;
    if (!title) return res.status(400).json({ message: 'Thread title is required.' });

    if (req.user.role === 'student') {
      const enrolled = await assertEnrolled(req.user.id, courseId);
      if (!enrolled) return res.status(403).json({ message: 'Join this course to start a discussion.' });
    }

    const [result] = await pool.query(
      'INSERT INTO forum_threads (course_id, created_by, title) VALUES (?,?,?)',
      [courseId, req.user.id, title]
    );
    res.status(201).json({ message: 'Discussion started.', thread_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not start discussion.', error: err.message });
  }
};

// GET /api/courses/:courseId/forum/threads
exports.listThreads = async (req, res) => {
  try {
    const { courseId } = req.params;
    const [rows] = await pool.query(
      `SELECT t.id, t.title, t.created_at, u.full_names AS created_by_name,
              (SELECT COUNT(*) FROM forum_posts p WHERE p.thread_id = t.id) AS post_count
       FROM forum_threads t JOIN users u ON u.id = t.created_by
       WHERE t.course_id = ? ORDER BY t.created_at DESC`,
      [courseId]
    );
    res.json({ threads: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load discussions.', error: err.message });
  }
};

// POST /api/forum/threads/:threadId/posts
exports.createPost = async (req, res) => {
  try {
    const { threadId } = req.params;
    const { body } = req.body;
    if (!body) return res.status(400).json({ message: 'Post cannot be empty.' });

    await pool.query('INSERT INTO forum_posts (thread_id, posted_by, body) VALUES (?,?,?)', [threadId, req.user.id, body]);
    res.status(201).json({ message: 'Posted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not post.', error: err.message });
  }
};

// GET /api/forum/threads/:threadId/posts
exports.listPosts = async (req, res) => {
  try {
    const { threadId } = req.params;
    const [rows] = await pool.query(
      `SELECT p.id, p.body, p.created_at, u.full_names, u.role FROM forum_posts p JOIN users u ON u.id = p.posted_by
       WHERE p.thread_id = ? ORDER BY p.created_at ASC`,
      [threadId]
    );
    res.json({ posts: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load posts.', error: err.message });
  }
};
