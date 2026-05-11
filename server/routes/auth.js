const express = require('express');
const passport = require('passport');
const router = express.Router();

const authService = require('../services/authService');
const authQueries = require('../queries/authQueries');
const { buildGoogleAuthenticateOptions } = require('../utils/googleOAuthPassportOptions');
const { authLimiter } = require('../middleware/rateLimits');

function publicAppBaseUrl() {
  const raw = process.env.DEFAULT_CLIENT_URL;
  if (typeof raw !== 'string' || !raw.trim()) {
    return '';
  }
  return raw.replace(/\/$/, '');
}

function redirectPublic(res, pathOrAbsolute) {
  const base = publicAppBaseUrl();
  if (pathOrAbsolute.startsWith('http://') || pathOrAbsolute.startsWith('https://')) {
    return res.redirect(302, pathOrAbsolute);
  }
  return res.redirect(302, base ? `${base}${pathOrAbsolute}` : pathOrAbsolute);
}

function requireAuthJson(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  return next();
}

function appendReturnNativeToAuthorizePath(path, req) {
  const rn = req.query?.return_native;
  if (rn !== '1' && rn !== 'true') return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}return_native=1`;
}

function requireSessionRedirectToLogin(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.redirect(302, `/login?next=${encodeURIComponent('/profile')}`);
}

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }
    const user = await authService.registerUser({ username, email, password });
    req.login(user, (err) => {
      if (err) return next(err);
      return res.status(201).json({ user: authService.toPublicUser(user) });
    });
  } catch (error) {
    if (error.code === 'USERNAME_TAKEN' || error.code === 'EMAIL_TAKEN') {
      return res.status(409).json({ error: error.message });
    }
    next(error);
  }
});

router.post('/login', authLimiter, (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).json({ error: info?.message || 'Invalid credentials' });
    }
    req.login(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      return res.json({ user: authService.toPublicUser(user) });
    });
  })(req, res, next);
});

router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('sortable.sid');
      res.json({ ok: true });
    });
  });
});

router.get('/me', (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ user: null });
  }
  res.json({ user: authService.toPublicUser(req.user) });
});

/**
 * WKWebView cannot read session cookies set during OAuth in SFSafariViewController. After native
 * redirect, the app opens `…?oauth_handoff=<jwt>` and exchanges it here for a real session cookie.
 */
router.post('/native-session-handoff', authLimiter, async (req, res, next) => {
  try {
    const user = await authService.getUserForNativeOAuthSessionHandoff(req.body?.token);
    req.login(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      return res.json({ user: authService.toPublicUser(user) });
    });
  } catch (error) {
    if (error && error.code === 'NATIVE_HANDOFF_TOKEN_REQUIRED') {
      return res.status(400).json({ error: 'token required' });
    }
    return res.status(401).json({ error: 'Invalid or expired session handoff' });
  }
});

/**
 * Capacitor: WKWebView cannot complete Google OAuth (disallowed_useragent). Authenticated client
 * POSTs here, then Browser.opens the returned URL in SFSafariViewController → native-bridge
 * establishes a session there and redirects into the normal Google link flow.
 */
router.post('/google/native-link-bootstrap', authLimiter, requireAuthJson, (req, res) => {
  const base = publicAppBaseUrl();
  if (!base) {
    return res.status(500).json({ error: 'DEFAULT_CLIENT_URL is not configured' });
  }
  if (req.user.google_id) {
    return res.status(400).json({ error: 'Google is already linked to this account' });
  }
  const token = authService.createNativeOAuthLinkBootstrapToken(req.user.user_id, 'google');
  if (!token) {
    return res.status(500).json({ error: 'Could not start link flow' });
  }
  const q = new URLSearchParams({ token, return_native: '1' });
  const url = `${base}/api/auth/google/link-account/native-bridge?${q.toString()}`;
  return res.json({ url });
});

router.get('/google/link-account/native-bridge', authLimiter, async (req, res, next) => {
  try {
    const rawTok = req.query?.token;
    if (!rawTok || typeof rawTok !== 'string') {
      return redirectPublic(res, '/profile?oauth_error=native_link_invalid');
    }
    const { userId, provider } = authService.verifyNativeOAuthLinkBootstrapToken(rawTok);
    if (provider !== 'google') {
      return redirectPublic(res, '/profile?oauth_error=native_link_invalid');
    }
    const user = await authQueries.findUserById(userId);
    if (!user) {
      return redirectPublic(res, '/login?error=native_link');
    }
    if (user.google_id) {
      return redirectPublic(res, '/profile?notice=google_already_linked');
    }
    req.login(user, (err) => {
      if (err) return next(err);
      authService.captureOAuthReturnToNativeFromQuery(req);
      authService.setOAuthBrowserLinkFlow(req, {
        userId: user.user_id,
        provider: 'google',
        successRedirect: '/profile?linked=google',
        errorReturnBase: '/profile',
      });
      return res.redirect(302, appendReturnNativeToAuthorizePath('/api/auth/google', req));
    });
  } catch {
    return redirectPublic(res, '/profile?oauth_error=native_link_expired');
  }
});

router.get(
  '/google',
  (req, res, next) => {
    authService.captureOAuthReturnToNativeFromQuery(req);
    const signedState = authService.createOAuthReturnNativeState(req);
    const authOpts = buildGoogleAuthenticateOptions(signedState ? { state: signedState } : {});
    passport.authenticate('google', authOpts)(req, res, next);
  }
);

router.get('/google/link-account', requireSessionRedirectToLogin, (req, res) => {
  authService.captureOAuthReturnToNativeFromQuery(req);
  if (req.user.google_id) {
    return res.redirect(
      302,
      authService.takeOAuthClientRedirect(req.session, '/profile?notice=google_already_linked')
    );
  }
  authService.setOAuthBrowserLinkFlow(req, {
    userId: req.user.user_id,
    provider: 'google',
    successRedirect: '/profile?linked=google',
    errorReturnBase: '/profile',
  });
  res.redirect(302, appendReturnNativeToAuthorizePath('/api/auth/google', req));
});

router.get('/google/link-pending', (req, res) => {
  res.json(authService.getPendingGoogleLinkForClient(req.session));
});

router.post('/google/cancel-link', (req, res) => {
  delete req.session.pendingGoogleLink;
  res.json({ ok: true });
});

router.post('/google/complete-link', authLimiter, async (req, res, next) => {
  try {
    const { password } = req.body || {};
    const user = await authService.completeGoogleAccountLink(req.session, password);
    req.login(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      return res.json({ user });
    });
  } catch (error) {
    const { code } = error;
    if (code === 'GOOGLE_LINK_BAD_PASSWORD') {
      return res.status(401).json({ error: error.message, code });
    }
    if (
      code === 'GOOGLE_LINK_NOT_PENDING' ||
      code === 'GOOGLE_LINK_EXPIRED' ||
      code === 'GOOGLE_LINK_VALIDATION' ||
      code === 'GOOGLE_LINK_ACCOUNT_INVALID'
    ) {
      return res.status(400).json({ error: error.message, code });
    }
    if (code === 'GOOGLE_LINK_CONFLICT') {
      return res.status(409).json({ error: error.message, code });
    }
    return next(error);
  }
});

router.get('/google/callback', (req, res, next) => {
  const oauthReturnNativeFromSignedState = authService.hydrateOAuthReturnToNativeFromOAuthState(req);
  const nativeRedirectOpts = { returnNativeFromSignedState: oauthReturnNativeFromSignedState };
  passport.authenticate('google', (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      const errBase = authService.takeOAuthErrorReturnBase(req.session);
      if (errBase) {
        const reason = req.session.googleOAuthFailureReason || 'google';
        delete req.session.googleOAuthFailureReason;
        return res.redirect(
          302,
          authService.takeOAuthClientRedirect(
            req.session,
            `${errBase}?oauth_error=${encodeURIComponent(reason)}`,
            nativeRedirectOpts
          )
        );
      }
      if (req.session.pendingGoogleLink) {
        return res.redirect(
          302,
          authService.takeOAuthClientRedirect(req.session, '/login?google_link=1', nativeRedirectOpts)
        );
      }
      const reason = req.session.googleOAuthFailureReason;
      delete req.session.googleOAuthFailureReason;
      let q = 'error=google';
      if (reason === 'google_email_conflict') {
        q = 'error=google_email_conflict';
      } else if (reason === 'google_oauth_only') {
        q = 'error=google_oauth_only';
      } else if (reason === 'google_needs_email') {
        q = 'error=google_needs_email';
      }
      return res.redirect(
        302,
        authService.takeOAuthClientRedirect(req.session, `/login?${q}`, nativeRedirectOpts)
      );
    }

    delete req.session.googleOAuthFailureReason;
    delete req.session.pendingGoogleLink;

    const target =
      authService.takeOAuthPostSuccessRedirect(req.session) || '/?signed_in=1';

    req.logIn(user, (loginErr) => {
      if (loginErr) {
        return next(loginErr);
      }
      return res.redirect(
        302,
        authService.takeOAuthClientRedirect(req.session, target, {
          ...nativeRedirectOpts,
          handoffUserId: user.user_id,
        })
      );
    });
  })(req, res, next);
});

/**
 * Same pattern as Google: avoid provider OAuth inside WKWebView on native (policy / UX).
 */
router.post('/apple/native-link-bootstrap', authLimiter, requireAuthJson, (req, res) => {
  const base = publicAppBaseUrl();
  if (!base) {
    return res.status(500).json({ error: 'DEFAULT_CLIENT_URL is not configured' });
  }
  if (req.user.apple_id) {
    return res.status(400).json({ error: 'Apple is already linked to this account' });
  }
  const token = authService.createNativeOAuthLinkBootstrapToken(req.user.user_id, 'apple');
  if (!token) {
    return res.status(500).json({ error: 'Could not start link flow' });
  }
  const q = new URLSearchParams({ token, return_native: '1' });
  const url = `${base}/api/auth/apple/link-account/native-bridge?${q.toString()}`;
  return res.json({ url });
});

router.get(
  '/apple',
  (req, res, next) => {
    authService.captureOAuthReturnToNativeFromQuery(req);
    const signedState = authService.createOAuthReturnNativeState(req);
    const authOpts = { scope: ['name', 'email'] };
    if (signedState) {
      authOpts.state = signedState;
    }
    passport.authenticate('apple', authOpts)(req, res, next);
  }
);

router.get('/apple/link-account', requireSessionRedirectToLogin, (req, res) => {
  authService.captureOAuthReturnToNativeFromQuery(req);
  if (req.user.apple_id) {
    return res.redirect(
      302,
      authService.takeOAuthClientRedirect(req.session, '/profile?notice=apple_already_linked')
    );
  }
  authService.setOAuthBrowserLinkFlow(req, {
    userId: req.user.user_id,
    provider: 'apple',
    successRedirect: '/profile?linked=apple',
    errorReturnBase: '/profile',
  });
  res.redirect(302, appendReturnNativeToAuthorizePath('/api/auth/apple', req));
});

router.get('/apple/link-account/native-bridge', authLimiter, async (req, res, next) => {
  try {
    const rawTok = req.query?.token;
    if (!rawTok || typeof rawTok !== 'string') {
      return redirectPublic(res, '/profile?oauth_error=native_link_invalid');
    }
    const { userId, provider } = authService.verifyNativeOAuthLinkBootstrapToken(rawTok);
    if (provider !== 'apple') {
      return redirectPublic(res, '/profile?oauth_error=native_link_invalid');
    }
    const user = await authQueries.findUserById(userId);
    if (!user) {
      return redirectPublic(res, '/login?error=native_link');
    }
    if (user.apple_id) {
      return redirectPublic(res, '/profile?notice=apple_already_linked');
    }
    req.login(user, (err) => {
      if (err) return next(err);
      authService.captureOAuthReturnToNativeFromQuery(req);
      authService.setOAuthBrowserLinkFlow(req, {
        userId: user.user_id,
        provider: 'apple',
        successRedirect: '/profile?linked=apple',
        errorReturnBase: '/profile',
      });
      return res.redirect(302, appendReturnNativeToAuthorizePath('/api/auth/apple', req));
    });
  } catch {
    return redirectPublic(res, '/profile?oauth_error=native_link_expired');
  }
});

router.post('/apple/callback', express.urlencoded({ extended: true }), (req, res, next) => {
  const oauthReturnNativeFromSignedState = authService.hydrateOAuthReturnToNativeFromOAuthState(req);
  const nativeRedirectOpts = { returnNativeFromSignedState: oauthReturnNativeFromSignedState };
  passport.authenticate('apple', (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      const errBase = authService.takeOAuthErrorReturnBase(req.session);
      if (errBase) {
        const reason = req.session.appleOAuthFailureReason || 'apple';
        delete req.session.appleOAuthFailureReason;
        return res.redirect(
          302,
          authService.takeOAuthClientRedirect(
            req.session,
            `${errBase}?oauth_error=${encodeURIComponent(reason)}`,
            nativeRedirectOpts
          )
        );
      }
      delete req.session.appleOAuthFailureReason;
      return res.redirect(
        302,
        authService.takeOAuthClientRedirect(req.session, '/login?error=apple', nativeRedirectOpts)
      );
    }
    delete req.session.appleOAuthFailureReason;
    const target =
      authService.takeOAuthPostSuccessRedirect(req.session) || '/?signed_in=1';
    req.logIn(user, (loginErr) => {
      if (loginErr) {
        return next(loginErr);
      }
      return res.redirect(
        302,
        authService.takeOAuthClientRedirect(req.session, target, {
          ...nativeRedirectOpts,
          handoffUserId: user.user_id,
        })
      );
    });
  })(req, res, next);
});

module.exports = router;
