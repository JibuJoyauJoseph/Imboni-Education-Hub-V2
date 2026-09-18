const pool = require('../config/db');
const { assertEnrolled } = require('./courseController');

// POST /api/courses/:courseId/resources  (lecturer shares notes/materials)
exports.createResource = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required.' });

    const filePath = req.file ? `/uploads/${req.file.filename}` : null;
    const [result] = await pool.query(
      'INSERT INTO resources (course_id, uploaded_by, title, description, file_path) VALUES (?,?,?,?,?)',
      [courseId, req.user.id, title, description || null, filePath]
    );
    res.status(201).json({ message: 'Resource shared with your students.', resource_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not share resource.', error: err.message });
  }
};

// GET /api/courses/:courseId/resources
// Rule: students "access free online resources" once enrolled.
exports.listResources = async (req, res) => {
  try {
    const { courseId } = req.params;
    if (req.user.role === 'student') {
      const enrolled = await assertEnrolled(req.user.id, courseId);
      if (!enrolled) return res.status(403).json({ message: 'Join this course to access its resources.' });
    }
    const [rows] = await pool.query(
      `SELECT r.*, u.full_names AS uploaded_by_name FROM resources r JOIN users u ON u.id = r.uploaded_by
       WHERE r.course_id = ? ORDER BY r.created_at DESC`,
      [courseId]
    );
    res.json({ resources: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load resources.', error: err.message });
  }
};

// GET /api/platform-resources (free resources available to approved students)
exports.listPlatformResources = async (req, res) => {
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
