const crypto = require('crypto');
const pool = require('../config/db');

const TASK_STATUSES = new Set(['backlog', 'doing', 'review', 'done']);
const PRIORITIES = new Set(['low', 'medium', 'high']);

async function getMembership(projectId, userId) {
  const [[membership]] = await pool.query(
    'SELECT pm.*, p.name, p.description, p.status, p.school_id, p.created_by FROM project_members pm JOIN projects p ON p.id = pm.project_id WHERE pm.project_id = ? AND pm.user_id = ?',
    [projectId, userId]
  );
  return membership;
}

async function loadDashboard(projectId, userId) {
  const membership = await getMembership(projectId, userId);
  if (!membership) return null;

  const [[project]] = await pool.query('SELECT * FROM projects WHERE id = ?', [projectId]);
  const [tasks] = await pool.query(
    `SELECT t.*, creator.full_names AS creator_name, assignee.full_names AS assignee_name
     FROM project_tasks t JOIN users creator ON creator.id = t.created_by
     LEFT JOIN users assignee ON assignee.id = t.assignee_id
     WHERE t.project_id = ? ORDER BY t.status, t.position, t.created_at`,
    [projectId]
  );
  const [milestones] = await pool.query('SELECT * FROM project_milestones WHERE project_id = ? ORDER BY due_date IS NULL, due_date', [projectId]);
  const [reviews] = await pool.query(
    `SELECT r.*, u.full_names AS creator_name, COUNT(c.id) AS comment_count
     FROM project_reviews r JOIN users u ON u.id = r.created_by
     LEFT JOIN project_review_comments c ON c.review_id = r.id
     WHERE r.project_id = ? GROUP BY r.id ORDER BY r.created_at DESC`,
    [projectId]
  );
  const [commits] = await pool.query(
    'SELECT c.*, u.full_names AS author_name FROM project_commits c JOIN users u ON u.id = c.author_id WHERE c.project_id = ? ORDER BY c.created_at DESC LIMIT 20',
    [projectId]
  );
  const [files] = await pool.query('SELECT * FROM project_files WHERE project_id = ? ORDER BY created_at DESC', [projectId]);
  const [wiki] = await pool.query('SELECT id, title, updated_at, author_id FROM project_wiki_pages WHERE project_id = ? ORDER BY updated_at DESC', [projectId]);
  const [members] = await pool.query(
    'SELECT pm.user_id, pm.role, u.full_names, u.email, s.name AS school_name FROM project_members pm JOIN users u ON u.id = pm.user_id LEFT JOIN schools s ON s.id = u.school_id WHERE pm.project_id = ? ORDER BY pm.joined_at',
    [projectId]
  );
  return { project, membership, tasks, milestones, reviews, commits, files, wiki, members };
}

exports.listProjects = async (req, res) => {
  try {
    const [projects] = await pool.query(
      `SELECT p.*, pm.role, COUNT(all_members.user_id) AS member_count
       FROM projects p JOIN project_members pm ON pm.project_id = p.id
       LEFT JOIN project_members all_members ON all_members.project_id = p.id
       WHERE pm.user_id = ? GROUP BY p.id, pm.role ORDER BY p.updated_at DESC`,
      [req.user.id]
    );
    res.json({ projects });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Could not load projects.', error: error.message });
  }
};

exports.getDashboard = async (req, res) => {
  try {
    const projectId = req.query.project_id;
    if (!projectId) return res.status(404).json({ message: 'No project workspace exists yet.' });
    const dashboard = await loadDashboard(projectId, req.user.id);
    if (!dashboard) return res.status(403).json({ message: 'You are not a member of this project.' });
    res.json(dashboard);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Could not load project workspace.', error: error.message });
  }
};

exports.createProject = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Project name is required.' });
    const slug = `${name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${crypto.randomBytes(3).toString('hex')}`;
    const [result] = await pool.query(
      'INSERT INTO projects (school_id, created_by, name, slug, description) VALUES (?,?,?,?,?)',
      [req.user.school_id || null, req.user.id, name.trim(), slug, description || null]
    );
    await pool.query('INSERT INTO project_members (project_id, user_id, role) VALUES (?,?,?)', [result.insertId, req.user.id, 'lead']);
    res.status(201).json({ project_id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Could not create project.', error: error.message });
  }
};

exports.addMember = async (req, res) => {
  try {
    const membership = await getMembership(req.params.projectId, req.user.id);
    if (!membership || !['lead', 'developer'].includes(membership.role)) return res.status(403).json({ message: 'Only project leads can add collaborators.' });
    const { user_id, role = 'member' } = req.body;
    if (!user_id) return res.status(400).json({ message: 'A user_id is required.' });
    const [[user]] = await pool.query('SELECT id, role FROM users WHERE id = ? AND is_active = TRUE', [user_id]);
    if (!user || user.role !== 'student') return res.status(400).json({ message: 'Only active students can join a project.' });
    await pool.query('INSERT INTO project_members (project_id, user_id, role) VALUES (?,?,?) ON DUPLICATE KEY UPDATE role = VALUES(role)', [req.params.projectId, user_id, role]);
    res.status(201).json({ message: 'Collaborator added.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Could not add collaborator.', error: error.message });
  }
};

exports.createTask = async (req, res) => {
  try {
    if (!await getMembership(req.params.projectId, req.user.id)) return res.status(403).json({ message: 'You are not a member of this project.' });
    const { title, description, status = 'backlog', priority = 'medium', assignee_id, due_date, position = 0 } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ message: 'Task title is required.' });
    if (!TASK_STATUSES.has(status) || !PRIORITIES.has(priority)) return res.status(400).json({ message: 'Invalid task status or priority.' });
    const [result] = await pool.query(
      'INSERT INTO project_tasks (project_id, created_by, assignee_id, title, description, status, priority, due_date, position) VALUES (?,?,?,?,?,?,?,?,?)',
      [req.params.projectId, req.user.id, assignee_id || null, title.trim(), description || null, status, priority, due_date || null, position]
    );
    res.status(201).json({ task_id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Could not create project task.', error: error.message });
  }
};

exports.updateTask = async (req, res) => {
  try {
    if (!await getMembership(req.params.projectId, req.user.id)) return res.status(403).json({ message: 'You are not a member of this project.' });
    const { title, description, status, priority, assignee_id, due_date, position } = req.body;
    if (status !== undefined && !TASK_STATUSES.has(status)) return res.status(400).json({ message: 'Invalid task status.' });
    if (priority !== undefined && !PRIORITIES.has(priority)) return res.status(400).json({ message: 'Invalid task priority.' });
    const values = [];
    const fields = [];
    const updates = { title, description, status, priority, assignee_id, due_date, position };
    for (const [field, value] of Object.entries(updates)) {
      if (value !== undefined) { fields.push(`${field} = ?`); values.push(value); }
    }
    if (!fields.length) return res.status(400).json({ message: 'Nothing to update.' });
    values.push(req.params.taskId, req.params.projectId);
    const [result] = await pool.query(`UPDATE project_tasks SET ${fields.join(', ')} WHERE id = ? AND project_id = ?`, values);
    if (!result.affectedRows) return res.status(404).json({ message: 'Task not found.' });
    res.json({ message: 'Task updated.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Could not update project task.', error: error.message });
  }
};

exports.createMilestone = async (req, res) => {
  try {
    if (!await getMembership(req.params.projectId, req.user.id)) return res.status(403).json({ message: 'You are not a member of this project.' });
    const { title, due_date, progress = 0 } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ message: 'Milestone title is required.' });
    const normalizedProgress = Math.max(0, Math.min(100, Number(progress)));
    const [result] = await pool.query('INSERT INTO project_milestones (project_id, title, due_date, progress, created_by) VALUES (?,?,?,?,?)', [req.params.projectId, title.trim(), due_date || null, normalizedProgress, req.user.id]);
    res.status(201).json({ milestone_id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Could not create milestone.', error: error.message });
  }
};

exports.createReview = async (req, res) => {
  try {
    if (!await getMembership(req.params.projectId, req.user.id)) return res.status(403).json({ message: 'You are not a member of this project.' });
    const { title, description } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ message: 'Review title is required.' });
    const [result] = await pool.query('INSERT INTO project_reviews (project_id, created_by, title, description) VALUES (?,?,?,?)', [req.params.projectId, req.user.id, title.trim(), description || null]);
    res.status(201).json({ review_id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Could not create code review.', error: error.message });
  }
};

exports.addReviewComment = async (req, res) => {
  try {
    const membership = await getMembership(req.params.projectId, req.user.id);
    if (!membership) return res.status(403).json({ message: 'You are not a member of this project.' });
    const { body, file_path, line_number } = req.body;
    if (!body || !body.trim()) return res.status(400).json({ message: 'Comment body is required.' });
    const [[review]] = await pool.query('SELECT id FROM project_reviews WHERE id = ? AND project_id = ?', [req.params.reviewId, req.params.projectId]);
    if (!review) return res.status(404).json({ message: 'Review not found.' });
    const [result] = await pool.query('INSERT INTO project_review_comments (review_id, user_id, body, file_path, line_number) VALUES (?,?,?,?,?)', [req.params.reviewId, req.user.id, body.trim(), file_path || null, line_number || null]);
    res.status(201).json({ comment_id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Could not add review comment.', error: error.message });
  }
};

exports.createWikiPage = async (req, res) => {
  try {
    if (!await getMembership(req.params.projectId, req.user.id)) return res.status(403).json({ message: 'You are not a member of this project.' });
    const { title, body } = req.body;
    if (!title || !body) return res.status(400).json({ message: 'Wiki title and body are required.' });
    const [result] = await pool.query('INSERT INTO project_wiki_pages (project_id, author_id, title, body) VALUES (?,?,?,?)', [req.params.projectId, req.user.id, title.trim(), body]);
    res.status(201).json({ wiki_page_id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Could not create wiki page.', error: error.message });
  }
};

exports.createCommit = async (req, res) => {
  try {
    if (!await getMembership(req.params.projectId, req.user.id)) return res.status(403).json({ message: 'You are not a member of this project.' });
    const { message, branch = 'main', hash } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ message: 'Commit message is required.' });
    const commitHash = (hash || crypto.createHash('sha1').update(`${req.user.id}:${message}:${Date.now()}`).digest('hex')).slice(0, 40);
    const [result] = await pool.query('INSERT INTO project_commits (project_id, author_id, branch, message, hash) VALUES (?,?,?,?,?)', [req.params.projectId, req.user.id, branch, message.trim(), commitHash]);
    res.status(201).json({ commit_id: result.insertId, hash: commitHash });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Could not record commit.', error: error.message });
  }
};

exports.uploadFile = async (req, res) => {
  try {
    if (!await getMembership(req.params.projectId, req.user.id)) return res.status(403).json({ message: 'You are not a member of this project.' });
    if (!req.file) return res.status(400).json({ message: 'A file is required.' });
    const filePath = `/uploads/${req.file.filename}`;
    const [result] = await pool.query('INSERT INTO project_files (project_id, uploaded_by, name, file_path, mime_type, size_bytes) VALUES (?,?,?,?,?,?)', [req.params.projectId, req.user.id, req.file.originalname, filePath, req.file.mimetype, req.file.size]);
    res.status(201).json({ file_id: result.insertId, file_path: filePath });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Could not upload project file.', error: error.message });
  }
};
