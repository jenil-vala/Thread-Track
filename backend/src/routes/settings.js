const express = require('express');
const router = express.Router();
const db = require('../db/knex');
const { authenticateToken } = require('../middleware/auth');
const { logAction } = require('../utils/audit');

// All settings routes require authentication
router.use(authenticateToken);

// @route   GET /api/settings
// @desc    Get all settings
router.get('/', async (req, res) => {
  try {
    const settings = await db('settings').select('*');
    // Format as a simple key-value object
    const settingsObj = {};
    settings.forEach(s => {
      settingsObj[s.key] = s.value;
    });
    res.json(settingsObj);
  } catch (error) {
    console.error('Fetch settings error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/settings
// @desc    Update system settings
router.post('/', async (req, res) => {
  const settingsObj = req.body;

  try {
    await db.transaction(async (trx) => {
      for (const [key, value] of Object.entries(settingsObj)) {
        // Upsert setting
        const exists = await trx('settings').where({ key }).first();
        if (exists) {
          await trx('settings').where({ key }).update({ value: String(value) });
        } else {
          await trx('settings').insert({ key, value: String(value) });
        }
      }
    });

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAction(req.user.id, req.user.name, 'UPDATE_SETTINGS', 'Updated system settings configurations', ip);

    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Save settings error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
