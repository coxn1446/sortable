const express = require('express');
const router = express.Router();

const authService = require('../services/authService');
const userService = require('../services/userService');
const { requireAuth } = require('../middleware/requireAuth');
const { requirePolicyConsent } = require('../middleware/requirePolicyConsent');
const { authLimiter } = require('../middleware/rateLimits');

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.user.user_id);
    res.json({ user: authService.toPublicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post('/me/accept-policies', requireAuth, async (req, res, next) => {
  try {
    const user = await userService.acceptUpdatedPolicies(req.user.user_id, req.body || {});
    res.json({ user: authService.toPublicUser(user) });
  } catch (error) {
    if (error && (error.status === 400 || error.status === 404)) {
      return res.status(error.status).json({
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
      });
    }
    next(error);
  }
});

router.patch('/me', requireAuth, requirePolicyConsent, async (req, res, next) => {
  try {
    const user = await userService.updateUser(req.user.user_id, req.body || {});
    res.json({ user: authService.toPublicUser(user) });
  } catch (error) {
    if (error && (error.status === 400 || error.status === 409)) {
      return res.status(error.status).json({
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
      });
    }
    next(error);
  }
});

router.patch('/me/password', requireAuth, requirePolicyConsent, authLimiter, async (req, res, next) => {
  try {
    const user = await userService.changePassword(req.user.user_id, req.body || {});
    res.json({ user: authService.toPublicUser(user) });
  } catch (error) {
    if (error && error.status === 400) {
      return res.status(400).json({
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
      });
    }
    next(error);
  }
});

router.post('/me/unlink-oauth', requireAuth, requirePolicyConsent, authLimiter, async (req, res, next) => {
  try {
    const provider = req.body?.provider;
    const user = await userService.unlinkOAuthProvider(req.user.user_id, provider);
    res.json({ user: authService.toPublicUser(user) });
  } catch (error) {
    if (error && (error.status === 400 || error.status === 404)) {
      return res.status(error.status).json({
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
      });
    }
    next(error);
  }
});

module.exports = router;
