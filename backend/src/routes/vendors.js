const express = require('express');
const router = express.Router();
const db = require('../db/knex');
const { authenticateToken } = require('../middleware/auth');
const { logAction } = require('../utils/audit');

// All vendor routes require authentication
router.use(authenticateToken);

// @route   GET /api/vendors
// @desc    Get all vendors with optional vendor_type filter
router.get('/', async (req, res) => {
  const { type } = req.query;
  try {
    let query = db('vendors');
    if (type) {
      query = query.where({ vendor_type: type });
    }
    const vendors = await query.orderBy('vendor_name', 'asc');
    res.json(vendors);
  } catch (error) {
    console.error('Fetch vendors error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/vendors/:id
// @desc    Get vendor details by ID
router.get('/:id', async (req, res) => {
  const vendorId = req.params.id;
  try {
    const vendor = await db('vendors').where({ vendor_id: vendorId }).first();
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    res.json(vendor);
  } catch (error) {
    console.error('Fetch vendor details error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/vendors
// @desc    Create a new vendor
router.post('/', async (req, res) => {
  const { vendor_name, vendor_type, mobile, address, gst_number, notes } = req.body;

  if (!vendor_name || !vendor_type || !mobile) {
    return res.status(400).json({ error: 'Please enter vendor name, type, and mobile number' });
  }

  // Validate vendor type
  const validTypes = ['Dyed', 'Embroidery', 'Stitching', 'Diamond', 'Folding'];
  if (!validTypes.includes(vendor_type)) {
    return res.status(400).json({ error: 'Invalid vendor type. Must be Dyed, Embroidery, Stitching, Diamond, or Folding' });
  }

  try {
    const [newVendor] = await db('vendors')
      .insert({
        vendor_name,
        vendor_type,
        mobile,
        address: address || null,
        gst_number: gst_number || null,
        notes: notes || null
      })
      .returning('*');

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAction(
      req.user.id,
      req.user.name,
      'CREATE_VENDOR',
      `Created vendor ${vendor_name} (${vendor_type})`,
      ip
    );

    res.status(201).json(newVendor);
  } catch (error) {
    console.error('Create vendor error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/vendors/:id
// @desc    Update an existing vendor
router.put('/:id', async (req, res) => {
  const vendorId = req.params.id;
  const { vendor_name, vendor_type, mobile, address, gst_number, notes } = req.body;

  try {
    const vendor = await db('vendors').where({ vendor_id: vendorId }).first();
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const updates = {};
    if (vendor_name !== undefined) updates.vendor_name = vendor_name;
    if (vendor_type !== undefined) {
      const validTypes = ['Dyed', 'Embroidery', 'Stitching', 'Diamond', 'Folding'];
      if (!validTypes.includes(vendor_type)) {
        return res.status(400).json({ error: 'Invalid vendor type' });
      }
      updates.vendor_type = vendor_type;
    }
    if (mobile !== undefined) updates.mobile = mobile;
    if (address !== undefined) updates.address = address;
    if (gst_number !== undefined) updates.gst_number = gst_number;
    if (notes !== undefined) updates.notes = notes;

    updates.updated_at = db.fn.now();

    const [updatedVendor] = await db('vendors')
      .where({ vendor_id: vendorId })
      .update(updates)
      .returning('*');

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAction(
      req.user.id,
      req.user.name,
      'UPDATE_VENDOR',
      `Updated vendor ${updatedVendor.vendor_name} (${updatedVendor.vendor_type})`,
      ip
    );

    res.json(updatedVendor);
  } catch (error) {
    console.error('Update vendor error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/vendors/:id
// @desc    Delete a vendor
router.delete('/:id', async (req, res) => {
  const vendorId = req.params.id;

  try {
    const vendor = await db('vendors').where({ vendor_id: vendorId }).first();
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // Check if vendor has associated workflow history or payments
    const workflowCount = await db('workflow_history').where({ vendor_id: vendorId }).count('history_id as count').first();
    const paymentCount = await db('payments').where({ vendor_id: vendorId }).count('payment_id as count').first();

    if (parseInt(workflowCount.count) > 0 || parseInt(paymentCount.count) > 0) {
      return res.status(400).json({
        error: 'Cannot delete vendor. This vendor has associated history or payments. Consider modifying details instead.'
      });
    }

    await db('vendors').where({ vendor_id: vendorId }).del();

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAction(
      req.user.id,
      req.user.name,
      'DELETE_VENDOR',
      `Deleted vendor ${vendor.vendor_name} (${vendor.vendor_type})`,
      ip
    );

    res.json({ message: 'Vendor deleted successfully' });
  } catch (error) {
    console.error('Delete vendor error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
