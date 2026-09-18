const pool = require('../config/db');
const { assertEnrolled } = require('./courseController');

// POST /api/courses/:courseId/teams  (student forms a team — Rule: "form teams to do groupworks")
exports.createTeam = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Team name is required.' });

    const [[course]] = await pool.query('SELECT id, lecturer_id FROM courses WHERE id = ?', [courseId]);
    if (!course) return res.status(404).json({ message: 'Course not found.' });
    const enrolled = await assertEnrolled(req.user.id, courseId);
    const isLecturer = req.user.role === 'lecturer' && course.lecturer_id === req.user.id;
    if (!enrolled && !isLecturer) return res.status(403).json({ message: 'You must be enrolled in this course to form a team.' });

    const [result] = await pool.query(
      'INSERT INTO teams (course_id, name, created_by) VALUES (?,?,?)',
      [courseId, name, req.user.id]
    );
    if (!isLecturer) await pool.query('INSERT INTO team_members (team_id, student_id) VALUES (?,?)', [result.insertId, req.user.id]);
    res.status(201).json({ message: 'Team created.', team_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not create team.', error: err.message });
  }
};

// GET /api/courses/:courseId/students (lecturer's enrolled class directory)
exports.listCourseStudents = async (req, res) => {
  try {
    const { courseId } = req.params;
    const [[course]] = await pool.query('SELECT id FROM courses WHERE id = ? AND lecturer_id = ?', [courseId, req.user.id]);
    if (!course) return res.status(404).json({ message: 'Course not found.' });
    const [students] = await pool.query(
      `SELECT u.id, u.full_names, u.email, COALESCE(e.enrolled_at, jr.decided_at) AS enrolled_at
       FROM course_join_requests jr
       JOIN users u ON u.id = jr.student_id
       LEFT JOIN enrollments e ON e.course_id = jr.course_id AND e.student_id = jr.student_id
       WHERE jr.course_id = ? AND jr.status = 'approved' AND u.role = 'student' AND u.is_active = TRUE
       ORDER BY u.full_names`,
      [courseId]
    );
    res.json({ students });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load class students.', error: err.message });
  }
};

// POST /api/teams/:teamId/members (lecturer directly adds an enrolled student)
exports.addMemberDirect = async (req, res) => {
  try {
    const [[team]] = await pool.query(
      `SELECT t.id, t.course_id, c.lecturer_id FROM teams t JOIN courses c ON c.id = t.course_id WHERE t.id = ?`,
      [req.params.teamId]
    );
    if (!team || team.lecturer_id !== req.user.id || team.created_by !== req.user.id) return res.status(403).json({ message: 'You can only directly manage teams you created.' });
    const { student_id } = req.body;
    const [[enrollment]] = await pool.query('SELECT student_id FROM enrollments WHERE course_id = ? AND student_id = ?', [team.course_id, student_id]);
    if (!enrollment) return res.status(400).json({ message: 'The student is not enrolled in this course.' });
    await pool.query('INSERT IGNORE INTO team_members (team_id, student_id) VALUES (?,?)', [team.id, student_id]);
    await pool.query('DELETE FROM team_join_requests WHERE team_id = ? AND student_id = ? AND status = \'pending\'', [team.id, student_id]);
    res.status(201).json({ message: 'Student added to team.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not add student to team.', error: err.message });
  }
};

// GET /api/courses/:courseId/teams
exports.listTeams = async (req, res) => {
  try {
    const { courseId } = req.params;
    const lecturerFilter = req.user.role === 'lecturer' ? ' AND t.created_by = ?' : '';
    const params = req.user.role === 'lecturer'
      ? [req.user.id, req.user.id, courseId, req.user.id]
      : [req.user.id, req.user.id, courseId];
    const [teams] = await pool.query(
            `SELECT t.id, t.name, t.created_at, t.created_by, creator.full_names AS created_by_name,
              (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) AS member_count,
              EXISTS(SELECT 1 FROM team_members tm2 WHERE tm2.team_id = t.id AND tm2.student_id = ?) AS is_member
              , (SELECT status FROM team_join_requests tjr WHERE tjr.team_id = t.id AND tjr.student_id = ? ORDER BY tjr.id DESC LIMIT 1) AS my_request_status
       FROM teams t JOIN users creator ON creator.id = t.created_by WHERE t.course_id = ?${lecturerFilter} ORDER BY t.created_at DESC`,
      params
    );
    res.json({ teams });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load teams.', error: err.message });
  }
};

// POST /api/teams/:teamId/join
exports.joinTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const [[team]] = await pool.query('SELECT * FROM teams WHERE id = ?', [teamId]);
    if (!team) return res.status(404).json({ message: 'Team not found.' });

    const enrolled = await assertEnrolled(req.user.id, team.course_id);
    if (!enrolled) return res.status(403).json({ message: 'You must be enrolled in this course to join a team.' });

    const [[member]] = await pool.query('SELECT id FROM team_members WHERE team_id = ? AND student_id = ?', [teamId, req.user.id]);
    if (member) return res.json({ message: 'You are already a member of this team.' });
    await pool.query(
      `INSERT INTO team_join_requests (team_id, student_id, status) VALUES (?,?, 'pending')
       ON DUPLICATE KEY UPDATE status = 'pending', requested_at = CURRENT_TIMESTAMP, decided_at = NULL, decided_by = NULL`,
      [teamId, req.user.id]
    );
    res.json({ message: 'Join request sent. The team creator must approve it.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not join team.', error: err.message });
  }
};

// GET /api/teams/available (all teams for courses the student has joined)
exports.listAvailableForStudent = async (req, res) => {
  try {
    const [teams] = await pool.query(
      `SELECT t.id, t.name, t.course_id, c.name AS course_name, t.created_by,
              creator.full_names AS created_by_name,
              (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) AS member_count,
              EXISTS(SELECT 1 FROM team_members tm2 WHERE tm2.team_id = t.id AND tm2.student_id = ?) AS is_member,
              (SELECT status FROM team_join_requests r WHERE r.team_id = t.id AND r.student_id = ? ORDER BY r.id DESC LIMIT 1) AS my_request_status
       FROM teams t JOIN courses c ON c.id = t.course_id JOIN users creator ON creator.id = t.created_by
       JOIN enrollments e ON e.course_id = t.course_id AND e.student_id = ?
       ORDER BY c.name, t.created_at DESC`,
      [req.user.id, req.user.id, req.user.id]
    );
    res.json({ teams });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load available teams.', error: err.message });
  }
};

// GET /api/teams/:teamId/join-requests (team creator or course lecturer)
exports.listJoinRequests = async (req, res) => {
  try {
    const [[team]] = await pool.query(
      `SELECT t.id, t.created_by, c.lecturer_id FROM teams t JOIN courses c ON c.id = t.course_id WHERE t.id = ?`,
      [req.params.teamId]
    );
    if (!team || team.created_by !== req.user.id) return res.status(403).json({ message: 'Only the team creator can view requests.' });
    const [requests] = await pool.query(
      `SELECT r.id, r.student_id, r.status, r.requested_at, u.full_names, u.email
       FROM team_join_requests r JOIN users u ON u.id = r.student_id WHERE r.team_id = ? ORDER BY r.requested_at DESC`,
      [req.params.teamId]
    );
    res.json({ requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load team join requests.', error: err.message });
  }
};

// PATCH /api/teams/:teamId/join-requests/:requestId
exports.decideJoinRequest = async (req, res) => {
  try {
    const [[team]] = await pool.query(
      `SELECT t.id, t.created_by, c.lecturer_id FROM teams t JOIN courses c ON c.id = t.course_id WHERE t.id = ?`,
      [req.params.teamId]
    );
    if (!team || team.created_by !== req.user.id) return res.status(403).json({ message: 'Only the team creator can decide requests.' });
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ message: 'Decision must be approved or rejected.' });
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [[request]] = await connection.query('SELECT * FROM team_join_requests WHERE id = ? AND team_id = ?', [req.params.requestId, req.params.teamId]);
      if (!request) {
        await connection.rollback();
        return res.status(404).json({ message: 'Join request not found.' });
      }
      await connection.query('UPDATE team_join_requests SET status = ?, decided_at = CURRENT_TIMESTAMP, decided_by = ? WHERE id = ?', [status, req.user.id, request.id]);
      if (status === 'approved') await connection.query('INSERT IGNORE INTO team_members (team_id, student_id) VALUES (?,?)', [team.id, request.student_id]);
      await connection.commit();
      res.json({ message: `Join request ${status}.` });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not decide team join request.', error: err.message });
  }
};

// GET /api/teams/:teamId/members
exports.listMembers = async (req, res) => {
  try {
    const { teamId } = req.params;
    const [members] = await pool.query(
      `SELECT u.id, u.full_names, u.email FROM team_members tm JOIN users u ON u.id = tm.student_id WHERE tm.team_id = ?`,
      [teamId]
    );
    res.json({ members });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load team members.', error: err.message });
  }
};

// GET /api/teams/:teamId/progress (student views a team they joined)
exports.getTeamProgress = async (req, res) => {
  try {
    const [[team]] = await pool.query(
      `SELECT t.id, t.name, t.course_id, c.name AS course_name, t.created_by,
              creator.full_names AS created_by_name
       FROM teams t JOIN courses c ON c.id = t.course_id
       JOIN users creator ON creator.id = t.created_by
       JOIN team_members viewer ON viewer.team_id = t.id
       WHERE t.id = ? AND viewer.student_id = ?`,
      [req.params.teamId, req.user.id]
    );
    if (!team) return res.status(403).json({ message: 'You must be a member of this team to view its progress.' });

    const [members] = await pool.query(
      `SELECT u.id, u.full_names, u.email, tm.joined_at
       FROM team_members tm JOIN users u ON u.id = tm.student_id
       WHERE tm.team_id = ? ORDER BY u.full_names`,
      [team.id]
    );
    const [assignments] = await pool.query(
      `SELECT a.id, a.title, a.due_date, a.max_score,
              COUNT(DISTINCT tm.student_id) AS team_member_count,
              COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN tm.student_id END) AS submitted_count
       FROM assignments a
       JOIN team_members tm ON tm.team_id = ?
       LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = tm.student_id
       WHERE a.course_id = ?
       GROUP BY a.id ORDER BY a.due_date IS NULL, a.due_date, a.created_at DESC`,
      [team.id, team.course_id]
    );
    const totalWork = assignments.reduce((sum, assignment) => sum + Number(assignment.team_member_count), 0);
    const completedWork = assignments.reduce((sum, assignment) => sum + Number(assignment.submitted_count), 0);
    res.json({ team, members, assignments, progress_percent: totalWork ? Math.round((completedWork / totalWork) * 100) : 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load team progress.', error: err.message });
  }
};

// GET /api/courses/:courseId/team-progress (lecturer overview of every team)
exports.listCourseTeamProgress = async (req, res) => {
  try {
    const { courseId } = req.params;
    const [[course]] = await pool.query('SELECT id FROM courses WHERE id = ? AND lecturer_id = ?', [courseId, req.user.id]);
    if (!course) return res.status(404).json({ message: 'Course not found.' });
    const [teams] = await pool.query(
      `SELECT t.id, t.name, t.created_by, creator.full_names AS created_by_name,
              COUNT(DISTINCT tm.student_id) AS member_count,
              COUNT(DISTINCT a.id) AS assignment_count,
              COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN CONCAT(a.id, ':', tm.student_id) END) AS completed_work
       FROM teams t
       JOIN users creator ON creator.id = t.created_by
       LEFT JOIN team_members tm ON tm.team_id = t.id
       LEFT JOIN assignments a ON a.course_id = t.course_id
       LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = tm.student_id
      WHERE t.course_id = ? AND t.created_by = ?
       GROUP BY t.id, t.name, t.created_by, creator.full_names
       ORDER BY t.created_at DESC`,
      [courseId, req.user.id]
    );
    res.json({ teams: teams.map(team => ({
      ...team,
      progress_percent: team.member_count && team.assignment_count
        ? Math.round((Number(team.completed_work) / (Number(team.member_count) * Number(team.assignment_count))) * 100)
        : 0
    })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load team progress.', error: err.message });
  }
};
