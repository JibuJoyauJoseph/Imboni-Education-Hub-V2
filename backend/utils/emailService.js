const nodemailer = require('nodemailer');
const pool = require('../config/db');
const templates = require('./emailTemplates');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Returns true when SMTP has been configured; otherwise the service falls
// back to a "dry run" that only logs to the email_logs table (dev mode).
const isConfigured = () =>
  !!(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS);

let transporter = null;
if (isConfigured()) {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: Number(process.env.EMAIL_PORT) === 465, // true for 465, false for others
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
}

const fromAddress = () =>
  process.env.EMAIL_FROM_NAME
    ? `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`
    : (process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@imboni.rw');

// Persist a row whether or not the send succeeds, so we have an audit trail.
async function logEmail({ to, subject, template, status, message_id, error, meta }) {
  try {
    await pool.query(
      `INSERT INTO email_logs (recipient, subject, template, status, message_id, error, meta)
       VALUES (?,?,?,?,?,?,?)`,
      [to, subject, template || 'manual', status, message_id || null, error || null, meta ? JSON.stringify(meta) : null]
    );
  } catch (err) {
    console.error('[emailService] Could not write email log: - emailService.js:36', err.message);
  }
}

// Low-level send. Always logs the outcome. Returns the send result or null
// in dry-run mode (when SMTP isn't configured).
async function send({ to, subject, html, text, template = 'manual', meta }) {
  const recipient = Array.isArray(to) ? to.join(', ') : to;
  if (!recipient) return null;

  try {
    if (isConfigured()) {
      const result = await transporter.sendMail({
        from: fromAddress(),
        to: recipient,
        subject,
        text: text || '',
        html
      });
      await logEmail({ to: recipient, subject, template, status: 'sent', message_id: result.messageId, meta });
      return result;
    }

    // Dry run — no SMTP has been configured. Record intent and go on.
    await logEmail({ to: recipient, subject, template, status: 'queued', meta });
    console.log(`[emailService][dryrun] > ${recipient} :: ${subject} - emailService.js:61`);
    return { messageId: `dryrun-${Date.now()}` };
  } catch (err) {
    console.error(`[emailService] Failed to send to ${recipient}: - emailService.js:64`, err.message);
    await logEmail({ to: recipient, subject, template, status: 'failed', error: err.message, meta });
    return null;
  }
}

// ── High-level, event-specific helpers ──────────────────────────────────────
async function sendPasswordReset({ email, name, token, resetLink }) {
  const html = templates.passwordReset({ name, token, resetLink, frontendUrl: FRONTEND_URL });
  return send({ to: email, subject: 'Reset your IMBONI password', html, template: 'password_reset', meta: { email } });
}

async function sendAccountCreated({ email, name, password, role, school }) {
  const html = templates.accountCreated({ name, email, password, role, school, frontendUrl: FRONTEND_URL });
  return send({ to: email, subject: 'Your IMBONI account is ready', html, template: 'account_created', meta: { email } });
}

async function sendApprovalDecision({ email, name, decision }) {
  const html = templates.approvalDecision({ name, decision, frontendUrl: FRONTEND_URL });
  return send({ to: email, subject: decision === 'approved' ? 'Your account has been approved' : 'Your registration was not approved', html, template: 'approval_decision', meta: { email, decision } });
}

async function sendJoinRequestReceived({ email, name, studentName, courseName, courseId }) {
  const html = templates.joinRequestReceived({ name, studentName, courseName, courseId, frontendUrl: FRONTEND_URL });
  return send({ to: email, subject: 'New course join request', html, template: 'join_request_received', meta: { email, courseId } });
}

async function sendJoinRequestDecision({ email, name, decision, courseName }) {
  const html = templates.joinRequestDecision({ name, decision, courseName, frontendUrl: FRONTEND_URL });
  return send({ to: email, subject: `Join request ${decision}`, html, template: 'join_request_decision', meta: { email, decision } });
}

async function sendTeamJoinRequest({ email, name, studentName, teamName, teamId }) {
  const html = templates.teamJoinRequest({ name, studentName, teamName, teamId, frontendUrl: FRONTEND_URL });
  return send({ to: email, subject: 'New team join request', html, template: 'team_join_request', meta: { email, teamId } });
}

async function sendTeamJoinDecision({ email, name, decision, teamName }) {
  const html = templates.teamJoinDecision({ name, decision, teamName, frontendUrl: FRONTEND_URL });
  return send({ to: email, subject: `Team join request ${decision}`, html, template: 'team_join_decision', meta: { email, decision } });
}

async function sendAssignmentReminder({ email, name, title, courseName, dueDate, courseId }) {
  const html = templates.assignmentReminder({ name, title, courseName, dueDate, courseId, frontendUrl: FRONTEND_URL });
  return send({ to: email, subject: 'Assignment due soon', html, template: 'assignment_reminder', meta: { email } });
}

async function sendPaymentConfirmation({ email, name, schoolName, amount, validUntil }) {
  const html = templates.paymentConfirmation({ name, schoolName, amount, validUntil });
  return send({ to: email, subject: 'Subscription payment confirmed', html, template: 'payment_confirmation', meta: { email } });
}

async function sendSchoolRegistered({ email, name, schoolName, password }) {
  const html = templates.schoolRegistered({ name, schoolName, email, password, frontendUrl: FRONTEND_URL });
  return send({ to: email, subject: 'School registered on IMBONI', html, template: 'school_registered', meta: { email } });
}

async function sendSubscriptionExpiring({ email, name, schoolName, expires }) {
  const html = templates.subscriptionExpiring({ name, schoolName, expires });
  return send({ to: email, subject: 'Subscription expiring soon', html, template: 'subscription_expiring', meta: { email } });
}

async function sendNotification({ email, name, title, body, frontendUrl }) {
  const html = templates.notification({ name, title, body, frontendUrl: frontendUrl || FRONTEND_URL });
  return send({ to: email, subject: title, html, template: 'notification', meta: { email } });
}

module.exports = {
  send,
  isConfigured,
  sendPasswordReset,
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
  sendNotification
};
