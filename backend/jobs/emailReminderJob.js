const cron = require('node-cron');
const pool = require('../config/db');
const emailService = require('../utils/emailService');

const REMINDER_WINDOWS = [
  { type: '24h', condition: 'a.due_date > DATE_ADD(NOW(), INTERVAL 23 HOUR) AND a.due_date <= DATE_ADD(NOW(), INTERVAL 24 HOUR)' },
  { type: '1h', condition: 'a.due_date > NOW() AND a.due_date <= DATE_ADD(NOW(), INTERVAL 1 HOUR)' }
];

let sweepRunning = false;

async function sendReminderWindow(window) {
  const [recipients] = await pool.query(
    `SELECT a.id AS assignment_id, a.title, a.due_date,
            c.id AS course_id, c.name AS course_name, c.school_id,
            u.id AS student_id, u.email, u.full_names
     FROM assignments a
     JOIN courses c ON c.id = a.course_id
     JOIN enrollments e ON e.course_id = c.id
     JOIN users u ON u.id = e.student_id
     LEFT JOIN submissions sub ON sub.assignment_id = a.id AND sub.student_id = u.id
     WHERE ${window.condition}
       AND sub.id IS NULL
       AND u.role = 'student' AND u.approval_status = 'approved' AND u.is_active = TRUE
     ORDER BY a.due_date ASC, u.id ASC`,
    []
  );

  for (const recipient of recipients) {
    const [insertResult] = await pool.query(
      `INSERT IGNORE INTO email_reminder_deliveries
         (assignment_id, student_id, due_at, reminder_type, status)
       VALUES (?,?,?,?,'processing')`,
      [recipient.assignment_id, recipient.student_id, recipient.due_date, window.type]
    );
    let deliveryId = insertResult.insertId;
    if (!insertResult.affectedRows) {
      const [claimResult] = await pool.query(
        `UPDATE email_reminder_deliveries SET status = 'processing', error = NULL, created_at = CURRENT_TIMESTAMP
         WHERE assignment_id = ? AND student_id = ? AND due_at = ? AND reminder_type = ?
           AND (status = 'failed' OR (status = 'processing' AND created_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)))`,
        [recipient.assignment_id, recipient.student_id, recipient.due_date, window.type]
      );
      if (!claimResult.affectedRows) continue;
      const [[delivery]] = await pool.query(
        `SELECT id FROM email_reminder_deliveries
         WHERE assignment_id = ? AND student_id = ? AND due_at = ? AND reminder_type = ?`,
        [recipient.assignment_id, recipient.student_id, recipient.due_date, window.type]
      );
      deliveryId = delivery.id;
    }

    const result = await emailService.sendAssignmentReminder({
      email: recipient.email,
      name: recipient.full_names,
      title: recipient.title,
      courseName: recipient.course_name,
      dueDate: new Date(recipient.due_date).toLocaleString(),
      courseId: recipient.course_id,
      schoolId: recipient.school_id,
      studentId: recipient.student_id,
      reminderType: window.type
    });
    const status = result.status === 'sent' ? 'sent' : 'failed';
    await pool.query(
      `UPDATE email_reminder_deliveries
       SET status = ?, error = ?, sent_at = IF(? = 'sent', NOW(), sent_at)
       WHERE id = ?`,
      [status, result.error || null, status, deliveryId]
    );
  }
}

async function runEmailReminderSweep() {
  if (sweepRunning || !emailService.isConfigured()) return;
  sweepRunning = true;
  try {
    for (const window of REMINDER_WINDOWS) await sendReminderWindow(window);
  } catch (err) {
    console.error('[emailReminderJob] Reminder sweep failed:', err.message);
  } finally {
    sweepRunning = false;
  }
}

function startEmailReminderJob() {
  cron.schedule('*/15 * * * *', () => { runEmailReminderSweep(); }, {
    timezone: process.env.EMAIL_CRON_TIMEZONE || 'UTC'
  });
  cron.schedule('10 3 * * *', async () => {
    try {
      await pool.query('DELETE FROM email_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 180 DAY)');
      await pool.query('DELETE FROM email_login_otps WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)');
      await pool.query('DELETE FROM email_reminder_deliveries WHERE due_at < DATE_SUB(NOW(), INTERVAL 180 DAY)');
    } catch (err) {
      console.error('[emailReminderJob] Email log cleanup failed:', err.message);
    }
  }, { timezone: process.env.EMAIL_CRON_TIMEZONE || 'UTC' });
  runEmailReminderSweep();
}

module.exports = { startEmailReminderJob, runEmailReminderSweep };