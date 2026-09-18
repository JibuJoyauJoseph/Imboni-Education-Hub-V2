// Rule 6: "Admin creates a new lecturer account or student account with
// default name & password which can be changed later after the owner's
// login for the first time."

function slugifyName(fullNames) {
  return fullNames
    .toLowerCase()
    .trim()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .join('.');
}

function generateDefaultUsername(fullNames) {
  return slugifyName(fullNames);
}

// Simple, memorable default password the owner is forced to change on
// first login (must_change_password = true, enforced by /auth/login).
function generateDefaultPassword() {
  const random = Math.floor(1000 + Math.random() * 9000);
  return `Imboni@${random}`;
}

module.exports = { generateDefaultUsername, generateDefaultPassword };
