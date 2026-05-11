const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authQueries = require('../queries/authQueries');

const BCRYPT_ROUNDS = 12;
const GOOGLE_LINK_PENDING_TTL_MS = 15 * 60 * 1000;
const OAUTH_PROVIDER_LINK_INTENT_TTL_MS = 15 * 60 * 1000;

/** Matches [`capacitor.config.ts`](../capacitor.config.ts) `server.hostname` + `ios.scheme`. */
const NATIVE_OAUTH_APP_HOST = 'sortable.net';
const NATIVE_OAUTH_URL_SCHEME = 'Sortable';

/** Signed JWT in OAuth `state` so return-to-app works when the IdP opens Safari (no shared session with WKWebView). */
const OAUTH_RETURN_NATIVE_STATE_ISSUER = 'sortable-oauth-return-native';
const OAUTH_RETURN_NATIVE_STATE_TTL = '15m';

/** One-shot session establishment for WKWebView after OAuth in SFSafariViewController (separate cookie store). */
const NATIVE_OAUTH_SESSION_HANDOFF_ISSUER = 'sortable-oauth-native-handoff';
const NATIVE_OAUTH_SESSION_HANDOFF_TTL = '5m';

/** JWT from authenticated WebView → opened in system browser so Google OAuth runs in a allowed UA (WKWebView link-account hits disallowed_useragent). */
const NATIVE_OAUTH_LINK_BOOTSTRAP_ISSUER = 'sortable-oauth-native-link-bootstrap';
const NATIVE_OAUTH_LINK_BOOTSTRAP_TTL = '3m';

const LOG_PREFIX = '[oauth-native]';

function sessionSecretForSignedOAuthState() {
  const s = process.env.SESSION_SECRET;
  return typeof s === 'string' && s.trim().length > 0 ? s.trim() : null;
}

/**
 * Short-lived JWT appended to native deep links after successful OAuth so the main WKWebView can
 * POST /api/auth/native-session-handoff and receive Set-Cookie (Safari view controller does not
 * share cookies with the app WebView).
 *
 * @param {unknown} userId
 * @returns {string|null}
 */
function createNativeOAuthSessionHandoffToken(userId) {
  const secret = sessionSecretForSignedOAuthState();
  if (!secret) {
    console.warn(`${LOG_PREFIX} createNativeOAuthSessionHandoffToken: SESSION_SECRET missing`);
    return null;
  }
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) return null;
  return jwt.sign({ u: uid, v: 1 }, secret, {
    expiresIn: NATIVE_OAUTH_SESSION_HANDOFF_TTL,
    issuer: NATIVE_OAUTH_SESSION_HANDOFF_ISSUER,
  });
}

/**
 * @param {string} token
 * @returns {{ userId: number }}
 */
function verifyNativeOAuthSessionHandoffToken(token) {
  const secret = sessionSecretForSignedOAuthState();
  if (!secret) {
    throw new Error('SESSION_SECRET missing');
  }
  const payload = jwt.verify(String(token).trim(), secret, {
    issuer: NATIVE_OAUTH_SESSION_HANDOFF_ISSUER,
  });
  const uid = payload && Number(payload.u);
  if (!Number.isFinite(uid) || uid <= 0) {
    throw new Error('invalid handoff payload');
  }
  return { userId: uid };
}

/**
 * Short-lived token: authenticated native WebView POSTs to mint it; client opens bridge URL in the
 * system browser where Google / Apple allow OAuth (embedded WKWebView does not).
 *
 * @param {unknown} userId
 * @param {'google'|'apple'} provider
 * @returns {string|null}
 */
function createNativeOAuthLinkBootstrapToken(userId, provider) {
  const secret = sessionSecretForSignedOAuthState();
  if (!secret) {
    console.warn(`${LOG_PREFIX} createNativeOAuthLinkBootstrapToken: SESSION_SECRET missing`);
    return null;
  }
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) return null;
  const p = provider === 'apple' ? 'apple' : 'google';
  return jwt.sign({ u: uid, p, v: 1 }, secret, {
    expiresIn: NATIVE_OAUTH_LINK_BOOTSTRAP_TTL,
    issuer: NATIVE_OAUTH_LINK_BOOTSTRAP_ISSUER,
  });
}

/**
 * @param {string} token
 * @returns {{ userId: number, provider: 'google'|'apple' }}
 */
function verifyNativeOAuthLinkBootstrapToken(token) {
  const secret = sessionSecretForSignedOAuthState();
  if (!secret) {
    throw new Error('SESSION_SECRET missing');
  }
  const payload = jwt.verify(String(token).trim(), secret, {
    issuer: NATIVE_OAUTH_LINK_BOOTSTRAP_ISSUER,
  });
  const uid = payload && Number(payload.u);
  const p = payload && payload.p;
  if (!Number.isFinite(uid) || uid <= 0) {
    throw new Error('invalid bootstrap payload');
  }
  if (p !== 'google' && p !== 'apple') {
    throw new Error('invalid bootstrap provider');
  }
  return { userId: uid, provider: p };
}

/**
 * When `return_native=1`, returns a JWT to pass as OAuth `state` so the callback can restore the flag
 * even if the browser context changed (e.g. Safari vs in-app WebView).
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function createOAuthReturnNativeState(req) {
  const v = req?.query?.return_native;
  if (v !== '1' && v !== 'true') {
    return null;
  }
  const secret = sessionSecretForSignedOAuthState();
  if (!secret) {
    console.warn(`${LOG_PREFIX} createOAuthReturnNativeState: SESSION_SECRET missing; cannot sign state`);
    return null;
  }
  const token = jwt.sign({ rn: 1, v: 1 }, secret, {
    expiresIn: OAUTH_RETURN_NATIVE_STATE_TTL,
    issuer: OAUTH_RETURN_NATIVE_STATE_ISSUER,
  });
  console.log(`${LOG_PREFIX} authorize: signed return-native OAuth state`, {
    method: req.method,
    path: req.path,
    tokenLength: token.length,
  });
  return token;
}

/**
 * If the callback includes our signed `state`, records return-to-app intent.
 * Still sets `session.oauthReturnToNative` for routes that redirect without `req.logIn`
 * (session is wiped on login — use the returned boolean + `takeOAuthClientRedirect(..., { returnNativeFromSignedState })`).
 *
 * @param {import('express').Request} req
 * @returns {boolean} true when the signed JWT requested a native return
 */
function hydrateOAuthReturnToNativeFromOAuthState(req) {
  const raw = req.query?.state || req.body?.state;
  if (raw == null || typeof raw !== 'string' || !raw.trim()) {
    console.log(`${LOG_PREFIX} callback hydrate: no OAuth state param`, {
      method: req.method,
      path: req.path,
      hasQueryState: Boolean(req.query?.state),
      hasBodyState: Boolean(req.body?.state),
    });
    return false;
  }
  const secret = sessionSecretForSignedOAuthState();
  if (!secret) {
    console.warn(`${LOG_PREFIX} callback hydrate: SESSION_SECRET missing`);
    return false;
  }
  try {
    const payload = jwt.verify(raw.trim(), secret, {
      issuer: OAUTH_RETURN_NATIVE_STATE_ISSUER,
    });
    if (payload && Number(payload.rn) === 1) {
      req.session.oauthReturnToNative = true;
      console.log(`${LOG_PREFIX} callback hydrate: return_native from signed state (pass to redirect opts; session may reset on logIn)`, {
        method: req.method,
        path: req.path,
      });
      return true;
    }
    console.log(`${LOG_PREFIX} callback hydrate: JWT decoded but rn !== 1`, {
      path: req.path,
      keys: payload && typeof payload === 'object' ? Object.keys(payload) : [],
    });
    return false;
  } catch (e) {
    console.log(`${LOG_PREFIX} callback hydrate: state is not our return-native token (ok for web OAuth)`, {
      path: req.path,
      message: e.message,
    });
    return false;
  }
}

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

function isSafeOAuthWebRedirectPath(target) {
  if (target == null || typeof target !== 'string') return false;
  if (!target.startsWith('/') || target.startsWith('//')) return false;
  return true;
}

function captureOAuthReturnToNativeFromQuery(req) {
  const v = req?.query?.return_native;
  if (v === '1' || v === 'true') {
    req.session.oauthReturnToNative = true;
    console.log(`${LOG_PREFIX} capture return_native=1 on session (same-browser flow)`, {
      path: req.path,
    });
  }
}

/**
 * Rewrites a same-origin path redirect into a Sortable:// deep link when the user started
 * OAuth from Capacitor with `return_native=1`. Clears `oauthReturnToNative` on the session when used.
 * Pass `returnNativeFromSignedState` when the OAuth callback ran `hydrateOAuthReturnToNativeFromOAuthState`
 * before `req.logIn` — login regenerates the session and drops the flag otherwise.
 *
 * @param {{ oauthReturnToNative?: boolean } & Record<string, unknown>} session
 * @param {string} webTarget path + query, e.g. `/` or `/login?error=google`
 * @param {{ returnNativeFromSignedState?: boolean, handoffUserId?: unknown }} [options]
 * @returns {string}
 */
function takeOAuthClientRedirect(session, webTarget, options = {}) {
  const fromSignedState = options.returnNativeFromSignedState === true;
  const fromSession = session?.oauthReturnToNative === true;
  if (fromSession && session) {
    delete session.oauthReturnToNative;
  }
  const wantsNative = fromSignedState || fromSession;
  const safe = isSafeOAuthWebRedirectPath(webTarget);
  if (!wantsNative) {
    console.log(`${LOG_PREFIX} final redirect: web (no return_native)`, {
      targetPreview: String(webTarget).slice(0, 120),
      safePath: safe,
      fromSignedState,
      fromSession,
    });
    return webTarget;
  }
  if (!safe) {
    console.warn(`${LOG_PREFIX} final redirect: return_native set but path unsafe; forcing web`, {
      targetPreview: String(webTarget).slice(0, 120),
      fromSignedState,
      fromSession,
    });
    return webTarget;
  }
  let targetForNative = webTarget;
  const handoffUid = options.handoffUserId;
  if (handoffUid != null) {
    const t = createNativeOAuthSessionHandoffToken(handoffUid);
    if (t) {
      const sep = targetForNative.includes('?') ? '&' : '?';
      targetForNative = `${targetForNative}${sep}oauth_handoff=${encodeURIComponent(t)}`;
    }
  }
  const nativeUrl = `${NATIVE_OAUTH_URL_SCHEME}://${NATIVE_OAUTH_APP_HOST}${targetForNative}`;
  console.log(`${LOG_PREFIX} final redirect: native deep link`, {
    webTarget: String(webTarget).slice(0, 120),
    nativeUrl: nativeUrl.includes('oauth_handoff')
      ? `${NATIVE_OAUTH_URL_SCHEME}://${NATIVE_OAUTH_APP_HOST}${String(webTarget).slice(0, 80)}…&oauth_handoff=…`
      : nativeUrl,
    fromSignedState,
    fromSession,
    hasHandoff: nativeUrl.includes('oauth_handoff'),
  });
  return nativeUrl;
}

/**
 * Loads the user row for POST /api/auth/native-session-handoff after JWT verification.
 *
 * @param {unknown} token
 * @returns {Promise<object>}
 */
async function getUserForNativeOAuthSessionHandoff(token) {
  if (token == null || typeof token !== 'string' || !token.trim()) {
    const err = new Error('token required');
    err.code = 'NATIVE_HANDOFF_TOKEN_REQUIRED';
    throw err;
  }
  const { userId } = verifyNativeOAuthSessionHandoffToken(token.trim());
  const user = await authQueries.findUserById(userId);
  if (!user) {
    const err = new Error('Invalid session handoff');
    err.code = 'NATIVE_HANDOFF_UNKNOWN_USER';
    throw err;
  }
  return user;
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
  captureOAuthReturnToNativeFromQuery,
  createOAuthReturnNativeState,
  hydrateOAuthReturnToNativeFromOAuthState,
  takeOAuthClientRedirect,
  verifyNativeOAuthSessionHandoffToken,
  getUserForNativeOAuthSessionHandoff,
  createNativeOAuthLinkBootstrapToken,
  verifyNativeOAuthLinkBootstrapToken,
};
