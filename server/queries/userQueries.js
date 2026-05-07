const db = require('../db');

const USER_FIELDS = `
  user_id,
  username,
  email,
  profile_picture,
  google_id,
  apple_id,
  created_at,
  updated_at
`;

async function findUserById(userId) {
  const { rows } = await db.query(
    `SELECT ${USER_FIELDS} FROM users WHERE user_id = $1`,
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
    `UPDATE users SET ${sets}, updated_at = NOW() WHERE user_id = $1 RETURNING ${USER_FIELDS}`,
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

module.exports = {
  USER_FIELDS,
  findUserById,
  updateUser,
  findOtherUserWithUsername,
  findOtherUserWithEmail,
};
