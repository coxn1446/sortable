const express = require('express');
const passport = require('passport');
const router = express.Router();

const authService = require('../services/authService');
const { authLimiter } = require('../middleware/rateLimits');

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

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/link-account', requireSessionRedirectToLogin, (req, res) => {
  if (req.user.google_id) {
    return res.redirect(302, '/profile?notice=google_already_linked');
  }
  authService.setOAuthBrowserLinkFlow(req, {
    userId: req.user.user_id,
    provider: 'google',
    successRedirect: '/profile?linked=google',
    errorReturnBase: '/profile',
  });
  res.redirect(302, '/api/auth/google');
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
  passport.authenticate('google', (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      const errBase = authService.takeOAuthErrorReturnBase(req.session);
      if (errBase) {
        const reason = req.session.googleOAuthFailureReason || 'google';
        delete req.session.googleOAuthFailureReason;
        return res.redirect(302, `${errBase}?oauth_error=${encodeURIComponent(reason)}`);
      }
      if (req.session.pendingGoogleLink) {
        return res.redirect(302, '/login?google_link=1');
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
      return res.redirect(302, `/login?${q}`);
    }

    delete req.session.googleOAuthFailureReason;
    delete req.session.pendingGoogleLink;

    const target =
      authService.takeOAuthPostSuccessRedirect(req.session) || '/?signed_in=1';

    req.logIn(user, (loginErr) => {
      if (loginErr) {
        return next(loginErr);
      }
      return res.redirect(302, target);
    });
  })(req, res, next);
});

router.get(
  '/apple',
  passport.authenticate('apple', { scope: ['name', 'email'] })
);

router.get('/apple/link-account', requireSessionRedirectToLogin, (req, res) => {
  if (req.user.apple_id) {
    return res.redirect(302, '/profile?notice=apple_already_linked');
  }
  authService.setOAuthBrowserLinkFlow(req, {
    userId: req.user.user_id,
    provider: 'apple',
    successRedirect: '/profile?linked=apple',
    errorReturnBase: '/profile',
  });
  res.redirect(302, '/api/auth/apple');
});

router.post('/apple/callback', express.urlencoded({ extended: true }), (req, res, next) => {
  passport.authenticate('apple', (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      const errBase = authService.takeOAuthErrorReturnBase(req.session);
      if (errBase) {
        const reason = req.session.appleOAuthFailureReason || 'apple';
        delete req.session.appleOAuthFailureReason;
        return res.redirect(302, `${errBase}?oauth_error=${encodeURIComponent(reason)}`);
      }
      delete req.session.appleOAuthFailureReason;
      return res.redirect(302, '/login?error=apple');
    }
    delete req.session.appleOAuthFailureReason;
    const target =
      authService.takeOAuthPostSuccessRedirect(req.session) || '/?signed_in=1';
    req.logIn(user, (loginErr) => {
      if (loginErr) {
        return next(loginErr);
      }
      return res.redirect(302, target);
    });
  })(req, res, next);
});

module.exports = router;
