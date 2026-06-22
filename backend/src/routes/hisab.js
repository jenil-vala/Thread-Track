const express = require('express');
const router = express.Router();
const db = require('../db/knex');
const { authenticateToken } = require('../middleware/auth');

// All hisab routes require authentication
router.use(authenticateToken);

// @route   GET /api/hisab
// @desc    Get summary of all vendors with work costs, paid amounts, and pending balances
router.get('/', async (req, res) => {
  const { startDate, endDate } = req.query;

  try {
    // 1. Get all vendors
    const vendors = await db('vendors').orderBy('vendor_name', 'asc');

    // 2. Fetch total work cost for all vendors (where received_date is not null)
    let workQuery = db('workflow_history')
      .select('vendor_id')
      .sum('work_cost as total_work')
      .count('history_id as completed_sarees')
      .whereNotNull('received_date')
      .groupBy('vendor_id');

    // 3. Fetch total paid for all vendors
    let paymentQuery = db('payments')
      .select('vendor_id')
      .sum('amount as total_paid')
      .groupBy('vendor_id');

    // 4. Fetch current pending sarees count (received_date is null)
    let pendingQuery = db('workflow_history')
      .select('vendor_id')
      .count('history_id as pending_sarees')
      .whereNull('received_date')
      .groupBy('vendor_id');

    if (startDate) {
      workQuery = workQuery.where('received_date', '>=', new Date(startDate));
      paymentQuery = paymentQuery.where('payment_date', '>=', new Date(startDate));
      pendingQuery = pendingQuery.where('sent_date', '>=', new Date(startDate));
    }
    if (endDate) {
      workQuery = workQuery.where('received_date', '<=', new Date(endDate + 'T23:59:59.999Z'));
      paymentQuery = paymentQuery.where('payment_date', '<=', new Date(endDate + 'T23:59:59.999Z'));
      pendingQuery = pendingQuery.where('sent_date', '<=', new Date(endDate + 'T23:59:59.999Z'));
    }

    const workSummary = await workQuery;
    const paymentSummary = await paymentQuery;
    const pendingSummary = await pendingQuery;

    // Create lookup maps for fast merging
    const workMap = new Map(workSummary.map(w => [w.vendor_id, w]));
    const paymentMap = new Map(paymentSummary.map(p => [p.vendor_id, p]));
    const pendingMap = new Map(pendingSummary.map(p => [p.vendor_id, p]));

    // 5. Merge calculations for each vendor
    const hisabSummary = vendors.map(vendor => {
      const vId = vendor.vendor_id;
      const workData = workMap.get(vId) || { total_work: 0, completed_sarees: 0 };
      const paymentData = paymentMap.get(vId) || { total_paid: 0 };
      const pendingData = pendingMap.get(vId) || { pending_sarees: 0 };

      const totalWork = parseFloat(workData.total_work || 0);
      const totalPaid = parseFloat(paymentData.total_paid || 0);
      const pendingBalance = totalWork - totalPaid;

      return {
        vendor_id: vendor.vendor_id,
        vendor_name: vendor.vendor_name,
        vendor_type: vendor.vendor_type,
        mobile: vendor.mobile,
        total_work: totalWork,
        total_paid: totalPaid,
        pending_balance: pendingBalance,
        completed_sarees_count: parseInt(workData.completed_sarees || 0),
        pending_sarees_count: parseInt(pendingData.pending_sarees || 0)
      };
    });

    res.json(hisabSummary);
  } catch (error) {
    console.error('Fetch Hisab summary error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/hisab/vendors/:id
// @desc    Get detailed transaction ledger for a specific vendor
router.get('/vendors/:id', async (req, res) => {
  const vendorId = req.params.id;

  try {
    const vendor = await db('vendors').where({ vendor_id: vendorId }).first();
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // 1. Get all completed work records for this vendor
    const workRecords = await db('workflow_history as h')
      .join('sarees as s', 'h.saree_id', 's.saree_id')
      .select(
        'h.history_id',
        'h.received_date as date',
        's.lot_number',
        's.design_name',
        's.quantity',
        'h.stage_name',
        'h.work_cost as amount',
        'h.remarks'
      )
      .where('h.vendor_id', vendorId)
      .whereNotNull('h.received_date');

    // 2. Get all payment records for this vendor
    const paymentRecords = await db('payments')
      .select('payment_id', 'payment_date as date', 'amount', 'payment_method', 'remarks')
      .where('vendor_id', vendorId);

    // 3. Construct chronological ledger entries
    const ledger = [];

    // Add completed work entries (credits to the vendor)
    workRecords.forEach(w => {
      ledger.push({
        id: `work_${w.history_id}`,
        date: new Date(w.date),
        type: 'work',
        description: `${w.stage_name} work completed on Lot #${w.lot_number} (${w.design_name}, Qty: ${w.quantity})`,
        amount: parseFloat(w.amount),
        remarks: w.remarks
      });
    });

    // Add payment entries (debits/reductions in balance)
    paymentRecords.forEach(p => {
      ledger.push({
        id: `payment_${p.payment_id}`,
        date: new Date(p.date),
        type: 'payment',
        description: `Payment made via ${p.payment_method}`,
        amount: parseFloat(p.amount),
        remarks: p.remarks
      });
    });

    // Sort chronologically by date
    ledger.sort((a, b) => a.date - b.date);

    // Calculate running balance
    // Work cost increases what we owe the vendor (increases pending_balance)
    // Payments decrease what we owe (decreases pending_balance)
    let runningBalance = 0;
    const ledgerWithRunningBalance = ledger.map(entry => {
      if (entry.type === 'work') {
        runningBalance += entry.amount;
      } else {
        runningBalance -= entry.amount;
      }
      return {
        ...entry,
        running_balance: runningBalance
      };
    });

    // Reverse to display newest transactions first in the UI
    ledgerWithRunningBalance.reverse();

    // Summary calculations
    const totalWork = workRecords.reduce((sum, w) => sum + parseFloat(w.amount), 0);
    const totalPaid = paymentRecords.reduce((sum, p) => sum + parseFloat(p.amount), 0);

    res.json({
      vendor,
      summary: {
        total_work: totalWork,
        total_paid: totalPaid,
        pending_balance: totalWork - totalPaid
      },
      ledger: ledgerWithRunningBalance
    });
  } catch (error) {
    console.error('Fetch vendor ledger error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
