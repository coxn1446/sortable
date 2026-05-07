const express = require('express');
const passport = require('passport');
const router = express.Router();

const authService = require('../services/authService');
const { authLimiter } = require('../middleware/rateLimits');

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

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=google' }),
  (req, res) => {
    res.redirect('/');
  }
);

router.get(
  '/apple',
  passport.authenticate('apple', { scope: ['name', 'email'] })
);

router.post(
  '/apple/callback',
  express.urlencoded({ extended: true }),
  passport.authenticate('apple', { failureRedirect: '/login?error=apple' }),
  (req, res) => {
    res.redirect('/');
  }
);

module.exports = router;
