const userQueries = require('../queries/userQueries');

async function getUserById(userId) {
  return userQueries.findUserById(userId);
}

async function updateUser(userId, patch) {
  const allowed = ['email', 'profile_picture', 'username'];
  const updates = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) updates[key] = patch[key];
  }

  if ('username' in updates) {
    const raw = updates.username;
    if (raw === null || raw === undefined) {
      const err = new Error('Username is required');
      err.status = 400;
      throw err;
    }
    const u = String(raw).trim();
    if (!u) {
      const err = new Error('Username is required');
      err.status = 400;
      throw err;
    }
    if (u.length > 64) {
      const err = new Error('Username is too long');
      err.status = 400;
      throw err;
    }
    const taken = await userQueries.findOtherUserWithUsername(userId, u);
    if (taken) {
      const err = new Error('Username is already taken');
      err.status = 409;
      err.code = 'USERNAME_TAKEN';
      throw err;
    }
    updates.username = u;
  }

  if ('email' in updates) {
    let e = updates.email;
    if (e === '' || e === null) e = null;
    else {
      e = String(e).trim();
      if (e === '') e = null;
    }
    if (e) {
      const taken = await userQueries.findOtherUserWithEmail(userId, e);
      if (taken) {
        const err = new Error('Email is already in use');
        err.status = 409;
        err.code = 'EMAIL_TAKEN';
        throw err;
      }
    }
    updates.email = e;
  }

  if ('profile_picture' in updates) {
    const p = updates.profile_picture;
    updates.profile_picture = p === '' || p === null ? null : String(p);
  }

  if (Object.keys(updates).length === 0) {
    return userQueries.findUserById(userId);
  }

  try {
    return await userQueries.updateUser(userId, updates);
  } catch (error) {
    if (error && error.code === '23505') {
      const err = new Error('Username or email is already in use');
      err.status = 409;
      err.code = 'CONFLICT';
      throw err;
    }
    throw error;
  }
}

module.exports = { getUserById, updateUser };
