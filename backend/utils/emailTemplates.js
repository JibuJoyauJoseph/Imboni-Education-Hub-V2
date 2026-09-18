// Branded HTML email templates for IMBONI Education Hub.
// All templates accept a small `data` object and return a full HTML string.

function brandHeader() {
  return `
    <tr>
      <td align="center" style="padding: 28px 0 10px;">
        <div style="display:inline-flex;align-items:center;gap:8px;">
          <div style="width:36px;height:36px;background:#0A5C35;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;color:#E8B800;font-weight:800;font-size:16px;">I</div>
          <span style="font-size:18px;font-weight:800;color:#0D1F13;letter-spacing:0.5px;">IMBONI</span>
        </div>
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

function shell(title, content) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
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
          <a href="${href}" style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;">${label}</a>
        </td>
      </tr>
    </table>`;
}

function infoBox(text) {
  return `<div style="background:#F4F7F4;border-left:3px solid #E8B800;padding:12px 16px;border-radius:4px;font-size:13px;color:#0D1F13;margin:16px 0;">${text}</div>`;
}

const greeting = (name) => `<p style="margin:0 0 16px;">Dear ${name || 'there'},</p>`;
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
    ${infoBox(`<code style="font-family:monospace;font-size:13px;word-break:break-all;">${token}</code>`)}
    <p style="margin:0;font-size:12px;color:#4A6054;">This link and code expire in ${expiresIn || '30 minutes'}. If you didn't request this, you can safely ignore this email.</p>
    ${closing()}
  `;
  return shell('Reset your IMBONI password', content);
};

// ─────────────────────────────────────────────────────────────────────────────
// Account created (default credentials)
// ─────────────────────────────────────────────────────────────────────────────
exports.accountCreated = (data) => {
  const { name, email, password, role, school } = data;
  const roleLabel = (role || '').replace('_', ' ').toUpperCase();
  const content = `
    ${greeting(name)}
    <p style="margin:0 0 12px;">Your ${roleLabel || 'account'} has been created${school ? ` for <strong>${school}</strong>` : ''}. You can now log in with the credentials below.</p>
    ${infoBox(`
      <strong style="display:block;margin-bottom:6px;">Login credentials</strong>
      <div style="font-family:monospace;font-size:13px;">Email: ${email}<br />Password: ${password}</div>
    `)}
    <p style="margin:0 0 12px;font-size:13px;color:#4A6054;">For security, you'll be asked to change this password the first time you log in.</p>
    ${button(`${data.frontendUrl}/login`, 'Go to login')}
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
    <p style="margin:0 0 12px;">${body}</p>
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
    <p style="margin:0 0 12px;"><strong>${studentName}</strong> has requested to join your course <strong>${courseName}</strong>.</p>
    <p style="margin:0 0 12px;font-size:13px;color:#4A6054;">You can approve or reject this request from your course management page.</p>
    ${button(`${frontendUrl}/lecturer/courses/${courseId}`, 'Review join request')}
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
    <p style="margin:0 0 12px;">Your request to join <strong>${courseName}</strong> was ${approved ? 'approved 🎉' : 'rejected'}.</p>
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
    <p style="margin:0 0 12px;"><strong>${studentName}</strong> wants to join your team <strong>${teamName}</strong>.</p>
    <p style="margin:0 0 12px;font-size:13px;color:#4A6054;">Approve or reject this request from the team dashboard.</p>
    ${button(`${frontendUrl}/student/teams/${teamId}`, 'Manage team requests')}
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
    <p style="margin:0 0 12px;">Your request to join the team <strong>${teamName}</strong> was ${approved ? 'approved 🎉' : 'rejected'}.</p>
    ${approved ? button(`${frontendUrl}/student`, 'View your teams') : ''}
    ${closing()}
  `;
  return shell(`Team join request ${approved ? 'approved' : 'rejected'}`, content);
};

// ─────────────────────────────────────────────────────────────────────────────
// Assignment due reminder
// ─────────────────────────────────────────────────────────────────────────────
exports.assignmentReminder = (data) => {
  const { name, title, courseName, dueDate, frontendUrl, courseId } = data;
  const content = `
    ${greeting(name)}
    <p style="margin:0 0 12px;">Just a reminder that <strong>${title}</strong>${courseName ? ` for <strong>${courseName}</strong>` : ''} is due on <strong>${dueDate}</strong>.</p>
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
    <p style="margin:0 0 12px;">A payment of <strong>RWF ${amount}</strong> has been recorded for <strong>${schoolName}</strong>.</p>
    <p style="margin:0 0 12px;">The school's subscription is now active until <strong>${validUntil}</strong>.</p>
    ${closing()}
  `;
  return shell('Subscription payment confirmed', content);
};

// ─────────────────────────────────────────────────────────────────────────────
// School registration confirmation (to school admin)
// ─────────────────────────────────────────────────────────────────────────────
exports.schoolRegistered = (data) => {
  const { name, schoolName, email, password } = data;
  const content = `
    ${greeting(name)}
    <p style="margin:0 0 12px;">Your school <strong>${schoolName}</strong> has been registered on IMBONI Education Hub.</p>
    ${infoBox(`
      <strong style="display:block;margin-bottom:6px;">School admin login</strong>
      <div style="font-family:monospace;font-size:13px;">Email: ${email}<br />Password: ${password}</div>
    `)}
    <p style="margin:0 0 12px;font-size:13px;color:#4A6054;">You'll be asked to change this password on first login.</p>
    ${button(`${data.frontendUrl}/login`, 'Log in as school admin')}
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
    <p style="margin:0 0 12px;">The subscription for <strong>${schoolName}</strong> will expire on <strong>${expires}</strong>.</p>
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
    <p style="margin:0 0 12px;">${body || 'You have a new notification on IMBONI.'}</p>
    ${frontendUrl ? button(frontendUrl, 'Open IMBONI') : ''}
    ${closing()}
  `;
  return shell(title, content);
};
