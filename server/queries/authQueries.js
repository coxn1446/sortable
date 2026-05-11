const db = require('../db');
const { USER_FIELDS, USER_ROW_SELECT, USER_ROW_RETURNING } = require('./userQueries');

// Internal version that includes the password hash for verification.
const USER_FIELDS_WITH_PASSWORD = `${USER_FIELDS}, password`;

async function findUserById(userId) {
  const { rows } = await db.query(`SELECT ${USER_ROW_SELECT} FROM users WHERE user_id = $1`, [
    userId,
  ]);
  return rows[0] || null;
}

async function findUserByUsername(username) {
  const { rows } = await db.query(
    `SELECT ${USER_FIELDS_WITH_PASSWORD} FROM users WHERE LOWER(username) = LOWER($1)`,
    [username]
  );
  return rows[0] || null;
}

async function findUserByEmail(email) {
  const { rows } = await db.query(
    `SELECT ${USER_ROW_SELECT} FROM users WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  return rows[0] || null;
}

async function findUserByEmailWithPassword(email) {
  const { rows } = await db.query(
    `SELECT ${USER_FIELDS_WITH_PASSWORD} FROM users WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  return rows[0] || null;
}

async function findUserByGoogleId(googleId) {
  const { rows } = await db.query(
    `SELECT ${USER_ROW_SELECT} FROM users WHERE google_id = $1`,
    [googleId]
  );
  return rows[0] || null;
}

async function findUserByAppleId(appleId) {
  const { rows } = await db.query(
    `SELECT ${USER_ROW_SELECT} FROM users WHERE apple_id = $1`,
    [appleId]
  );
  return rows[0] || null;
}

async function createLocalUser({ username, email, password }) {
  const { rows } = await db.query(
    `INSERT INTO users (username, email, password, privacy_policy_agreed, terms_agreed)
     VALUES ($1, $2, $3, TRUE, TRUE)
     RETURNING ${USER_ROW_RETURNING}`,
    [username, email, password]
  );
  return rows[0];
}

async function createGoogleUser({ google_id, email, username, profile_picture }) {
  const { rows } = await db.query(
    `INSERT INTO users (google_id, email, google_email, username, profile_picture, privacy_policy_agreed, terms_agreed)
     VALUES ($1, $2, $2, $3, $4, TRUE, TRUE)
     RETURNING ${USER_ROW_RETURNING}`,
    [google_id, email, username, profile_picture]
  );
  return rows[0];
}

async function createAppleUser({ apple_id, email, username }) {
  const e = email == null || email === '' ? null : String(email).trim() || null;
  const { rows } = await db.query(
    `INSERT INTO users (apple_id, email, apple_email, username, privacy_policy_agreed, terms_agreed)
     VALUES ($1, $2, $2, $3, TRUE, TRUE)
     RETURNING ${USER_ROW_RETURNING}`,
    [apple_id, e, username]
  );
  return rows[0];
}

async function attachGoogleToUser({ userId, google_id, profile_picture, google_email }) {
  const ge =
    google_email == null || google_email === '' ? null : String(google_email).trim() || null;
  const { rows } = await db.query(
    `UPDATE users SET
       google_id = $2,
       profile_picture = COALESCE($3, profile_picture),
       google_email = COALESCE($4, google_email)
     WHERE user_id = $1 AND google_id IS NULL
     RETURNING ${USER_ROW_RETURNING}`,
    [userId, google_id, profile_picture, ge]
  );
  return rows[0] || null;
}

async function attachAppleToUser({ userId, apple_id, apple_email }) {
  const ae =
    apple_email == null || apple_email === '' ? null : String(apple_email).trim() || null;
  const { rows } = await db.query(
    `UPDATE users SET
       apple_id = $2,
       apple_email = COALESCE($3, apple_email)
     WHERE user_id = $1 AND apple_id IS NULL
     RETURNING ${USER_ROW_RETURNING}`,
    [userId, apple_id, ae]
  );
  return rows[0] || null;
}

async function syncGoogleOAuthEmail(userId, google_email) {
  const ge =
    google_email == null || google_email === '' ? null : String(google_email).trim() || null;
  if (!ge) return null;
  const { rows } = await db.query(
    `UPDATE users SET google_email = $2, updated_at = NOW() WHERE user_id = $1 RETURNING ${USER_ROW_RETURNING}`,
    [userId, ge]
  );
  return rows[0] || null;
}

async function syncAppleOAuthEmail(userId, apple_email) {
  const ae =
    apple_email == null || apple_email === '' ? null : String(apple_email).trim() || null;
  if (!ae) return null;
  const { rows } = await db.query(
    `UPDATE users SET apple_email = $2, updated_at = NOW() WHERE user_id = $1 RETURNING ${USER_ROW_RETURNING}`,
    [userId, ae]
  );
  return rows[0] || null;
}

module.exports = {
  findUserById,
  findUserByUsername,
  findUserByEmail,
  findUserByEmailWithPassword,
  findUserByGoogleId,
  findUserByAppleId,
  createLocalUser,
  createGoogleUser,
  createAppleUser,
  attachGoogleToUser,
  attachAppleToUser,
  syncGoogleOAuthEmail,
  syncAppleOAuthEmail,
};
