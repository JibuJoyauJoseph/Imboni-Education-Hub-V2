const nodemailer = require('nodemailer');
const pool = require('../config/db');
const templates = require('./emailTemplates');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const MAX_ATTEMPTS = Math.max(1, Number(process.env.EMAIL_MAX_ATTEMPTS) || 3);
const EMAIL_CONCURRENCY = Math.max(1, Number(process.env.EMAIL_CONCURRENCY) || 5);

const isConfigured = () => Boolean(
  process.env.EMAIL_HOST && (
    (process.env.EMAIL_USER && process.env.EMAIL_PASS) ||
    process.env.EMAIL_ALLOW_UNAUTHENTICATED === 'true'
  )
);

let transporter = null;
function getTransporter() {
  if (!isConfigured()) return null;
  if (!transporter) {
    const port = Number(process.env.EMAIL_PORT) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port,
      secure: process.env.EMAIL_SECURE === 'true' || port === 465,
      requireTLS: port !== 465 && process.env.EMAIL_REQUIRE_TLS !== 'false',
      auth: process.env.EMAIL_USER ? { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000
    });
  }
  return transporter;
}

const fromAddress = () =>
  process.env.EMAIL_FROM_NAME
    ? `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`
    : (process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@imboni.rw');

// Persist a row whether or not the send succeeds, so we have an audit trail.
async function logEmail({ to, subject, template, status, message_id, error, meta, attempts = 0 }) {
  try {
    await pool.query(
      `INSERT INTO email_logs
        (recipient, subject, template, status, message_id, error, meta, recipient_user_id, school_id, course_id, announcement_id, attempts)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [to, subject, template || 'manual', status, message_id || null, error || null,
        meta ? JSON.stringify(meta) : null, meta?.recipientUserId || null, meta?.schoolId || null,
        meta?.courseId || null, meta?.announcementId || null, attempts]
    );
  } catch (err) {
    console.error('[emailService] Could not write email log:', err.message);
  }
}

async function send({ to, subject, html, text, template = 'manual', meta = {} }) {
  const recipient = typeof to === 'string' ? to.trim() : '';
  if (!recipient) return { status: 'failed', sent: false, error: 'A recipient email is required.' };

  let mailer;
  try {
    mailer = getTransporter();
  } catch (err) {
    await logEmail({ to: recipient, subject, template, status: 'failed', error: err.message, meta });
    return { status: 'failed', sent: false, error: 'Email transport configuration is invalid.' };
  }
  if (!mailer) {
    await logEmail({ to: recipient, subject, template, status: 'skipped', error: 'SMTP is not configured.', meta });
    return { status: 'skipped', sent: false, error: 'SMTP is not configured.' };
  }

  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await mailer.sendMail({
        from: fromAddress(),
        to: recipient,
        subject,
        text: text || '',
        html
      });
      await logEmail({ to: recipient, subject, template, status: 'sent', message_id: result.messageId, meta, attempts: attempt });
      return { status: 'sent', sent: true, messageId: result.messageId };
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) await new Promise(resolve => setTimeout(resolve, 250 * (2 ** (attempt - 1))));
    }
  }

  console.error(`[emailService] Failed to send ${template} email:`, lastError?.message);
  await logEmail({ to: recipient, subject, template, status: 'failed', error: lastError?.message, meta, attempts: MAX_ATTEMPTS });
  return { status: 'failed', sent: false, error: lastError?.message || 'Delivery failed.' };
}

async function sendMany({ recipients, subject, template, render, meta = {} }) {
  const results = new Array(recipients.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(EMAIL_CONCURRENCY, recipients.length) }, async () => {
    while (nextIndex < recipients.length) {
      const index = nextIndex++;
      const recipient = recipients[index];
      const content = render(recipient);
      results[index] = await send({
        to: recipient.email,
        subject,
        html: content.html,
        text: content.text,
        template,
        meta: { ...meta, recipientUserId: recipient.id || null }
      });
    }
  });
  await Promise.all(workers);
  return {
    total: results.length,
    sent: results.filter(result => result?.status === 'sent').length,
    failed: results.filter(result => result?.status === 'failed').length,
    skipped: results.filter(result => result?.status === 'skipped').length
  };
}

async function verifyConnection() {
  try {
    const mailer = getTransporter();
    if (!mailer) return { configured: false, verified: false };
    await mailer.verify();
    return { configured: true, verified: true };
  } catch (err) {
    console.error('[emailService] SMTP verification failed:', err.message);
    return { configured: true, verified: false };
  }
}

// ── High-level, event-specific helpers ──────────────────────────────────────
async function sendPasswordReset({ email, name, token, resetLink, userId, schoolId }) {
  const html = templates.passwordReset({ name, token, resetLink, expiresIn: '30 minutes' });
  return send({ to: email, subject: 'Reset your IMBONI password', html, template: 'password_reset', meta: { recipientUserId: userId, schoolId } });
}

async function sendRegistrationPending({ email, name, school, userId, schoolId }) {
  const html = templates.registrationPending({ name, school });
  return send({ to: email, subject: 'IMBONI registration received', html, template: 'registration_pending', meta: { recipientUserId: userId, schoolId } });
}

async function sendLoginOtp({ email, name, code, userId, schoolId }) {
  const html = templates.loginOtp({ name, code });
  return send({ to: email, subject: 'Your IMBONI sign-in code', html, template: 'login_otp', meta: { recipientUserId: userId, schoolId } });
}

async function sendPasswordChanged({ email, name, userId, schoolId }) {
  const html = templates.passwordChanged({ name, frontendUrl: FRONTEND_URL });
  return send({ to: email, subject: 'Your IMBONI password was changed', html, template: 'password_changed', meta: { recipientUserId: userId, schoolId } });
}

async function sendAccountCreated({ email, name, role, school, userId, schoolId }) {
  const html = templates.accountCreated({ name, email, role, school, frontendUrl: FRONTEND_URL });
  return send({ to: email, subject: 'Your IMBONI account is ready', html, template: 'account_created', meta: { recipientUserId: userId, schoolId } });
}

async function sendApprovalDecision({ email, name, decision, userId, schoolId }) {
  const html = templates.approvalDecision({ name, decision, frontendUrl: FRONTEND_URL });
  return send({ to: email, subject: decision === 'approved' ? 'Your account has been approved' : 'Your registration was not approved', html, template: 'approval_decision', meta: { recipientUserId: userId, schoolId, decision } });
}

async function sendJoinRequestReceived({ email, name, studentName, courseName, courseId, schoolId, recipientUserId }) {
  const html = templates.joinRequestReceived({ name, studentName, courseName, courseId, frontendUrl: FRONTEND_URL });
  return send({ to: email, subject: 'New course join request', html, template: 'join_request_received', meta: { recipientUserId, schoolId, courseId } });
}

async function sendJoinRequestDecision({ email, name, decision, courseName, courseId, schoolId, recipientUserId }) {
  const html = templates.joinRequestDecision({ name, decision, courseName, frontendUrl: FRONTEND_URL });
  return send({ to: email, subject: `Join request ${decision}`, html, template: 'join_request_decision', meta: { recipientUserId, schoolId, courseId, decision } });
}

async function sendTeamJoinRequest({ email, name, studentName, teamName, teamId, schoolId, recipientUserId }) {
  const html = templates.teamJoinRequest({ name, studentName, teamName, teamId, frontendUrl: FRONTEND_URL });
  return send({ to: email, subject: 'New team join request', html, template: 'team_join_request', meta: { recipientUserId, schoolId, teamId } });
}

async function sendTeamJoinDecision({ email, name, decision, teamName, schoolId, recipientUserId }) {
  const html = templates.teamJoinDecision({ name, decision, teamName, frontendUrl: FRONTEND_URL });
  return send({ to: email, subject: `Team join request ${decision}`, html, template: 'team_join_decision', meta: { recipientUserId, schoolId, decision } });
}

async function sendAssignmentReminder({ email, name, title, courseName, dueDate, courseId, schoolId, studentId, reminderType }) {
  const isNew = reminderType === 'new';
  const html = templates.assignmentReminder({ name, title, courseName, dueDate, courseId, frontendUrl: FRONTEND_URL, isNew });
  return send({ to: email, subject: isNew ? 'New assignment posted' : 'Assignment due soon', html, template: isNew ? 'new_assignment' : 'assignment_reminder', meta: { recipientUserId: studentId, schoolId, courseId, reminderType } });
}

async function sendPaymentConfirmation({ email, name, schoolName, amount, validUntil, schoolId, recipientUserId }) {
  const html = templates.paymentConfirmation({ name, schoolName, amount, validUntil });
  return send({ to: email, subject: 'Subscription payment confirmed', html, template: 'payment_confirmation', meta: { recipientUserId, schoolId } });
}

async function sendSchoolRegistered({ email, name, schoolName, userId, schoolId }) {
  const html = templates.schoolRegistered({ name, schoolName, email, frontendUrl: FRONTEND_URL });
  return send({ to: email, subject: 'School registered on IMBONI', html, template: 'school_registered', meta: { recipientUserId: userId, schoolId } });
}

async function sendSubscriptionExpiring({ email, name, schoolName, expires, schoolId, recipientUserId }) {
  const html = templates.subscriptionExpiring({ name, schoolName, expires });
  return send({ to: email, subject: 'Subscription expiring soon', html, template: 'subscription_expiring', meta: { recipientUserId, schoolId } });
}

async function sendNotification({ email, name, title, body, frontendUrl, schoolId, recipientUserId }) {
  const html = templates.notification({ name, title, body, frontendUrl: frontendUrl || FRONTEND_URL });
  return send({ to: email, subject: title, html, template: 'notification', meta: { recipientUserId, schoolId } });
}

async function sendAnnouncement({ recipients, title, body, schoolId, courseId, announcementId }) {
  return sendMany({
    recipients,
    subject: `IMBONI announcement: ${title}`,
    template: 'announcement',
    render: recipient => ({
      html: templates.announcement({ name: recipient.full_names, title, body, frontendUrl: FRONTEND_URL }),
      text: `${title}\n\n${body}\n\n${FRONTEND_URL}`
    }),
    meta: { schoolId, courseId, announcementId }
  });
}

async function sendNewAssignmentNotice({ recipients, title, courseName, dueDate, courseId, schoolId }) {
  return sendMany({
    recipients,
    subject: `New assignment: ${title}`,
    template: 'new_assignment',
    render: recipient => ({
      html: templates.assignmentReminder({ name: recipient.full_names, title, courseName, dueDate, frontendUrl: FRONTEND_URL, courseId, isNew: true }),
      text: `${title}${courseName ? ` - ${courseName}` : ''}${dueDate ? ` is due ${dueDate}` : ''}. Open your student dashboard: ${FRONTEND_URL}/student`
    }),
    meta: { schoolId, courseId }
  });
}

module.exports = {
  send,
  sendMany,
  isConfigured,
  verifyConnection,
  sendPasswordReset,
  sendRegistrationPending,
  sendLoginOtp,
  sendPasswordChanged,
  sendAccountCreated,
  sendApprovalDecision,
  sendJoinRequestReceived,
  sendJoinRequestDecision,
  sendTeamJoinRequest,
  sendTeamJoinDecision,
  sendAssignmentReminder,
  sendPaymentConfirmation,
  sendSchoolRegistered,
  sendSubscriptionExpiring,
  sendNotification,
  sendAnnouncement,
  sendNewAssignmentNotice
};
