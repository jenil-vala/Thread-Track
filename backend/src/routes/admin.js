const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const db = require('../db/knex');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logAction } = require('../utils/audit');

// All admin routes require auth and Admin role
router.use(authenticateToken);
router.use(requireAdmin);

// @route   GET /api/admin/audit-logs
// @desc    Get system audit logs (ordered newest first)
router.get('/audit-logs', async (req, res) => {
  const { limit = 100, offset = 0 } = req.query;

  try {
    const logs = await db('audit_logs')
      .orderBy('created_at', 'desc')
      .orderBy('log_id', 'desc')
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db('audit_logs').count('log_id as count');

    res.json({
      total: parseInt(count),
      logs
    });
  } catch (error) {
    console.error('Fetch audit logs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/admin/backup
// @desc    Perform a backup of the thread_track database
router.post('/backup', async (req, res) => {
  const backupDir = path.join(__dirname, '../../backups');

  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `thread_track_backup_${timestamp}.dump`;
    const backupFilePath = path.join(backupDir, backupFileName);

    // Resolve pg_dump utility path dynamically depending on OS (Windows vs Linux)
    const isWindows = process.platform === 'win32';
    const pgDumpPath = isWindows ? '"C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe"' : 'pg_dump';

    const dbHost = process.env.DB_HOST || '127.0.0.1';
    const dbPort = process.env.DB_PORT || 5432;
    const dbUser = process.env.DB_USER || 'postgres';
    const dbPassword = process.env.DB_PASSWORD || 'postgres';
    const dbName = process.env.DB_NAME || 'thread_track';

    // Set password environment variable so pg_dump runs non-interactively
    const env = { ...process.env, PGPASSWORD: dbPassword };

    // Format 'custom' is highly compressed and suitable for pg_restore
    const cmd = `${pgDumpPath} -h ${dbHost} -p ${dbPort} -U ${dbUser} -F c -f "${backupFilePath}" ${dbName}`;

    exec(cmd, { env }, async (error, stdout, stderr) => {
      if (error) {
        console.error('Backup command error:', error);
        console.error('Stderr:', stderr);
        return res.status(500).json({ error: 'Backup failed', details: stderr });
      }

      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logAction(
        req.user.id,
        req.user.name,
        'BACKUP_DATABASE',
        `Database backup created: ${backupFileName}`,
        ip
      );

      res.json({
        message: 'Backup completed successfully',
        fileName: backupFileName,
        filePath: backupFilePath
      });
    });
  } catch (error) {
    console.error('Backup handler error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/admin/restore
// @desc    Restore database from a specific backup file
router.post('/restore', async (req, res) => {
  const { fileName } = req.body;

  if (!fileName) {
    return res.status(400).json({ error: 'Please specify backup fileName to restore' });
  }

  const backupDir = path.join(__dirname, '../../backups');
  const backupFilePath = path.join(backupDir, fileName);

  if (!fs.existsSync(backupFilePath)) {
    return res.status(404).json({ error: 'Backup file not found' });
  }

  try {
    const isWindows = process.platform === 'win32';
    const pgRestorePath = isWindows ? '"C:\\Program Files\\PostgreSQL\\18\\bin\\pg_restore.exe"' : 'pg_restore';

    const dbHost = process.env.DB_HOST || '127.0.0.1';
    const dbPort = process.env.DB_PORT || 5432;
    const dbUser = process.env.DB_USER || 'postgres';
    const dbPassword = process.env.DB_PASSWORD || 'postgres';
    const dbName = process.env.DB_NAME || 'thread_track';

    const env = { ...process.env, PGPASSWORD: dbPassword };

    // --clean drops database objects before recreating them
    const cmd = `${pgRestorePath} -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} --clean "${backupFilePath}"`;

    exec(cmd, { env }, async (error, stdout, stderr) => {
      // pg_restore might print warnings to stderr which can be ignored, but let's check exit code/error
      if (error) {
        console.error('Restore command error:', error);
        console.error('Stderr:', stderr);
        return res.status(500).json({ error: 'Restore failed', details: stderr });
      }

      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logAction(
        req.user.id,
        req.user.name,
        'RESTORE_DATABASE',
        `Database restored from backup: ${fileName}`,
        ip
      );

      res.json({ message: 'Database restored successfully' });
    });
  } catch (error) {
    console.error('Restore handler error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/admin/backups
// @desc    List available database backup files
router.get('/backups', async (req, res) => {
  const backupDir = path.join(__dirname, '../../backups');

  try {
    if (!fs.existsSync(backupDir)) {
      return res.json([]);
    }

    const files = fs.readdirSync(backupDir);
    const backupFiles = files
      .filter(f => f.startsWith('thread_track_backup_') && f.endsWith('.dump'))
      .map(f => {
        const filePath = path.join(backupDir, f);
        const stats = fs.statSync(filePath);
        return {
          fileName: f,
          size: stats.size,
          createdAt: stats.birthtime
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    res.json(backupFiles);
  } catch (error) {
    console.error('List backups error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
