require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const vendorRoutes = require('./routes/vendors');
const sareeRoutes = require('./routes/sarees');
const paymentRoutes = require('./routes/payments');
const hisabRoutes = require('./routes/hisab');
const reportRoutes = require('./routes/reports');
const pdfRoutes = require('./routes/pdf');
const adminRoutes = require('./routes/admin');
const settingsRoutes = require('./routes/settings');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes Mount
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/sarees', sareeRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/hisab', hisabRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Serve backup downloads if needed or direct from admin router
// We are good with programmatic download streams in routes

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

const db = require('./db/knex');
const bcrypt = require('bcryptjs');

// Automatically seed a default admin user if the database has no registered users
async function seedAdminIfEmpty() {
  try {
    const [{ count }] = await db('users').count('id as count');
    if (parseInt(count) === 0) {
      console.log('No users found in database. Initializing default admin user...');
      const passwordHash = await bcrypt.hash('admin123', 10);
      const adminDbName = 'thread_track_9879312949';
      await db('users').insert({
        name: 'Admin Developer',
        mobile: '9879312949',
        email: 'admin@threadtrack.com',
        password_hash: passwordHash,
        role: 'Admin',
        db_name: adminDbName,
        active: true
      });
      console.log('Default admin user created successfully: mobile "9879312949", password "admin123"');

      // Ensure the default admin user's database is created on first launch
      const { createTenantDatabase } = require('./db/manager');
      await createTenantDatabase(adminDbName);
    }
  } catch (error) {
    console.error('Failed to verify or seed default admin user:', error);
  }
}

// Run database migrations on startup to automatically initialize tables in production
async function runMigrations() {
  try {
    console.log('Running central database migrations...');
    await db.migrate.latest();
    console.log('Central database migrations completed successfully.');
  } catch (error) {
    console.error('Database migration failed on startup:', error);
  }
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  const { detectMultiTenancyMode } = require('./db/manager');
  await detectMultiTenancyMode();
  await runMigrations();
  await seedAdminIfEmpty();
  console.log(`=========================================`);
  console.log(`THREAD TRACK BACKEND RUNNING ON PORT ${PORT}`);
  console.log(`=========================================`);
});
