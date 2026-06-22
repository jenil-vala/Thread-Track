const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db/knex');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logAction } = require('../utils/audit');

// All routes here require auth and Admin role
router.use(authenticateToken);
router.use(requireAdmin);

// @route   GET /api/users
// @desc    Get all users
router.get('/', async (req, res) => {
  try {
    const users = await db('users')
      .select('id', 'name', 'mobile', 'email', 'role', 'active', 'created_at', 'updated_at')
      .orderBy('name', 'asc');
    res.json(users);
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/users
// @desc    Create a new user
router.post('/', async (req, res) => {
  const { name, mobile, email, password, role } = req.body;

  if (!name || !mobile || !password || !role) {
    return res.status(400).json({ error: 'Please enter name, mobile, password, and role' });
  }

  try {
    // Check if mobile already exists
    const existingUser = await db('users').where({ mobile }).first();
    if (existingUser) {
      return res.status(400).json({ error: 'User with this mobile number already exists' });
    }

    if (email) {
      const existingEmail = await db('users').where({ email }).first();
      if (existingEmail) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [newUser] = await db('users')
      .insert({
        name,
        mobile,
        email: email || null,
        password_hash: passwordHash,
        role,
        active: true
      })
      .returning(['id', 'name', 'mobile', 'email', 'role', 'active', 'created_at']);

    // Create database for all new users so they start with a clean database
    try {
      const { createTenantDatabase } = require('../db/manager');
      await createTenantDatabase(mobile);
    } catch (dbError) {
      console.error('Failed to create tenant database, rolling back user insertion:', dbError);
      // Rollback user insertion in central DB to avoid orphaned user records
      await db('users').where({ id: newUser.id }).del();
      return res.status(500).json({ error: 'Failed to initialize tenant database. User creation cancelled.' });
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAction(req.user.id, req.user.name, 'CREATE_USER', `Created user ${name} (${role})`, ip);

    res.status(201).json(newUser);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/users/:id
// @desc    Update a user
router.put('/:id', async (req, res) => {
  const { name, mobile, email, password, role, active } = req.body;
  const userId = req.params.id;

  try {
    const user = await db('users').where({ id: userId }).first();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;
    if (active !== undefined) updates.active = active;

    if (mobile !== undefined && mobile !== user.mobile) {
      const existingUser = await db('users').where({ mobile }).first();
      if (existingUser) {
        return res.status(400).json({ error: 'Mobile number already in use' });
      }
      updates.mobile = mobile;
    }

    if (email !== undefined && email !== user.email) {
      if (email) {
        const existingEmail = await db('users').where({ email }).first();
        if (existingEmail) {
          return res.status(400).json({ error: 'Email already in use' });
        }
      }
      updates.email = email || null;
    }

    if (password) {
      updates.password_hash = await bcrypt.hash(password, 10);
    }

    // Rename database if mobile is changed
    const mobileChanged = mobile !== undefined && mobile !== user.mobile;
    if (mobileChanged) {
      const { getTenantDbName, baseDb, renameTenantDbCache } = require('../db/manager');
      const oldDbName = getTenantDbName(user.mobile);
      const newDbName = getTenantDbName(mobile);
      
      try {
        // First check if old database exists
        const checkDb = await baseDb.raw('SELECT 1 FROM pg_database WHERE datname = ?', [oldDbName]);
        if (checkDb.rows.length > 0) {
          // Terminate active connections to old database so we can rename it
          await baseDb.raw(`
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname = ? AND pid <> pg_backend_pid()
          `, [oldDbName]);
          
          // Rename database
          await baseDb.raw(`ALTER DATABASE "${oldDbName}" RENAME TO "${newDbName}"`);
          console.log(`Database renamed from "${oldDbName}" to "${newDbName}".`);
          
          // Clear cached connection pool instances
          renameTenantDbCache(user.mobile, mobile);
        }
      } catch (dbError) {
        console.error('Failed to rename database:', dbError);
        return res.status(500).json({ error: 'Failed to update database mapping. Mobile number change cancelled.' });
      }
    }

    updates.updated_at = db.fn.now();

    const [updatedUser] = await db('users')
      .where({ id: userId })
      .update(updates)
      .returning(['id', 'name', 'mobile', 'email', 'role', 'active', 'updated_at']);

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAction(
      req.user.id,
      req.user.name,
      'UPDATE_USER',
      `Updated user ${updatedUser.name} (active: ${updatedUser.active}, role: ${updatedUser.role})`,
      ip
    );

    res.json(updatedUser);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete a user
router.delete('/:id', async (req, res) => {
  const userId = req.params.id;

  if (parseInt(userId) === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }

  try {
    const user = await db('users').where({ id: userId }).first();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await db('users').where({ id: userId }).del();

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAction(req.user.id, req.user.name, 'DELETE_USER', `Deleted user ${user.name} (${user.mobile})`, ip);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
