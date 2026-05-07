const db = require('../db');
const { USER_FIELDS } = require('./userQueries');

// Internal version that includes the password hash for verification.
const USER_FIELDS_WITH_PASSWORD = `${USER_FIELDS}, password`;

async function findUserById(userId) {
  const { rows } = await db.query(
    `SELECT ${USER_FIELDS} FROM users WHERE user_id = $1`,
    [userId]
  );
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
    `SELECT ${USER_FIELDS} FROM users WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  return rows[0] || null;
}

async function findUserByGoogleId(googleId) {
  const { rows } = await db.query(
    `SELECT ${USER_FIELDS} FROM users WHERE google_id = $1`,
    [googleId]
  );
  return rows[0] || null;
}

async function findUserByAppleId(appleId) {
  const { rows } = await db.query(
    `SELECT ${USER_FIELDS} FROM users WHERE apple_id = $1`,
    [appleId]
  );
  return rows[0] || null;
}

async function createLocalUser({ username, email, password }) {
  const { rows } = await db.query(
    `INSERT INTO users (username, email, password)
     VALUES ($1, $2, $3)
     RETURNING ${USER_FIELDS}`,
    [username, email, password]
  );
  return rows[0];
}

async function createGoogleUser({ google_id, email, username, profile_picture }) {
  const { rows } = await db.query(
    `INSERT INTO users (google_id, email, username, profile_picture)
     VALUES ($1, $2, $3, $4)
     RETURNING ${USER_FIELDS}`,
    [google_id, email, username, profile_picture]
  );
  return rows[0];
}

async function createAppleUser({ apple_id, email, username }) {
  const { rows } = await db.query(
    `INSERT INTO users (apple_id, email, username)
     VALUES ($1, $2, $3)
     RETURNING ${USER_FIELDS}`,
    [apple_id, email, username]
  );
  return rows[0];
}

module.exports = {
  findUserById,
  findUserByUsername,
  findUserByEmail,
  findUserByGoogleId,
  findUserByAppleId,
  createLocalUser,
  createGoogleUser,
  createAppleUser,
};
