const express = require('express');
const router = express.Router();

const authService = require('../services/authService');
const userService = require('../services/userService');
const { requireAuth } = require('../middleware/requireAuth');

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.user.user_id);
    res.json({ user: authService.toPublicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.patch('/me', requireAuth, async (req, res, next) => {
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

module.exports = router;
