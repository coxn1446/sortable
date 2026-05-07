const bcrypt = require('bcrypt');
const authQueries = require('../queries/authQueries');

const BCRYPT_ROUNDS = 12;

async function registerUser({ username, email, password }) {
  const existingByUsername = await authQueries.findUserByUsername(username);
  if (existingByUsername) {
    const err = new Error('Username is already taken');
    err.code = 'USERNAME_TAKEN';
    throw err;
  }
  if (email) {
    const existingByEmail = await authQueries.findUserByEmail(email);
    if (existingByEmail) {
      const err = new Error('Email is already in use');
      err.code = 'EMAIL_TAKEN';
      throw err;
    }
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  return authQueries.createLocalUser({
    username,
    email: email || null,
    password: passwordHash,
  });
}

function toPublicUser(user) {
  if (!user) return null;
  // Strip secrets / OAuth-only fields before returning to the client.
  const { password, google_id, apple_id, ...rest } = user;
  return rest;
}

module.exports = { registerUser, toPublicUser };
