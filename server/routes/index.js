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
    return res.status(err.status).json({ error: err.message || 'Request failed' });
  }
  console.error('[api] unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = router;
