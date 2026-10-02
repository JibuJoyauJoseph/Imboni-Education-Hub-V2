// Branded HTML email templates for IMBONI Education Hub.
// All templates accept a small `data` object and return a full HTML string.

function brandHeader() {
  return `
    <tr>
      <td align="center" style="padding: 28px 0 10px;">
        <div style="font-size:22px;font-weight:800;color:#0D1F13;">IMBONI</div>
        <div style="font-size:10px;letter-spacing:2px;color:#4A6054;text-transform:uppercase;margin-top:4px;">Education Hub</div>
      </td>
    </tr>
    <tr><td style="height:1px;background:#D1DDD5;font-size:0;"></td></tr>
  `;
}

function brandFooter() {
  return `
    <tr>
      <td align="center" style="padding:24px 0 8px;">
        <div style="font-size:11px;color:#4A6054;">© 2026 IMBONI Education Hub · Kigali, Rwanda</div>
        <div style="font-size:11px;color:#8FB89E;margin-top:2px;">Made with pride for Rwanda's students</div>
      </td>
    </tr>
  `;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function shell(title, content) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#F4F7F4;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4F7F4;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #E2EBE5;">
            ${brandHeader()}
            <tr>
              <td style="padding:28px 32px;font-size:15px;line-height:1.65;color:#0D1F13;">
                ${content}
              </td>
            </tr>
            ${brandFooter()}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(href, label) {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:22px 0;">
      <tr>
        <td align="center" style="border-radius:10px;background:#0A5C35;">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a>
        </td>
      </tr>
    </table>`;
}

function infoBox(text) {
  return `<div style="background:#F4F7F4;border-left:3px solid #E8B800;padding:12px 16px;border-radius:4px;font-size:13px;color:#0D1F13;margin:16px 0;">${text}</div>`;
}

const greeting = (name) => `<p style="margin:0 0 16px;">Dear ${escapeHtml(name || 'there')},</p>`;
const closing = () => `<p style="margin:18px 0 0;">Warm regards,<br /><strong>The IMBONI Team</strong></p>`;

// ─────────────────────────────────────────────────────────────────────────────
// Password reset
// ─────────────────────────────────────────────────────────────────────────────
exports.passwordReset = (data) => {
  const { name, resetLink, token, expiresIn } = data;
  const content = `
    ${greeting(name)}
    <p style="margin:0 0 12px;">We received a request to reset the password for your IMBONI account. Click the button below to set a new password.</p>
    ${button(resetLink, 'Reset your password')}
    <p style="margin:0 0 12px;font-size:13px;color:#4A6054;">Or paste this code into the reset page:</p>
    ${infoBox(`<code style="font-family:monospace;font-size:13px;word-break:break-all;">${escapeHtml(token)}</code>`)}
    <p style="margin:0;font-size:12px;color:#4A6054;">This link and code expire in ${escapeHtml(expiresIn || '30 minutes')}. If you didn't request this, you can safely ignore this email.</p>
    ${closing()}
  `;
  return shell('Reset your IMBONI password', content);
};

exports.registrationPending = ({ name, school }) => {
  const content = `
    ${greeting(name)}
    <p style="margin:0 0 12px;">We received your request to join IMBONI Education Hub${school ? ` at <strong>${escapeHtml(school)}</strong>` : ''}. Your school administrator must review it before you can sign in.</p>
    <p style="margin:0 0 12px;font-size:13px;color:#4A6054;">We'll send another email when your account is approved or rejected.</p>
    ${closing()}
  `;
  return shell('IMBONI registration received', content);
};

exports.loginOtp = ({ name, code }) => {
  const content = `
    ${greeting(name)}
    <p style="margin:0 0 12px;">Use this one-time code to finish signing in to your IMBONI staff account.</p>
    ${infoBox(`<strong style="font-family:monospace;font-size:24px;letter-spacing:6px;">${escapeHtml(code)}</strong>`)}
    <p style="margin:0;font-size:12px;color:#4A6054;">This code expires in 10 minutes and can only be used once. If you did not try to sign in, ignore this message and consider changing your password.</p>
    ${closing()}
  `;
  return shell('Your IMBONI sign-in code', content);
};

exports.passwordChanged = ({ name, frontendUrl }) => {
  const content = `
    ${greeting(name)}
    <p style="margin:0 0 12px;">Your IMBONI password was changed successfully.</p>
    <p style="margin:0 0 12px;font-size:13px;color:#4A6054;">If you did not make this change, contact your school administrator and secure your email account.</p>
    ${button(`${frontendUrl}/login`, 'Go to IMBONI')}
    ${closing()}
  `;
  return shell('Your IMBONI password was changed', content);
};

// ─────────────────────────────────────────────────────────────────────────────
// Account created (default credentials)
// ─────────────────────────────────────────────────────────────────────────────
exports.accountCreated = (data) => {
  const { name, email, role, school, frontendUrl } = data;
  const roleLabel = escapeHtml((role || '').replace('_', ' ').toUpperCase());
  const content = `
    ${greeting(name)}
    <p style="margin:0 0 12px;">Your ${roleLabel || 'account'} has been created${school ? ` for <strong>${escapeHtml(school)}</strong>` : ''}. Use the temporary login details provided by your school administrator.</p>
    <p style="margin:0 0 12px;font-size:13px;color:#4A6054;">You will be asked to change your password after your first login. Staff accounts also require an email sign-in code.</p>
    <p style="margin:0 0 12px;font-family:monospace;font-size:13px;">Account email: ${escapeHtml(email)}</p>
    ${button(`${frontendUrl}/login`, 'Go to login')}
    ${closing()}
  `;
  return shell('Your IMBONI account is ready', content);
};

// ─────────────────────────────────────────────────────────────────────────────
// Student approval decision
// ─────────────────────────────────────────────────────────────────────────────
exports.approvalDecision = (data) => {
  const { name, decision, frontendUrl } = data;
  const approved = decision === 'approved';
  const heading = approved ? 'Your account has been approved' : 'Your registration was not approved';
  const body = approved
    ? 'Congratulations! Your IMBONI account has been approved. You can now log in and start exploring your courses, teams, and learning resources.'
    : 'Unfortunately your registration was not approved. Please contact your school admin for more information.';
  const content = `
    ${greeting(name)}
    <p style="margin:0 0 12px;">${escapeHtml(body)}</p>
    ${approved ? button(`${frontendUrl}/login`, 'Log in to IMBONI') : ''}
    ${closing()}
  `;
  return shell(heading, content);
};

// ─────────────────────────────────────────────────────────────────────────────
// Course join request received (to lecturer)
// ─────────────────────────────────────────────────────────────────────────────
exports.joinRequestReceived = (data) => {
  const { name, studentName, courseName, frontendUrl, courseId } = data;
  const content = `
    ${greeting(name)}
    <p style="margin:0 0 12px;"><strong>${escapeHtml(studentName)}</strong> has requested to join your course <strong>${escapeHtml(courseName)}</strong>.</p>
    <p style="margin:0 0 12px;font-size:13px;color:#4A6054;">You can approve or reject this request from your course management page.</p>
    ${button(`${frontendUrl}/lecturer/courses/${encodeURIComponent(courseId)}`, 'Review join request')}
    ${closing()}
  `;
  return shell('New course join request', content);
};

// ─────────────────────────────────────────────────────────────────────────────
// Course join request decision (to student)
// ─────────────────────────────────────────────────────────────────────────────
exports.joinRequestDecision = (data) => {
  const { name, decision, courseName, frontendUrl } = data;
  const approved = decision === 'approved';
  const content = `
    ${greeting(name)}
    <p style="margin:0 0 12px;">Your request to join <strong>${escapeHtml(courseName)}</strong> was ${approved ? 'approved' : 'rejected'}.</p>
    ${approved ? `<p style="margin:0 0 12px;">You can now access the course's teams, resources, and tasks.</p>${button(`${frontendUrl}/student`, 'Go to your dashboard')}` : ''}
    ${closing()}
  `;
  return shell(`Join request ${approved ? 'approved' : 'rejected'}`, content);
};

// ─────────────────────────────────────────────────────────────────────────────
// Team join request (to team creator)
// ─────────────────────────────────────────────────────────────────────────────
exports.teamJoinRequest = (data) => {
  const { name, studentName, teamName, frontendUrl, teamId } = data;
  const content = `
    ${greeting(name)}
    <p style="margin:0 0 12px;"><strong>${escapeHtml(studentName)}</strong> wants to join your team <strong>${escapeHtml(teamName)}</strong>.</p>
    <p style="margin:0 0 12px;font-size:13px;color:#4A6054;">Approve or reject this request from the team dashboard.</p>
    ${button(`${frontendUrl}/student/teams/${encodeURIComponent(teamId)}`, 'Manage team requests')}
    ${closing()}
  `;
  return shell('New team join request', content);
};

// ─────────────────────────────────────────────────────────────────────────────
// Team join decision (to student)
// ─────────────────────────────────────────────────────────────────────────────
exports.teamJoinDecision = (data) => {
  const { name, decision, teamName, frontendUrl } = data;
  const approved = decision === 'approved';
  const content = `
    ${greeting(name)}
    <p style="margin:0 0 12px;">Your request to join the team <strong>${escapeHtml(teamName)}</strong> was ${approved ? 'approved' : 'rejected'}.</p>
    ${approved ? button(`${frontendUrl}/student`, 'View your teams') : ''}
    ${closing()}
  `;
  return shell(`Team join request ${approved ? 'approved' : 'rejected'}`, content);
};

// ─────────────────────────────────────────────────────────────────────────────
// Assignment due reminder
// ─────────────────────────────────────────────────────────────────────────────
exports.assignmentReminder = (data) => {
  const { name, title, courseName, dueDate, frontendUrl, isNew } = data;
  const content = `
    ${greeting(name)}
    <p style="margin:0 0 12px;">${isNew ? 'A new assignment is available:' : 'Reminder:'} <strong>${escapeHtml(title)}</strong>${courseName ? ` for <strong>${escapeHtml(courseName)}</strong>` : ''}${dueDate ? ` is due on <strong>${escapeHtml(dueDate)}</strong>` : ''}.</p>
    <p style="margin:0 0 12px;font-size:13px;color:#4A6054;">Make sure to submit your work before the deadline.</p>
    ${button(`${frontendUrl}/student`, 'Go to your dashboard')}
    ${closing()}
  `;
  return shell('Assignment due soon', content);
};

// ─────────────────────────────────────────────────────────────────────────────
// Payment / subscription confirmation
// ─────────────────────────────────────────────────────────────────────────────
exports.paymentConfirmation = (data) => {
  const { name, schoolName, amount, validUntil } = data;
  const content = `
    ${greeting(name)}
    <p style="margin:0 0 12px;">A payment of <strong>RWF ${escapeHtml(amount)}</strong> has been recorded for <strong>${escapeHtml(schoolName)}</strong>.</p>
    <p style="margin:0 0 12px;">The school's subscription is now active until <strong>${escapeHtml(validUntil)}</strong>.</p>
    ${closing()}
  `;
  return shell('Subscription payment confirmed', content);
};

// ─────────────────────────────────────────────────────────────────────────────
// School registration confirmation (to school admin)
// ─────────────────────────────────────────────────────────────────────────────
exports.schoolRegistered = (data) => {
  const { name, schoolName, email, frontendUrl } = data;
  const content = `
    ${greeting(name)}
    <p style="margin:0 0 12px;">Your school <strong>${escapeHtml(schoolName)}</strong> has been registered on IMBONI Education Hub.</p>
    <p style="margin:0 0 12px;font-family:monospace;font-size:13px;">Admin account email: ${escapeHtml(email)}</p>
    <p style="margin:0 0 12px;font-size:13px;color:#4A6054;">Use the temporary password provided by the platform administrator. You will be asked to change it on first login, then verify sign-ins using an email code.</p>
    ${button(`${frontendUrl}/login`, 'Log in as school admin')}
    ${closing()}
  `;
  return shell('School registered on IMBONI', content);
};

// ─────────────────────────────────────────────────────────────────────────────
// Subscription expiring soon (to school admin)
// ─────────────────────────────────────────────────────────────────────────────
exports.subscriptionExpiring = (data) => {
  const { name, schoolName, expires } = data;
  const content = `
    ${greeting(name)}
    <p style="margin:0 0 12px;">The subscription for <strong>${escapeHtml(schoolName)}</strong> will expire on <strong>${escapeHtml(expires)}</strong>.</p>
    <p style="margin:0 0 12px;font-size:13px;color:#4A6054;">Please record the next payment to keep your students' access uninterrupted.</p>
    ${closing()}
  `;
  return shell('Subscription expiring soon', content);
};

// ─────────────────────────────────────────────────────────────────────────────
// Generic notification
// ─────────────────────────────────────────────────────────────────────────────
exports.notification = (data) => {
  const { name, title, body, frontendUrl } = data;
  const content = `
    ${greeting(name)}
    <p style="margin:0 0 12px;">${escapeHtml(body || 'You have a new notification on IMBONI.').replace(/\r?\n/g, '<br />')}</p>
    ${frontendUrl ? button(frontendUrl, 'Open IMBONI') : ''}
    ${closing()}
  `;
  return shell(title, content);
};

exports.announcement = ({ name, title, body, frontendUrl }) => {
  const safeTitle = escapeHtml(title);
  const content = `
    ${greeting(name)}
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${safeTitle}</h1>
    <p style="margin:0 0 12px;">${escapeHtml(body).replace(/\r?\n/g, '<br />')}</p>
    ${button(`${frontendUrl}/student`, 'Open your student dashboard')}
    ${closing()}
  `;
  return shell(safeTitle, content);
};
