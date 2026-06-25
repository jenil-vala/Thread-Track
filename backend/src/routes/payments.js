const express = require('express');
const router = express.Router();
const db = require('../db/knex');
const { authenticateToken } = require('../middleware/auth');
const { logAction } = require('../utils/audit');

// All payment routes require authentication
router.use(authenticateToken);

/**
 * Logs a payment snapshot to the payment_history table.
 * Crucial for satisfying the rule "Payment history must never be deleted".
 */
async function logPaymentHistory(trxOrDb, paymentId, actionType, createdByUserId) {
  try {
    // 1. Fetch payment details
    const p = await trxOrDb('payments').where({ payment_id: paymentId }).first();
    if (!p) return;

    // 2. Fetch vendor details
    const vendor = await trxOrDb('vendors').where({ vendor_id: p.vendor_id }).first();

    // 3. Fetch work record details if history_id is set
    let lotNumber = null;
    let challanNumber = null;
    if (p.history_id) {
      const wh = await trxOrDb('workflow_history as h')
        .join('sarees as s', 'h.saree_id', 's.saree_id')
        .select('s.lot_number', 'h.saree_id')
        .where('h.history_id', p.history_id)
        .first();
      
      if (wh) {
        lotNumber = wh.lot_number;
        // Calculate challan suffix dynamically
        const allHistory = await trxOrDb('workflow_history')
          .where({ saree_id: wh.saree_id })
          .orderBy('history_id', 'asc')
          .select('history_id');
        const recordIndex = allHistory.findIndex(h => h.history_id === parseInt(p.history_id));
        const chSuffix = recordIndex !== -1 ? (recordIndex + 1) : 1;
        challanNumber = `${wh.lot_number}.${chSuffix}`;
      }
    }

    // 4. Fetch user details
    const user = await trxOrDb('public.users').where({ id: createdByUserId }).first();

    // 5. Insert historical entry
    await trxOrDb('payment_history').insert({
      payment_id: p.payment_id,
      vendor_id: p.vendor_id,
      vendor_name: vendor ? vendor.vendor_name : 'Unknown',
      vendor_type: vendor ? vendor.vendor_type : 'Unknown',
      lot_number: lotNumber,
      challan_number: challanNumber,
      amount: p.amount,
      discount: p.discount,
      payment_method: p.payment_method,
      payment_date: p.payment_date,
      created_by_name: user ? user.name : 'System',
      created_by_id: createdByUserId,
      action_type: actionType,
      remarks: p.remarks
    });
  } catch (err) {
    console.error('Failed to write payment history log:', err);
  }
}

// @route   GET /api/payments/work-records
// @desc    Get completed work records (challans) and their payment/discount statuses
router.get('/work-records', async (req, res) => {
  const { lotNumber, vendorName, vendorType, paymentStatus } = req.query;

  try {
    // 1. Get completed workflow history records
    const workRecords = await db('workflow_history as h')
      .join('sarees as s', 'h.saree_id', 's.saree_id')
      .join('vendors as v', 'h.vendor_id', 'v.vendor_id')
      .select(
        'h.history_id',
        'h.received_date as date',
        's.lot_number',
        's.design_name',
        's.quantity',
        'v.vendor_id',
        'v.vendor_name',
        'v.vendor_type',
        'h.stage_name as work_stage',
        'h.work_cost as work_amount',
        'h.saree_id'
      )
      .whereNotNull('h.received_date');

    // 2. Fetch sum of payments and discounts grouped by history_id
    const paymentsSummary = await db('payments')
      .select('history_id')
      .sum('amount as total_paid')
      .sum('discount as total_discount')
      .groupBy('history_id');

    const paymentMap = new Map(
      paymentsSummary.map(p => [
        p.history_id,
        {
          total_paid: parseFloat(p.total_paid || 0),
          total_discount: parseFloat(p.total_discount || 0)
        }
      ])
    );

    // Dynamic sorting/order map for challan suffix calculation per saree_id
    // We compute the suffix sequentially based on history_id order for each saree
    const sareeHistoryIds = {};
    workRecords.forEach(wr => {
      if (!sareeHistoryIds[wr.saree_id]) {
        sareeHistoryIds[wr.saree_id] = [];
      }
      sareeHistoryIds[wr.saree_id].push(wr.history_id);
    });

    for (const sId in sareeHistoryIds) {
      sareeHistoryIds[sId].sort((a, b) => a - b);
    }

    // 3. Construct the items with calculated balances and statuses
    let results = workRecords.map(wr => {
      const pSum = paymentMap.get(wr.history_id) || { total_paid: 0, total_discount: 0 };
      
      const workAmount = parseFloat(wr.work_amount || 0);
      const discount = pSum.total_discount;
      const netAmount = Math.max(0, workAmount - discount);
      const paidAmount = pSum.total_paid;
      const outstandingAmount = Math.max(0, netAmount - paidAmount);
      
      let paymentStatusVal = 'Unpaid';
      if (paidAmount >= netAmount && (netAmount > 0 || paidAmount > 0)) {
        paymentStatusVal = 'Paid';
      } else if (paidAmount > 0) {
        paymentStatusVal = 'Partially Paid';
      }

      // Suffix index in sorted list + 1
      const chIdx = sareeHistoryIds[wr.saree_id].indexOf(wr.history_id);
      const chSuffix = chIdx !== -1 ? (chIdx + 1) : 1;

      return {
        history_id: wr.history_id,
        date: wr.date,
        lot_number: wr.lot_number,
        challan_number: `${wr.lot_number}.${chSuffix}`,
        vendor_id: wr.vendor_id,
        vendor_name: wr.vendor_name,
        vendor_type: wr.vendor_type,
        work_stage: wr.work_stage,
        work_amount: workAmount,
        discount,
        net_amount: netAmount,
        paid_amount: paidAmount,
        outstanding_amount: outstandingAmount,
        payment_status: paymentStatusVal
      };
    });

    // 4. Apply Filters
    if (lotNumber) {
      results = results.filter(r => r.lot_number.toString().includes(lotNumber.toString()));
    }
    if (vendorName) {
      results = results.filter(r => r.vendor_name.toLowerCase().includes(vendorName.toLowerCase()));
    }
    if (vendorType) {
      results = results.filter(r => r.vendor_type === vendorType);
    }
    if (paymentStatus) {
      results = results.filter(r => r.payment_status === paymentStatus);
    }

    // Sort: newest first
    results.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(results);
  } catch (error) {
    console.error('Fetch work records payments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/payments/outstanding-vendors
// @desc    Get list of vendors with positive outstanding balance
router.get('/outstanding-vendors', async (req, res) => {
  try {
    const workRecords = await db('workflow_history as h')
      .join('sarees as s', 'h.saree_id', 's.saree_id')
      .join('vendors as v', 'h.vendor_id', 'v.vendor_id')
      .select(
        'h.history_id',
        'h.received_date as date',
        's.lot_number',
        'v.vendor_id',
        'v.vendor_name',
        'v.vendor_type',
        'h.work_cost as work_amount'
      )
      .whereNotNull('h.received_date');

    const paymentsSummary = await db('payments')
      .select('history_id')
      .sum('amount as total_paid')
      .sum('discount as total_discount')
      .groupBy('history_id');

    const paymentMap = new Map(
      paymentsSummary.map(p => [
        p.history_id,
        {
          total_paid: parseFloat(p.total_paid || 0),
          total_discount: parseFloat(p.total_discount || 0)
        }
      ])
    );

    const lastPayments = await db('payments')
      .select('vendor_id')
      .max('payment_date as last_date')
      .groupBy('vendor_id');

    const lastPaymentMap = new Map(
      lastPayments.map(lp => [lp.vendor_id, lp.last_date])
    );

    const vendorMap = new Map();
    
    workRecords.forEach(wr => {
      const pSum = paymentMap.get(wr.history_id) || { total_paid: 0, total_discount: 0 };
      const workAmount = parseFloat(wr.work_amount || 0);
      const discount = pSum.total_discount;
      const netAmount = Math.max(0, workAmount - discount);
      const paidAmount = pSum.total_paid;
      const outstanding = Math.max(0, netAmount - paidAmount);

      if (!vendorMap.has(wr.vendor_id)) {
        vendorMap.set(wr.vendor_id, {
          vendor_name: wr.vendor_name,
          vendor_type: wr.vendor_type,
          total_work_amount: 0,
          total_paid: 0,
          total_discount: 0,
          outstanding_amount: 0,
          oldest_pending_date: null,
          last_payment_date: lastPaymentMap.get(wr.vendor_id) || null
        });
      }

      const v = vendorMap.get(wr.vendor_id);
      v.total_work_amount += workAmount;
      v.total_paid += paidAmount;
      v.total_discount += discount;
      v.outstanding_amount += outstanding;

      if (outstanding > 0) {
        const wrDate = new Date(wr.date);
        if (!v.oldest_pending_date || wrDate < new Date(v.oldest_pending_date)) {
          v.oldest_pending_date = wr.date;
        }
      }
    });

    const results = [];
    for (const [vendor_id, v] of vendorMap.entries()) {
      if (v.outstanding_amount > 0) {
        let daysOutstanding = 0;
        if (v.oldest_pending_date) {
          const diffTime = Math.abs(new Date() - new Date(v.oldest_pending_date));
          daysOutstanding = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        results.push({
          vendor_id,
          vendor_name: v.vendor_name,
          vendor_type: v.vendor_type,
          total_work_amount: v.total_work_amount,
          total_paid: v.total_paid,
          total_discount: v.total_discount,
          outstanding_amount: v.outstanding_amount,
          last_payment_date: v.last_payment_date,
          days_outstanding: daysOutstanding
        });
      }
    }

    results.sort((a, b) => b.outstanding_amount - a.outstanding_amount);
    res.json(results);
  } catch (error) {
    console.error('Fetch outstanding vendors error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/payments
// @desc    Get all payment history list for details
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

// @route   GET /api/payments/history/:historyId
// @desc    Get payments and discounts recorded specifically for a single workflow history (work record)
router.get('/history/:historyId', async (req, res) => {
  try {
    const payments = await db('payments as p')
      .leftJoin('public.users as u', 'p.created_by', 'u.id')
      .select('p.*', 'u.name as creator_name')
      .where('p.history_id', req.params.historyId)
      .orderBy('p.payment_date', 'desc');

    res.json(payments);
  } catch (error) {
    console.error('Fetch work record history error:', error);
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
// @desc    Record a new payment to a vendor, optionally linked to a work record (challan)
router.post('/', async (req, res) => {
  const { vendor_id, amount, payment_method, remarks, payment_date, history_id, discount, discount_reason } = req.body;

  if (!vendor_id) {
    return res.status(400).json({ error: 'Please specify vendor_id' });
  }

  const amt = parseFloat(amount) || 0;
  const disc = parseFloat(discount) || 0;

  if (amt <= 0 && disc <= 0) {
    return res.status(400).json({ error: 'Payment amount or Discount must be greater than 0' });
  }

  const validMethods = ['Cash', 'UPI', 'Bank Transfer', 'Cheque'];
  if (amt > 0 && !validMethods.includes(payment_method)) {
    return res.status(400).json({ error: 'Invalid payment method. Must be Cash, UPI, Bank Transfer, or Cheque' });
  }

  try {
    const vendor = await db('vendors').where({ vendor_id }).first();
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    if (history_id) {
      const wh = await db('workflow_history').where({ history_id, vendor_id }).first();
      if (!wh) {
        return res.status(400).json({ error: 'Work record not found or does not belong to the selected vendor' });
      }
    }

    const [newPayment] = await db('payments')
      .insert({
        vendor_id,
        amount: amt,
        payment_method: amt > 0 ? payment_method : 'Cash',
        remarks: remarks || null,
        payment_date: payment_date ? new Date(payment_date) : db.fn.now(),
        history_id: history_id || null,
        discount: disc,
        discount_reason: disc > 0 ? (discount_reason || 'General Discount') : null,
        discount_date: disc > 0 ? (payment_date ? new Date(payment_date) : db.fn.now()) : null,
        discount_by_user: disc > 0 ? req.user.id : null,
        created_by: req.user.id
      })
      .returning('*');

    // Create payment history record
    await logPaymentHistory(db, newPayment.payment_id, 'INSERT', req.user.id);

    // Audit action
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    let auditMsg = `Recorded payment of ₹${amt} to vendor ${vendor.vendor_name}`;
    if (disc > 0) {
      auditMsg += ` with discount of ₹${disc} (Reason: ${discount_reason || 'N/A'})`;
    }
    await logAction(req.user.id, req.user.name, 'CREATE_PAYMENT', auditMsg, ip);

    res.status(201).json(newPayment);
  } catch (error) {
    console.error('Record payment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/payments/:id
// @desc    Update a payment/discount record
router.put('/:id', async (req, res) => {
  const paymentId = req.params.id;
  const { amount, payment_method, remarks, payment_date, history_id, discount, discount_reason } = req.body;

  try {
    const oldPayment = await db('payments').where({ payment_id: paymentId }).first();
    if (!oldPayment) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    const vendor = await db('vendors').where({ vendor_id: oldPayment.vendor_id }).first();

    const amt = amount !== undefined ? parseFloat(amount) : oldPayment.amount;
    const disc = discount !== undefined ? parseFloat(discount) : oldPayment.discount;

    if (amt <= 0 && disc <= 0) {
      return res.status(400).json({ error: 'Amount or Discount must be greater than 0' });
    }

    const updateData = {
      amount: amt,
      payment_method: amt > 0 ? (payment_method || oldPayment.payment_method) : 'Cash',
      remarks: remarks !== undefined ? remarks : oldPayment.remarks,
      payment_date: payment_date ? new Date(payment_date) : oldPayment.payment_date,
      history_id: history_id !== undefined ? history_id : oldPayment.history_id,
      discount: disc,
      discount_reason: disc > 0 ? (discount_reason || oldPayment.discount_reason || 'Updated Discount') : null,
      discount_date: disc > 0 ? (payment_date ? new Date(payment_date) : oldPayment.discount_date || db.fn.now()) : null,
      discount_by_user: disc > 0 ? (oldPayment.discount_by_user || req.user.id) : null
    };

    const [updatedPayment] = await db('payments')
      .where({ payment_id: paymentId })
      .update(updateData)
      .returning('*');

    // Create log in payment_history
    await logPaymentHistory(db, paymentId, 'UPDATE', req.user.id);

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAction(
      req.user.id,
      req.user.name,
      'EDIT_PAYMENT',
      {
        old_value: oldPayment,
        new_value: updatedPayment
      },
      ip
    );

    res.json(updatedPayment);
  } catch (error) {
    console.error('Update payment error:', error);
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

    // Create payment history record BEFORE deleting the payment
    await logPaymentHistory(db, paymentId, 'DELETE', req.user.id);

    await db('payments').where({ payment_id: paymentId }).del();

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAction(
      req.user.id,
      req.user.name,
      'DELETE_PAYMENT',
      {
        deleted_payment: payment
      },
      ip
    );

    res.json({ message: 'Payment record deleted successfully' });
  } catch (error) {
    console.error('Delete payment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
