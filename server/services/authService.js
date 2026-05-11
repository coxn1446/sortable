const bcrypt = require('bcrypt');
const authQueries = require('../queries/authQueries');

const BCRYPT_ROUNDS = 12;
const GOOGLE_LINK_PENDING_TTL_MS = 15 * 60 * 1000;
const OAUTH_PROVIDER_LINK_INTENT_TTL_MS = 15 * 60 * 1000;

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

function normalizeHasPasswordFlag(flag) {
  if (flag === true || flag === 'true' || flag === 't' || flag === 1 || flag === '1') return true;
  if (flag === false || flag === 'false' || flag === 'f' || flag === 0 || flag === '0') return false;
  return null;
}

function userRowHasPassword(row) {
  if (!row) return false;
  if (typeof row.password === 'string' && row.password.length > 0) return true;
  const resolved = normalizeHasPasswordFlag(row.has_password);
  return resolved === true;
}

function toPublicUser(user) {
  if (!user) return null;
  const {
    password,
    google_id,
    apple_id,
    has_password: hasPasswordFlag,
    ...rest
  } = user;
  const resolvedFlag = normalizeHasPasswordFlag(hasPasswordFlag);
  const has_password =
    resolvedFlag !== null ? resolvedFlag : Boolean(typeof password === 'string' && password.length > 0);
  return {
    ...rest,
    has_google: Boolean(google_id),
    has_apple: Boolean(apple_id),
    has_password,
  };
}

function getPendingGoogleLinkForClient(session) {
  const pending = session?.pendingGoogleLink;
  if (!pending) {
    return { pending: false };
  }
  if (pending.expiresAt < Date.now()) {
    delete session.pendingGoogleLink;
    return { pending: false, expired: true };
  }
  return {
    pending: true,
    email: pending.email,
    username: pending.username,
  };
}

async function completeGoogleAccountLink(session, password) {
  if (!password || typeof password !== 'string') {
    const err = new Error('password is required');
    err.code = 'GOOGLE_LINK_VALIDATION';
    throw err;
  }

  const pending = session?.pendingGoogleLink;
  if (!pending) {
    const err = new Error('No Google link in progress');
    err.code = 'GOOGLE_LINK_NOT_PENDING';
    throw err;
  }

  if (pending.expiresAt < Date.now()) {
    delete session.pendingGoogleLink;
    const err = new Error('Google link session expired; try signing in with Google again');
    err.code = 'GOOGLE_LINK_EXPIRED';
    throw err;
  }

  const user = await authQueries.findUserByEmailWithPassword(pending.email);
  if (!user || !user.password) {
    delete session.pendingGoogleLink;
    const err = new Error('Account not found or has no password');
    err.code = 'GOOGLE_LINK_ACCOUNT_INVALID';
    throw err;
  }

  if (user.google_id && user.google_id !== pending.google_id) {
    delete session.pendingGoogleLink;
    const err = new Error('This account is already linked to a different Google sign-in');
    err.code = 'GOOGLE_LINK_CONFLICT';
    throw err;
  }

  const passwordOk = await bcrypt.compare(password, user.password);
  if (!passwordOk) {
    const err = new Error('Wrong password');
    err.code = 'GOOGLE_LINK_BAD_PASSWORD';
    throw err;
  }

  if (user.google_id === pending.google_id) {
    delete session.pendingGoogleLink;
    return toPublicUser(user);
  }

  const updated = await authQueries.attachGoogleToUser({
    userId: user.user_id,
    google_id: pending.google_id,
    profile_picture: pending.profile_picture || null,
    google_email: pending.email || null,
  });

  if (!updated) {
    const err = new Error('Could not link Google sign-in; try again');
    err.code = 'GOOGLE_LINK_CONFLICT';
    throw err;
  }

  delete session.pendingGoogleLink;

  return toPublicUser(updated);
}

function setPendingGoogleLinkSession(req, { google_id, email, username, profile_picture }) {
  req.session.pendingGoogleLink = {
    google_id,
    email,
    username,
    profile_picture: profile_picture || null,
    expiresAt: Date.now() + GOOGLE_LINK_PENDING_TTL_MS,
  };
}

function getValidOAuthProviderLinkIntent(session, provider) {
  const intent = session?.oauthProviderLinkIntent;
  if (!intent || intent.provider !== provider) {
    return null;
  }
  if (intent.expiresAt < Date.now()) {
    delete session.oauthProviderLinkIntent;
    return null;
  }
  return intent;
}

function setOAuthProviderLinkIntent(req, { userId, provider }) {
  req.session.oauthProviderLinkIntent = {
    userId,
    provider,
    expiresAt: Date.now() + OAUTH_PROVIDER_LINK_INTENT_TTL_MS,
  };
}

function clearOAuthProviderLinkIntent(req) {
  delete req.session.oauthProviderLinkIntent;
}

function setOAuthBrowserLinkFlow(req, { userId, provider, successRedirect, errorReturnBase }) {
  setOAuthProviderLinkIntent(req, { userId, provider });
  req.session.oauthPostSuccessRedirect = successRedirect;
  req.session.oauthErrorReturnBase = errorReturnBase;
}

function takeOAuthPostSuccessRedirect(session) {
  const path = session.oauthPostSuccessRedirect || null;
  delete session.oauthPostSuccessRedirect;
  delete session.oauthErrorReturnBase;
  return path;
}

function takeOAuthErrorReturnBase(session) {
  const path = session.oauthErrorReturnBase || null;
  delete session.oauthErrorReturnBase;
  delete session.oauthPostSuccessRedirect;
  return path;
}

module.exports = {
  registerUser,
  toPublicUser,
  userRowHasPassword,
  getPendingGoogleLinkForClient,
  completeGoogleAccountLink,
  setPendingGoogleLinkSession,
  getValidOAuthProviderLinkIntent,
  setOAuthProviderLinkIntent,
  clearOAuthProviderLinkIntent,
  setOAuthBrowserLinkFlow,
  takeOAuthPostSuccessRedirect,
  takeOAuthErrorReturnBase,
};
