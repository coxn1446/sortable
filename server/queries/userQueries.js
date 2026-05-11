const db = require('../db');

const USER_FIELDS = `
  user_id,
  username,
  email,
  google_email,
  apple_email,
  profile_picture,
  google_id,
  apple_id,
  privacy_policy_agreed,
  terms_agreed,
  created_at,
  updated_at
`;

const USER_FIELDS_WITH_PASSWORD = `${USER_FIELDS}, password`;

/** Public row shape: credential flags without exposing password hash. */
const USER_ROW_SELECT = `${USER_FIELDS}, (password IS NOT NULL) AS has_password`;

const USER_ROW_RETURNING = `${USER_FIELDS}, (password IS NOT NULL) AS has_password`;

async function findUserById(userId) {
  const { rows } = await db.query(`SELECT ${USER_ROW_SELECT} FROM users WHERE user_id = $1`, [
    userId,
  ]);
  return rows[0] || null;
}

async function findUserByIdWithPassword(userId) {
  const { rows } = await db.query(
    `SELECT ${USER_FIELDS_WITH_PASSWORD} FROM users WHERE user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

async function updateUser(userId, updates) {
  const keys = Object.keys(updates);
  if (keys.length === 0) {
    return findUserById(userId);
  }
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const values = keys.map((k) => updates[k]);
  const { rows } = await db.query(
    `UPDATE users SET ${sets}, updated_at = NOW() WHERE user_id = $1 RETURNING ${USER_ROW_RETURNING}`,
    [userId, ...values]
  );
  return rows[0] || null;
}

/** Another user (not userId) already has this username, case-insensitive. */
async function findOtherUserWithUsername(userId, username) {
  const { rows } = await db.query(
    `SELECT user_id FROM users WHERE LOWER(username) = LOWER($1) AND user_id <> $2 LIMIT 1`,
    [username, userId]
  );
  return rows[0] || null;
}

/** Another user already has this email, case-insensitive. */
async function findOtherUserWithEmail(userId, email) {
  if (email == null || email === '') return null;
  const { rows } = await db.query(
    `SELECT user_id FROM users WHERE LOWER(email) = LOWER($1) AND user_id <> $2 LIMIT 1`,
    [email, userId]
  );
  return rows[0] || null;
}

async function patchPolicyAgreement(userId, privacyPolicyAgreed, termsAgreed) {
  const { rows } = await db.query(
    `UPDATE users SET
       privacy_policy_agreed = $2,
       terms_agreed = $3,
       updated_at = NOW()
     WHERE user_id = $1 RETURNING ${USER_ROW_RETURNING}`,
    [userId, privacyPolicyAgreed, termsAgreed]
  );
  return rows[0] || null;
}

async function unlinkGoogle(userId) {
  const { rows } = await db.query(
    `UPDATE users SET google_id = NULL, google_email = NULL, updated_at = NOW()
     WHERE user_id = $1
       AND google_id IS NOT NULL
       AND (password IS NOT NULL OR apple_id IS NOT NULL)
     RETURNING ${USER_ROW_RETURNING}`,
    [userId]
  );
  return rows[0] || null;
}

async function unlinkApple(userId) {
  const { rows } = await db.query(
    `UPDATE users SET apple_id = NULL, apple_email = NULL, updated_at = NOW()
     WHERE user_id = $1
       AND apple_id IS NOT NULL
       AND (password IS NOT NULL OR google_id IS NOT NULL)
     RETURNING ${USER_ROW_RETURNING}`,
    [userId]
  );
  return rows[0] || null;
}

module.exports = {
  USER_FIELDS,
  USER_FIELDS_WITH_PASSWORD,
  USER_ROW_SELECT,
  USER_ROW_RETURNING,
  findUserById,
  findUserByIdWithPassword,
  updateUser,
  patchPolicyAgreement,
  findOtherUserWithUsername,
  findOtherUserWithEmail,
  unlinkGoogle,
  unlinkApple,
};
