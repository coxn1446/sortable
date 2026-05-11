const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const userRoutes = require('./users');
const uploadRoutes = require('./uploads');
const healthRoutes = require('./health');
const listRoutes = require('./lists');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/uploads', uploadRoutes);
router.use('/health', healthRoutes);
router.use('/lists', listRoutes);

router.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

router.use((err, req, res, _next) => {
  if (err && err.name === 'ListServiceError') {
    return res.status(err.status || 400).json({ error: err.message });
  }

  if (err && typeof err.status === 'number') {
    const errorMessage = formatErrStatusError(err);
    const logOAuthDetail =
      process.env.DEBUG_APPLE_AUTH === '1' || process.env.NODE_ENV !== 'production';
    if (
      logOAuthDetail &&
      (err.name === 'TokenError' || err.name === 'InternalOAuthError' || err.status >= 500)
    ) {
      console.error('[api] OAuth / HTTP error:', err.name, err.status, errorMessage, err.code || '');
    }
    return res.status(err.status).json({ error: errorMessage, ...(err.code ? { code: err.code } : {}) });
  }
  console.error('[api] unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

/** Passport OAuth TokenError often has code but no message (Apple omits error_description). */
function formatErrStatusError(err) {
  if (err.message) return err.message;
  if (typeof err.oauthError === 'string') return err.oauthError;
  if (err.oauthError && err.oauthError.message) return err.oauthError.message;
  if (err.code) return err.code;
  if (err.name === 'InternalOAuthError' && err.toString) return err.toString();
  return 'Request failed';
}

module.exports = router;
