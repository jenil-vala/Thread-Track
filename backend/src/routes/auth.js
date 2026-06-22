const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/knex');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logAction } = require('../utils/audit');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretthreadtracktoken';

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
router.post('/login', async (req, res) => {
  const { mobile, password } = req.body;

  if (!mobile || !password) {
    return res.status(400).json({ error: 'Please enter mobile and password' });
  }

  try {
    const user = await db('users')
      .where({ mobile })
      .orWhere(db.raw('LOWER(name) = ?', [mobile.toLowerCase()]))
      .first();

    if (!user) {
      return res.status(400).json({ error: 'Invalid username/mobile or password' });
    }

    if (!user.active) {
      return res.status(403).json({ error: 'User account is deactivated. Contact Admin.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid username/mobile or password' });
    }

    // Sign Token
    const payload = {
      id: user.id,
      name: user.name,
      mobile: user.mobile,
      role: user.role,
      active: user.active
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    // Audit log
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAction(user.id, user.name, 'LOGIN', 'Successful login', ip);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await db('users').where({ id: req.user.id }).first();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      id: user.id,
      name: user.name,
      mobile: user.mobile,
      email: user.email,
      role: user.role,
      active: user.active
    });
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/auth/logout
// @desc    Log out user & log audit trail
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAction(req.user.id, req.user.name, 'LOGOUT', 'Successful logout', ip);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
