const express = require('express');
const router = express.Router();
const db = require('../db/knex');
const { authenticateToken } = require('../middleware/auth');

// All reports routes require authentication
router.use(authenticateToken);

// @route   GET /api/reports/dashboard
// @desc    Get counts and summary cards for the landing dashboard
router.get('/dashboard', async (req, res) => {
  try {
    // 1. Total sarees and total quantity
    const totalSarees = await db('sarees').count('saree_id as count').first();
    const totalQty = await db('sarees').sum('quantity as qty').first();

    // 2. Counts and quantities grouped by stage
    const stageCounts = await db('sarees')
      .select('current_stage', 'status')
      .count('saree_id as count')
      .sum('quantity as qty')
      .groupBy('current_stage', 'status');

    // 3. Outstanding payable total
    // Sum of all completed work cost - sum of all payments
    const workTotal = await db('workflow_history').sum('work_cost as total').whereNotNull('received_date').first();
    const payTotal = await db('payments').sum('amount as total').first();
    const outstanding = parseFloat(workTotal.total || 0) - parseFloat(payTotal.total || 0);

    // 4. Counts of active vendors
    const vendorCount = await db('vendors').count('vendor_id as count').first();

    // Formulate clean counts per stage for the pipeline view
    // Stages: Dyed, Embroidery, Stitching, Diamond, Folding, Completed
    const pipeline = {
      Dyed: { count: 0, qty: 0 },
      Embroidery: { count: 0, qty: 0 },
      Stitching: { count: 0, qty: 0 },
      Diamond: { count: 0, qty: 0 },
      Folding: { count: 0, qty: 0 },
      Completed: { count: 0, qty: 0 }
    };

    stageCounts.forEach(item => {
      let stage = item.current_stage;
      if (item.status === 'Completed' || stage === 'Completed') {
        pipeline.Completed.count += parseInt(item.count);
        pipeline.Completed.qty += parseInt(item.qty || 0);
      } else if (pipeline[stage]) {
        pipeline[stage].count += parseInt(item.count);
        pipeline[stage].qty += parseInt(item.qty || 0);
      }
    });

    res.json({
      summary: {
        total_sarees_lots: parseInt(totalSarees.count || 0),
        total_sarees_quantity: parseInt(totalQty.qty || 0),
        total_outstanding_payable: outstanding,
        total_vendors: parseInt(vendorCount.count || 0),
        total_manufacturing_cost: parseFloat(workTotal.total || 0)
      },
      pipeline
    });
  } catch (error) {
    console.error('Fetch dashboard stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/reports/production
// @desc    Production report listing active and completed saree lots with current stages and vendors
router.get('/production', async (req, res) => {
  const { stage, status, designName } = req.query;

  try {
    let query = db('sarees as s')
      .leftJoin('vendors as v', 's.current_vendor_id', 'v.vendor_id')
      .select('s.*', 'v.vendor_name as current_vendor_name', 'v.vendor_type as current_vendor_type');

    if (stage) query = query.where('s.current_stage', stage);
    if (status) query = query.where('s.status', status);
    if (designName) query = query.where('s.design_name', 'ilike', `%${designName}%`);

    const production = await query.orderBy('s.lot_number', 'desc');
    res.json(production);
  } catch (error) {
    console.error('Fetch production report error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/reports/outstanding
// @desc    Outstanding liabilities report (who we owe money to)
router.get('/outstanding', async (req, res) => {
  try {
    // We reuse the logic from the Hisab router but filter for positive outstanding balances
    const vendors = await db('vendors').orderBy('vendor_name', 'asc');
    const workSummary = await db('workflow_history').select('vendor_id').sum('work_cost as total_work').whereNotNull('received_date').groupBy('vendor_id');
    const paymentSummary = await db('payments').select('vendor_id').sum('amount as total_paid').groupBy('vendor_id');

    const workMap = new Map(workSummary.map(w => [w.vendor_id, w]));
    const paymentMap = new Map(paymentSummary.map(p => [p.vendor_id, p]));

    const outstandingVendors = vendors
      .map(vendor => {
        const vId = vendor.vendor_id;
        const workTotal = parseFloat(workMap.get(vId)?.total_work || 0);
        const paymentTotal = parseFloat(paymentMap.get(vId)?.total_paid || 0);
        const balance = workTotal - paymentTotal;

        return {
          vendor_id: vendor.vendor_id,
          vendor_name: vendor.vendor_name,
          vendor_type: vendor.vendor_type,
          mobile: vendor.mobile,
          total_work: workTotal,
          total_paid: paymentTotal,
          pending_balance: balance
        };
      })
      .filter(v => v.pending_balance > 0);

    const totalOutstanding = outstandingVendors.reduce((sum, v) => sum + v.pending_balance, 0);

    res.json({
      total_outstanding: totalOutstanding,
      vendors: outstandingVendors
    });
  } catch (error) {
    console.error('Fetch outstanding report error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
