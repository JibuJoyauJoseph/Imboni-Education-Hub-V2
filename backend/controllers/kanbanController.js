const pool = require('../config/db');

async function ensureBoard(studentId) {
  const [[board]] = await pool.query('SELECT * FROM kanban_boards WHERE student_id = ?', [studentId]);
  if (board) return board;
  const [result] = await pool.query('INSERT INTO kanban_boards (student_id) VALUES (?)', [studentId]);
  return { id: result.insertId, student_id: studentId };
}

// GET /api/kanban  (student's personal board across all their courses)
exports.getBoard = async (req, res) => {
  try {
    const board = await ensureBoard(req.user.id);
    const [tasks] = await pool.query(
      `SELECT k.*, c.name AS course_name FROM kanban_tasks k LEFT JOIN courses c ON c.id = k.course_id
       WHERE k.board_id = ? ORDER BY k.status, k.position ASC`,
      [board.id]
    );
    res.json({ board_id: board.id, tasks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load kanban board.', error: err.message });
  }
};

// POST /api/kanban/tasks
exports.createTask = async (req, res) => {
  try {
    const board = await ensureBoard(req.user.id);
    const { title, description, course_id, due_date, status } = req.body;
    if (!title) return res.status(400).json({ message: 'Task title is required.' });

    const [result] = await pool.query(
      'INSERT INTO kanban_tasks (board_id, course_id, title, description, status, due_date) VALUES (?,?,?,?,?,?)',
      [board.id, course_id || null, title, description || null, status || 'todo', due_date || null]
    );
    res.status(201).json({ message: 'Task added.', task_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not add task.', error: err.message });
  }
};

// PATCH /api/kanban/tasks/:id  (move between todo / in_progress / done, or edit)
exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, due_date, position } = req.body;
    const board = await ensureBoard(req.user.id);

    const fields = [];
    const values = [];
    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (status !== undefined) { fields.push('status = ?'); values.push(status); }
    if (due_date !== undefined) { fields.push('due_date = ?'); values.push(due_date); }
    if (position !== undefined) { fields.push('position = ?'); values.push(position); }
    if (!fields.length) return res.status(400).json({ message: 'Nothing to update.' });

    values.push(id, board.id);
    await pool.query(`UPDATE kanban_tasks SET ${fields.join(', ')} WHERE id = ? AND board_id = ?`, values);
    res.json({ message: 'Task updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not update task.', error: err.message });
  }
};

// DELETE /api/kanban/tasks/:id
exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const board = await ensureBoard(req.user.id);
    await pool.query('DELETE FROM kanban_tasks WHERE id = ? AND board_id = ?', [id, board.id]);
    res.json({ message: 'Task removed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not remove task.', error: err.message });
  }
};
