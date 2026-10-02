const pool = require('../config/db');
const emailService = require('../utils/emailService');

function validateAnnouncement(body) {
  const title = String(body.title || '').trim();
  const message = String(body.body || '').trim();
  if (!title || !message) return { error: 'A subject and message are required.' };
  if (title.length > 200) return { error: 'Subject must be 200 characters or fewer.' };
  if (message.length > 5000) return { error: 'Message must be 5,000 characters or fewer.' };
  return { title, message };
}

async function createAnnouncement({ req, res, recipients, schoolId, courseId, title, body }) {
  if (!recipients.length) return res.status(400).json({ message: 'There are no approved students in this audience yet.' });

  const [campaignResult] = await pool.query(
    `INSERT INTO email_announcements
       (school_id, course_id, created_by, title, body, status, recipient_count)
     VALUES (?,?,?,?,?,'sending',?)`,
    [schoolId, courseId || null, req.user.id, title, body, recipients.length]
  );
  const announcementId = campaignResult.insertId;

  await pool.query(
    'INSERT INTO notifications (user_id, title, body) VALUES ?',
    [recipients.map(recipient => [recipient.id, title, body])]
  );

  const delivery = await emailService.sendAnnouncement({ recipients, title, body, schoolId, courseId, announcementId });
  const status = delivery.sent === delivery.total ? 'sent' : delivery.sent > 0 ? 'partial' : 'failed';
  await pool.query(
    `UPDATE email_announcements
     SET status = ?, sent_count = ?, failed_count = ?, skipped_count = ?
     WHERE id = ?`,
    [status, delivery.sent, delivery.failed, delivery.skipped, announcementId]
  );

  res.status(201).json({
    message: delivery.sent === delivery.total
      ? 'Announcement sent to all students.'
      : `Announcement processed: ${delivery.sent} sent, ${delivery.failed} failed, ${delivery.skipped} skipped.`,
    announcement_id: announcementId,
    delivery
  });
}

exports.createSchoolAnnouncement = async (req, res) => {
  try {
    const validated = validateAnnouncement(req.body);
    if (validated.error) return res.status(400).json({ message: validated.error });

    const [[{ recentCount }]] = await pool.query(
      'SELECT COUNT(*) AS recentCount FROM email_announcements WHERE created_by = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)',
      [req.user.id]
    );
    if (Number(recentCount) >= 10) return res.status(429).json({ message: 'Daily announcement limit reached. Try again tomorrow.' });

    const [recipients] = await pool.query(
      `SELECT id, email, full_names FROM users
       WHERE school_id = ? AND role = 'student' AND approval_status = 'approved' AND is_active = TRUE
       ORDER BY id`,
      [req.user.school_id]
    );
    return await createAnnouncement({
      req, res, recipients, schoolId: req.user.school_id, courseId: null,
      title: validated.title, body: validated.message
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not send school announcement.' });
  }
};

exports.createCourseAnnouncement = async (req, res) => {
  try {
    const validated = validateAnnouncement(req.body);
    if (validated.error) return res.status(400).json({ message: validated.error });

    const [[course]] = await pool.query(
      'SELECT id, school_id FROM courses WHERE id = ? AND lecturer_id = ?',
      [req.params.courseId, req.user.id]
    );
    if (!course) return res.status(404).json({ message: 'Course not found.' });

    const [[{ recentCount }]] = await pool.query(
      'SELECT COUNT(*) AS recentCount FROM email_announcements WHERE created_by = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)',
      [req.user.id]
    );
    if (Number(recentCount) >= 10) return res.status(429).json({ message: 'Daily announcement limit reached. Try again tomorrow.' });

    const [recipients] = await pool.query(
      `SELECT u.id, u.email, u.full_names
       FROM enrollments e JOIN users u ON u.id = e.student_id
       WHERE e.course_id = ? AND u.role = 'student' AND u.approval_status = 'approved' AND u.is_active = TRUE
       ORDER BY u.id`,
      [course.id]
    );
    return await createAnnouncement({
      req, res, recipients, schoolId: course.school_id, courseId: course.id,
      title: validated.title, body: validated.message
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not send course announcement.' });
  }
};

exports.getEmailStatus = async (req, res) => {
  const connection = await emailService.verifyConnection();
  res.json(connection);
};

exports.sendTestEmail = async (req, res) => {
  const result = await emailService.sendNotification({
    email: req.user.email,
    name: req.user.full_names,
    title: 'IMBONI email delivery test',
    body: 'This is a test message confirming that IMBONI can deliver email to this account.',
    schoolId: req.user.school_id,
    recipientUserId: req.user.id
  });
  if (!result.sent) return res.status(503).json({ message: result.error || 'Test email could not be delivered.' });
  res.json({ message: `Test email sent to ${req.user.email}.` });
};

exports.listEmailLogs = async (req, res) => {
  try {
    let sql = `SELECT id, recipient, subject, template, status, error, attempts, created_at
               FROM email_logs`;
    let params;
    if (req.user.role === 'school_admin') {
      sql += ' WHERE school_id = ?';
      params = [req.user.school_id];
    } else if (req.user.role === 'platform_admin') {
      params = [];
    } else {
      sql += ' WHERE recipient_user_id = ? OR course_id IN (SELECT id FROM courses WHERE lecturer_id = ?)';
      params = [req.user.id, req.user.id];
    }
    sql += ' ORDER BY created_at DESC LIMIT 100';
    const [logs] = await pool.query(sql, params);
    res.json({ logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load email delivery history.' });
  }
};