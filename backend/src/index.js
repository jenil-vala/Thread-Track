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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`THREAD TRACK BACKEND RUNNING ON PORT ${PORT}`);
  console.log(`=========================================`);
});
