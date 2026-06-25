const express = require('express');
const router = express.Router();
const db = require('../db/knex');
const { authenticateToken } = require('../middleware/auth');
const { logAction } = require('../utils/audit');

// All saree routes require authentication
router.use(authenticateToken);

// @route   GET /api/sarees/next-lot
// @desc    Get the next available lot number (max lot_number + 1)
router.get('/next-lot', async (req, res) => {
  try {
    const result = await db('sarees').max('lot_number as max_lot').first();
    const nextLot = (result.max_lot || 0) + 1;
    res.json({ nextLotNumber: nextLot });
  } catch (error) {
    console.error('Get next lot error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/sarees
// @desc    Get sarees with global search and advanced filters
router.get('/', async (req, res) => {
  const { search, stage, status, vendorId, startDate, endDate, limit = 50, offset = 0 } = req.query;

  try {
    let query = db('sarees as s')
      .leftJoin('vendors as v', 's.current_vendor_id', 'v.vendor_id')
      .select('s.*', 'v.vendor_name as current_vendor_name', 'v.vendor_type as current_vendor_type');

    // Advanced filters
    if (stage) {
      query = query.where('s.current_stage', stage);
    }

    if (status) {
      query = query.where('s.status', status);
    }

    if (vendorId) {
      query = query.where('s.current_vendor_id', vendorId);
    }

    if (startDate) {
      query = query.where('s.created_at', '>=', new Date(startDate));
    }

    if (endDate) {
      query = query.where('s.created_at', '<=', new Date(endDate + 'T23:59:59.999Z'));
    }

    // Global Search: Saree ID, Design Number/Name, Lot Number, Vendor Name
    if (search) {
      query = query.andWhere((qb) => {
        qb.where('s.design_name', 'ilike', `%${search}%`)
          .orWhere('v.vendor_name', 'ilike', `%${search}%`);
        
        const searchNum = parseInt(search);
        if (!isNaN(searchNum)) {
          qb.orWhere('s.lot_number', searchNum)
            .orWhere('s.saree_id', searchNum);
        }
      });
    }

    const countQuery = db('sarees as s')
      .leftJoin('vendors as v', 's.current_vendor_id', 'v.vendor_id');
      
    // Apply same filters to count
    let filteredCountQuery = countQuery;
    if (stage) filteredCountQuery = filteredCountQuery.where('s.current_stage', stage);
    if (status) filteredCountQuery = filteredCountQuery.where('s.status', status);
    if (vendorId) filteredCountQuery = filteredCountQuery.where('s.current_vendor_id', vendorId);
    if (startDate) filteredCountQuery = filteredCountQuery.where('s.created_at', '>=', new Date(startDate));
    if (endDate) filteredCountQuery = filteredCountQuery.where('s.created_at', '<=', new Date(endDate + 'T23:59:59.999Z'));
    if (search) {
      filteredCountQuery = filteredCountQuery.andWhere((qb) => {
        qb.where('s.design_name', 'ilike', `%${search}%`)
          .orWhere('v.vendor_name', 'ilike', `%${search}%`);
        const searchNum = parseInt(search);
        if (!isNaN(searchNum)) {
          qb.orWhere('s.lot_number', searchNum).orWhere('s.saree_id', searchNum);
        }
      });
    }

    const [{ count }] = await filteredCountQuery.count('s.saree_id as count');
    const sarees = await query.orderBy('s.lot_number', 'desc').limit(limit).offset(offset);

    res.json({
      total: parseInt(count),
      sarees
    });
  } catch (error) {
    console.error('Fetch sarees error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/sarees/:id
// @desc    Get detailed saree by ID with its full workflow history
router.get('/:id', async (req, res) => {
  const sareeId = req.params.id;

  try {
    const saree = await db('sarees as s')
      .leftJoin('vendors as v', 's.current_vendor_id', 'v.vendor_id')
      .select('s.*', 'v.vendor_name as current_vendor_name', 'v.vendor_type as current_vendor_type')
      .where('s.saree_id', sareeId)
      .first();

    if (!saree) {
      return res.status(404).json({ error: 'Saree lot not found' });
    }

    // Get workflow history
    const history = await db('workflow_history as h')
      .join('vendors as v', 'h.vendor_id', 'v.vendor_id')
      .leftJoin('public.users as u', 'h.updated_by', 'u.id')
      .select('h.*', 'v.vendor_name', 'v.vendor_type', 'u.name as updater_name')
      .where('h.saree_id', sareeId)
      .orderBy('h.sent_date', 'asc')
      .orderBy('h.history_id', 'asc');

    res.json({
      ...saree,
      history
    });
  } catch (error) {
    console.error('Fetch saree detail error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/sarees
// @desc    Create new saree lot (Step 1: Raw saree received, sent to Dyed, and completed immediately)
router.post('/', async (req, res) => {
  const { lot_number, design_name, quantity, dyed_vendor_id, fabric_cost, remarks } = req.body;

  if (!design_name || !quantity || !dyed_vendor_id || fabric_cost === undefined) {
    return res.status(400).json({ error: 'Please enter design name, quantity, dyed vendor, and fabric cost' });
  }

  try {
    // Check if lot_number is duplicate if provided
    let lotNum = lot_number;
    if (lotNum) {
      const existing = await db('sarees').where({ lot_number: lotNum }).first();
      if (existing) {
        return res.status(400).json({ error: `Lot number ${lotNum} already exists` });
      }
    } else {
      // Auto-assign next lot number
      const result = await db('sarees').max('lot_number as max_lot').first();
      lotNum = (result.max_lot || 0) + 1;
    }

    // Validate dyed vendor
    const vendor = await db('vendors').where({ vendor_id: dyed_vendor_id, vendor_type: 'Dyed' }).first();
    if (!vendor) {
      return res.status(400).json({ error: 'Invalid Dyed Vendor selected' });
    }

    // Run transaction
    const [newSaree] = await db.transaction(async (trx) => {
      // 1. Insert saree. Current stage is 'Dyed', vendor is null (since we complete Dyed immediately)
      const [saree] = await trx('sarees')
        .insert({
          lot_number: lotNum,
          design_name,
          quantity,
          current_stage: 'Dyed',
          current_vendor_id: null,
          status: 'In Process',
          remarks: remarks || null
        })
        .returning('*');

      // 2. Insert workflow_history as completed Dyed stage
      const now = new Date();
      await trx('workflow_history').insert({
        saree_id: saree.saree_id,
        stage_name: 'Dyed',
        vendor_id: dyed_vendor_id,
        sent_date: now,
        received_date: now,
        work_cost: fabric_cost,
        remarks: 'Dyed stage completed on lot creation',
        updated_by: req.user.id
      });

      return [saree];
    });

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAction(
      req.user.id,
      req.user.name,
      'CREATE_SAREE',
      `Created saree lot ${lotNum} (${design_name}, Qty: ${quantity}) and completed Dyed stage with Vendor ${vendor.vendor_name}`,
      ip
    );

    res.status(201).json(newSaree);
  } catch (error) {
    console.error('Create saree lot error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/sarees/:id/send
// @desc    Move Saree to next stage by sending it to a vendor (Step 2/3: Dyed -> Dyeing/Print -> Embroidery -> Stitching -> Diamond -> Folding)
router.post('/:id/send', async (req, res) => {
  const sareeId = req.params.id;
  const { stage_name, vendor_id, work_cost, per_unit_rate, remarks } = req.body;

  if (!stage_name || !vendor_id || (work_cost === undefined && per_unit_rate === undefined)) {
    return res.status(400).json({ error: 'Please specify stage_name, vendor_id, and either work_cost or per_unit_rate' });
  }

  // Validate stage name
  const validStages = ['Dyeing/Print', 'Embroidery', 'Stitching', 'Diamond', 'Folding'];
  if (!validStages.includes(stage_name)) {
    return res.status(400).json({ error: 'Invalid stage. Must be Dyeing/Print, Embroidery, Stitching, Diamond, or Folding' });
  }

  try {
    const saree = await db('sarees').where({ saree_id: sareeId }).first();
    if (!saree) {
      return res.status(404).json({ error: 'Saree not found' });
    }

    if (saree.status === 'Completed') {
      return res.status(400).json({ error: 'Saree lot has already been completed' });
    }

    // Check if the saree is currently with a vendor (i.e. has active pending history entry)
    if (saree.current_vendor_id) {
      return res.status(400).json({ error: 'Saree is currently with another vendor. Receive it first before sending.' });
    }

    // Validate vendor type matches stage name
    const vendor = await db('vendors').where({ vendor_id }).first();
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    if (vendor.vendor_type.toLowerCase() !== stage_name.toLowerCase()) {
      return res.status(400).json({ error: `Selected vendor is a ${vendor.vendor_type} vendor, but trying to send for ${stage_name} work` });
    }

    // Calculate final work cost
    let finalCost = work_cost;
    if (per_unit_rate !== undefined) {
      finalCost = saree.quantity * parseFloat(per_unit_rate);
    }

    // Run transaction
    const updatedSaree = await db.transaction(async (trx) => {
      // 1. Insert pending workflow history
      await trx('workflow_history').insert({
        saree_id: sareeId,
        stage_name,
        vendor_id,
        sent_date: trx.fn.now(),
        received_date: null,
        work_cost: finalCost,
        remarks: remarks || null,
        updated_by: req.user.id
      });

      // 2. Update Saree stage and current vendor
      const [updated] = await trx('sarees')
        .where({ saree_id: sareeId })
        .update({
          current_stage: stage_name,
          current_vendor_id: vendor_id,
          status: 'In Process',
          updated_at: trx.fn.now()
        })
        .returning('*');

      return updated;
    });

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAction(
      req.user.id,
      req.user.name,
      'SEND_SAREE_STAGE',
      `Sent saree lot ${saree.lot_number} to vendor ${vendor.vendor_name} for ${stage_name} stage (Cost: ₹${finalCost})`,
      ip
    );

    res.json(updatedSaree);
  } catch (error) {
    console.error('Send saree to stage error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/sarees/:id/receive
// @desc    Receive Saree back from the current vendor, completing the active stage
router.post('/:id/receive', async (req, res) => {
  const sareeId = req.params.id;
  const { remarks, actual_cost } = req.body;

  try {
    const saree = await db('sarees').where({ saree_id: sareeId }).first();
    if (!saree) {
      return res.status(404).json({ error: 'Saree not found' });
    }

    if (!saree.current_vendor_id) {
      return res.status(400).json({ error: 'Saree is not currently pending with any vendor' });
    }

    // Find the active workflow history record
    const pendingHistory = await db('workflow_history')
      .where({ saree_id: sareeId, received_date: null })
      .orderBy('history_id', 'desc')
      .first();

    if (!pendingHistory) {
      return res.status(404).json({ error: 'Pending workflow record not found' });
    }

    const vendor = await db('vendors').where({ vendor_id: saree.current_vendor_id }).first();

    // Run transaction
    const updatedSaree = await db.transaction(async (trx) => {
      const now = trx.fn.now();

      // 1. Complete the workflow history record
      const historyUpdates = {
        received_date: now,
        updated_by: req.user.id
      };
      if (remarks) historyUpdates.remarks = remarks;
      if (actual_cost !== undefined) historyUpdates.work_cost = actual_cost;

      await trx('workflow_history')
        .where({ history_id: pendingHistory.history_id })
        .update(historyUpdates);

      // 2. Update Saree: if the completed stage is 'Folding', the pipeline ends
      const isFolding = pendingHistory.stage_name === 'Folding';
      const sareeUpdates = {
        current_vendor_id: null,
        status: isFolding ? 'Completed' : 'In Process',
        current_stage: isFolding ? 'Completed' : pendingHistory.stage_name, // e.g. status becomes completed
        updated_at: now
      };

      const [updated] = await trx('sarees')
        .where({ saree_id: sareeId })
        .update(sareeUpdates)
        .returning('*');

      return updated;
    });

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAction(
      req.user.id,
      req.user.name,
      'RECEIVE_SAREE_STAGE',
      `Received saree lot ${saree.lot_number} back from vendor ${vendor.vendor_name} for stage ${pendingHistory.stage_name}`,
      ip
    );

    res.json(updatedSaree);
  } catch (error) {
    console.error('Receive saree error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/sarees/:id/rollback
// @desc    Rollback the last history record for the saree lot (e.g. undo accidental send/receive)
router.post('/:id/rollback', async (req, res) => {
  const sareeId = req.params.id;

  try {
    const saree = await db('sarees').where({ saree_id: sareeId }).first();
    if (!saree) {
      return res.status(404).json({ error: 'Saree not found' });
    }

    // Get the latest history record
    const latestHistory = await db('workflow_history')
      .where({ saree_id: sareeId })
      .orderBy('history_id', 'desc')
      .first();

    if (!latestHistory) {
      return res.status(400).json({ error: 'No history records found to rollback' });
    }

    // Cannot roll back the initial 'Dyed' step because that deletes the saree's baseline
    if (latestHistory.stage_name === 'Dyed' && latestHistory.received_date !== null) {
      // Find count of history items
      const historyCount = await db('workflow_history').where({ saree_id: sareeId }).count('history_id as count').first();
      if (parseInt(historyCount.count) <= 1) {
        return res.status(400).json({ error: 'Cannot rollback the initial Dyed stage. Delete the entire saree lot instead.' });
      }
    }

    // Perform rollback in a transaction
    const rolledBackSaree = await db.transaction(async (trx) => {
      // If the latest record is pending (received_date is null), we are rolling back a "SEND" action
      if (latestHistory.received_date === null) {
        // Delete this history record
        await trx('workflow_history').where({ history_id: latestHistory.history_id }).del();

        // Get the previous history record to set the saree stage back
        const prevHistory = await trx('workflow_history')
          .where({ saree_id: sareeId })
          .orderBy('history_id', 'desc')
          .first();

        // Update saree
        const [updated] = await trx('sarees')
          .where({ saree_id: sareeId })
          .update({
            current_stage: prevHistory ? prevHistory.stage_name : 'Dyed',
            current_vendor_id: null,
            status: 'In Process',
            updated_at: trx.fn.now()
          })
          .returning('*');

        return updated;
      } else {
        // If the latest record is completed (received_date is not null), we are rolling back a "RECEIVE" action
        // Set received_date to null
        await trx('workflow_history')
          .where({ history_id: latestHistory.history_id })
          .update({ received_date: null });

        // Update saree to point back to the vendor
        const [updated] = await trx('sarees')
          .where({ saree_id: sareeId })
          .update({
            current_stage: latestHistory.stage_name,
            current_vendor_id: latestHistory.vendor_id,
            status: 'In Process',
            updated_at: trx.fn.now()
          })
          .returning('*');

        return updated;
      }
    });

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAction(
      req.user.id,
      req.user.name,
      'ROLLBACK_STAGE',
      `Rolled back last step for saree lot ${saree.lot_number}`,
      ip
    );

    res.json(rolledBackSaree);
  } catch (error) {
    console.error('Rollback error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/sarees/:id
// @desc    Update basic saree lot details (design name, quantity, remarks, status)
router.put('/:id', async (req, res) => {
  const sareeId = req.params.id;
  const { design_name, quantity, remarks, status } = req.body;

  try {
    const saree = await db('sarees').where({ saree_id: sareeId }).first();
    if (!saree) {
      return res.status(404).json({ error: 'Saree not found' });
    }

    const updates = {};
    if (design_name !== undefined) updates.design_name = design_name;
    if (quantity !== undefined) {
      if (quantity <= 0) return res.status(400).json({ error: 'Quantity must be greater than 0' });
      updates.quantity = quantity;
    }
    if (remarks !== undefined) updates.remarks = remarks;
    if (status !== undefined) {
      const validStatuses = ['In Process', 'Completed', 'Hold'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      updates.status = status;
    }

    updates.updated_at = db.fn.now();

    const [updatedSaree] = await db('sarees')
      .where({ saree_id: sareeId })
      .update(updates)
      .returning('*');

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAction(
      req.user.id,
      req.user.name,
      'UPDATE_SAREE',
      `Updated saree lot ${saree.lot_number} details`,
      ip
    );

    res.json(updatedSaree);
  } catch (error) {
    console.error('Update saree error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/sarees/:id
// @desc    Delete a saree lot
router.delete('/:id', async (req, res) => {
  const sareeId = req.params.id;

  try {
    const saree = await db('sarees').where({ saree_id: sareeId }).first();
    if (!saree) {
      return res.status(404).json({ error: 'Saree not found' });
    }

    await db('sarees').where({ saree_id: sareeId }).del();

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAction(
      req.user.id,
      req.user.name,
      'DELETE_SAREE',
      `Deleted saree lot ${saree.lot_number} (${saree.design_name})`,
      ip
    );

    res.json({ message: 'Saree lot deleted successfully' });
  } catch (error) {
    console.error('Delete saree error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/sarees/history/:historyId
// @desc    Edit a specific workflow history record (e.g. edit Dyed stage cost or vendor)
router.put('/history/:historyId', async (req, res) => {
  const historyId = req.params.historyId;
  const { vendor_id, work_cost, remarks } = req.body;

  if (!vendor_id || work_cost === undefined) {
    return res.status(400).json({ error: 'Please select a vendor and specify the work cost' });
  }

  try {
    const history = await db('workflow_history').where({ history_id: historyId }).first();
    if (!history) {
      return res.status(404).json({ error: 'History record not found' });
    }

    const saree = await db('sarees').where({ saree_id: history.saree_id }).first();
    if (!saree) {
      return res.status(404).json({ error: 'Associated saree lot not found' });
    }

    // Validate vendor
    const vendor = await db('vendors').where({ vendor_id }).first();
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    if (vendor.vendor_type.toLowerCase() !== history.stage_name.toLowerCase()) {
      return res.status(400).json({ error: `Selected vendor is a ${vendor.vendor_type} vendor, but this stage is ${history.stage_name}` });
    }

    await db.transaction(async (trx) => {
      // Update history entry
      await trx('workflow_history')
        .where({ history_id: historyId })
        .update({
          vendor_id: parseInt(vendor_id),
          work_cost: parseFloat(work_cost),
          remarks: remarks || null,
          updated_by: req.user.id
        });

      // If this history entry is currently active on the saree (received_date is null),
      // we must update the saree's current vendor.
      if (history.received_date === null && saree.current_vendor_id === history.vendor_id) {
        await trx('sarees')
          .where({ saree_id: history.saree_id })
          .update({
            current_vendor_id: parseInt(vendor_id)
          });
      }
    });

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAction(
      req.user.id,
      req.user.name,
      'EDIT_HISTORY_STAGE',
      `Edited ${history.stage_name} stage record for saree lot ${saree.lot_number} (Cost: ₹${work_cost})`,
      ip
    );

    res.json({ message: 'History record updated successfully' });
  } catch (error) {
    console.error('Edit history stage error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/sarees/history/:historyId
// @desc    Delete a specific workflow history record (e.g. delete Dyed stage or other stages)
router.delete('/history/:historyId', async (req, res) => {
  const historyId = req.params.historyId;

  try {
    const history = await db('workflow_history').where({ history_id: historyId }).first();
    if (!history) {
      return res.status(404).json({ error: 'History record not found' });
    }

    const saree = await db('sarees').where({ saree_id: history.saree_id }).first();
    if (!saree) {
      return res.status(404).json({ error: 'Associated saree lot not found' });
    }

    // Check if this history entry is the 'Dyed' stage
    if (history.stage_name === 'Dyed') {
      // Deleting Dyed stage deletes the entire saree lot
      await db.transaction(async (trx) => {
        await trx('sarees').where({ saree_id: history.saree_id }).del();
      });

      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logAction(
        req.user.id,
        req.user.name,
        'DELETE_SAREE',
        `Deleted saree lot ${saree.lot_number} by deleting its Dyed stage`,
        ip
      );

      return res.json({ message: 'Saree lot and history deleted successfully', deletedLot: true });
    } else {
      // Deleting a non-Dyed stage
      await db.transaction(async (trx) => {
        await trx('workflow_history').where({ history_id: historyId }).del();
        
        // Get the latest history record now
        const latest = await trx('workflow_history')
          .where({ saree_id: history.saree_id })
          .orderBy('history_id', 'desc')
          .first();

        if (latest) {
          const isFolding = latest.stage_name === 'Folding' && latest.received_date !== null;
          await trx('sarees')
            .where({ saree_id: history.saree_id })
            .update({
              current_stage: latest.received_date === null ? latest.stage_name : (isFolding ? 'Completed' : latest.stage_name),
              current_vendor_id: latest.received_date === null ? latest.vendor_id : null,
              status: isFolding ? 'Completed' : 'In Process',
              updated_at: trx.fn.now()
            });
        } else {
          // No history records left! Delete the saree lot.
          await trx('sarees').where({ saree_id: history.saree_id }).del();
        }
      });

      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logAction(
        req.user.id,
        req.user.name,
        'DELETE_HISTORY_STAGE',
        `Deleted stage ${history.stage_name} from saree lot ${saree.lot_number}`,
        ip
      );

      return res.json({ message: 'History record deleted successfully', deletedLot: false });
    }
  } catch (error) {
    console.error('Delete history stage error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
