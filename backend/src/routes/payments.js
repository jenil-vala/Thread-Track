const express = require('express');
const router = express.Router();
const db = require('../db/knex');
const { authenticateToken } = require('../middleware/auth');
const { logAction } = require('../utils/audit');

// All payment routes require authentication
router.use(authenticateToken);

// @route   GET /api/payments
// @desc    Get all payments, optionally filtered by vendor_id
router.get('/', async (req, res) => {
  const { vendorId } = req.query;

  try {
    let query = db('payments as p')
      .join('vendors as v', 'p.vendor_id', 'v.vendor_id')
      .leftJoin('users as u', 'p.created_by', 'u.id')
      .select('p.*', 'v.vendor_name', 'v.vendor_type', 'u.name as creator_name');

    if (vendorId) {
      query = query.where('p.vendor_id', vendorId);
    }

    const payments = await query.orderBy('p.payment_date', 'desc').orderBy('p.payment_id', 'desc');
    res.json(payments);
  } catch (error) {
    console.error('Fetch payments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/payments/:id
// @desc    Get single payment details
router.get('/:id', async (req, res) => {
  try {
    const payment = await db('payments as p')
      .join('vendors as v', 'p.vendor_id', 'v.vendor_id')
      .leftJoin('users as u', 'p.created_by', 'u.id')
      .select('p.*', 'v.vendor_name', 'v.vendor_type', 'u.name as creator_name')
      .where('p.payment_id', req.params.id)
      .first();

    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found' });
    }
    res.json(payment);
  } catch (error) {
    console.error('Fetch payment detail error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/payments
// @desc    Record a new payment to a vendor
router.post('/', async (req, res) => {
  const { vendor_id, amount, payment_method, remarks, payment_date } = req.body;

  if (!vendor_id || !amount || !payment_method) {
    return res.status(400).json({ error: 'Please specify vendor_id, amount, and payment_method' });
  }

  const validMethods = ['Cash', 'UPI', 'Bank Transfer', 'Cheque'];
  if (!validMethods.includes(payment_method)) {
    return res.status(400).json({ error: 'Invalid payment method. Must be Cash, UPI, Bank Transfer, or Cheque' });
  }

  if (parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Payment amount must be greater than 0' });
  }

  try {
    const vendor = await db('vendors').where({ vendor_id }).first();
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const [newPayment] = await db('payments')
      .insert({
        vendor_id,
        amount,
        payment_method,
        remarks: remarks || null,
        payment_date: payment_date ? new Date(payment_date) : db.fn.now(),
        created_by: req.user.id
      })
      .returning('*');

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAction(
      req.user.id,
      req.user.name,
      'CREATE_PAYMENT',
      `Recorded payment of ₹${amount} (${payment_method}) to vendor ${vendor.vendor_name}`,
      ip
    );

    res.status(201).json(newPayment);
  } catch (error) {
    console.error('Record payment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/payments/:id
// @desc    Delete a payment record
router.delete('/:id', async (req, res) => {
  const paymentId = req.params.id;

  try {
    const payment = await db('payments').where({ payment_id: paymentId }).first();
    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    const vendor = await db('vendors').where({ vendor_id: payment.vendor_id }).first();

    await db('payments').where({ payment_id: paymentId }).del();

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAction(
      req.user.id,
      req.user.name,
      'DELETE_PAYMENT',
      `Deleted payment of ₹${payment.amount} previously made to vendor ${vendor ? vendor.vendor_name : 'Unknown'}`,
      ip
    );

    res.json({ message: 'Payment record deleted successfully' });
  } catch (error) {
    console.error('Delete payment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
