const express = require('express');
const multer = require('multer');
const router = express.Router();

const uploadService = require('../services/uploadService');
const { requireAuth } = require('../middleware/requireAuth');
const { requirePolicyConsent } = require('../middleware/requirePolicyConsent');

const authWithConsent = [requireAuth, requirePolicyConsent];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post('/', ...authWithConsent, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    const result = await uploadService.uploadFile({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      userId: req.user.user_id,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
