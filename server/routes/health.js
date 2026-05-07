const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW() as now');
    res.json({
      status: 'healthy',
      database: 'connected',
      now: result.rows[0].now,
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      environment: process.env.NODE_ENV || 'development',
    });
  }
});

module.exports = router;
