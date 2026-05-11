const bcrypt = require('bcrypt');
const userQueries = require('../queries/userQueries');
const { userRowHasPassword } = require('./authService');

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

async function getUserById(userId) {
  return userQueries.findUserById(userId);
}

/** @param {{ accept_privacy?: boolean; accept_terms?: boolean }} body */
async function acceptUpdatedPolicies(userId, body) {
  const acceptPrivacy = body?.accept_privacy === true;
  const acceptTerms = body?.accept_terms === true;
  const row = await userQueries.findUserById(userId);
  if (!row) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  if (!row.privacy_policy_agreed && !acceptPrivacy) {
    const err = new Error('You must acknowledge the Privacy Policy');
    err.status = 400;
    err.code = 'PRIVACY_ACCEPTANCE_REQUIRED';
    throw err;
  }
  if (!row.terms_agreed && !acceptTerms) {
    const err = new Error('You must acknowledge the Terms & Conditions');
    err.status = 400;
    err.code = 'TERMS_ACCEPTANCE_REQUIRED';
    throw err;
  }

  if (row.privacy_policy_agreed === true && row.terms_agreed === true) {
    return row;
  }

  const nextPrivacy = row.privacy_policy_agreed === true ? true : acceptPrivacy;
  const nextTerms = row.terms_agreed === true ? true : acceptTerms;

  return userQueries.patchPolicyAgreement(userId, nextPrivacy, nextTerms);
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

async function changePassword(userId, body) {
  const newPassword = body?.new_password;
  const currentPassword = body?.current_password;

  if (!newPassword || typeof newPassword !== 'string') {
    const err = new Error('New password is required');
    err.status = 400;
    err.code = 'PASSWORD_REQUIRED';
    throw err;
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    const err = new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    err.status = 400;
    err.code = 'PASSWORD_TOO_SHORT';
    throw err;
  }

  const row = await userQueries.findUserByIdWithPassword(userId);
  if (!row) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  if (row.password) {
    if (!currentPassword || typeof currentPassword !== 'string') {
      const err = new Error('Current password is required');
      err.status = 400;
      err.code = 'CURRENT_PASSWORD_REQUIRED';
      throw err;
    }
    const ok = await bcrypt.compare(currentPassword, row.password);
    if (!ok) {
      const err = new Error('Current password is incorrect');
      err.status = 400;
      err.code = 'CURRENT_PASSWORD_WRONG';
      throw err;
    }
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  return userQueries.updateUser(userId, { password: passwordHash });
}

async function unlinkOAuthProvider(userId, provider) {
  if (provider !== 'google' && provider !== 'apple') {
    const err = new Error('provider must be google or apple');
    err.status = 400;
    err.code = 'INVALID_PROVIDER';
    throw err;
  }

  const row = await userQueries.findUserById(userId);
  if (!row) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  if (provider === 'google') {
    if (!row.google_id) {
      const err = new Error('Google is not linked to this account');
      err.status = 400;
      err.code = 'NOT_LINKED';
      throw err;
    }
    if (!userRowHasPassword(row) && !row.apple_id) {
      const err = new Error('Set a password before removing your only sign-in method');
      err.status = 400;
      err.code = 'SET_PASSWORD_REQUIRED';
      throw err;
    }
    const updated = await userQueries.unlinkGoogle(userId);
    if (!updated) {
      const err = new Error('Could not remove Google sign-in');
      err.status = 400;
      err.code = 'UNLINK_FAILED';
      throw err;
    }
    return updated;
  }

  if (!row.apple_id) {
    const err = new Error('Apple is not linked to this account');
    err.status = 400;
    err.code = 'NOT_LINKED';
    throw err;
  }
  if (!userRowHasPassword(row) && !row.google_id) {
    const err = new Error('Set a password before removing your only sign-in method');
    err.status = 400;
    err.code = 'SET_PASSWORD_REQUIRED';
    throw err;
  }
  const updated = await userQueries.unlinkApple(userId);
  if (!updated) {
    const err = new Error('Could not remove Apple sign-in');
    err.status = 400;
    err.code = 'UNLINK_FAILED';
    throw err;
  }
  return updated;
}

module.exports = {
  getUserById,
  updateUser,
  acceptUpdatedPolicies,
  changePassword,
  unlinkOAuthProvider,
};
