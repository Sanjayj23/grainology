import express from 'express';
import WarehouseMaster from '../models/WarehouseMaster.js';
import User from '../models/User.js';
import { authenticate, isAdminRole, isSuperAdmin } from '../middleware/auth.js';

const router = express.Router();
const normalizeUpper = (value) => String(value).trim().toUpperCase();
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Get all warehouse master records (optional filter by location_id)
router.get('/', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const { is_active, location_id, approval_status } = req.query;
    const query = {};
    const approvalStatus = String(approval_status || '').trim().toLowerCase();

    if (is_active !== undefined) {
      query.is_active = is_active === 'true';
    }
    if (location_id && String(location_id).trim()) {
      query.location_id = String(location_id).trim();
    }
    if (['pending', 'approved', 'declined'].includes(approvalStatus)) {
      query.approval_status = approvalStatus;
    }
    if (!isAdminRole(user)) {
      query.is_active = true;
      query.approval_status = 'approved';
    }

    const warehouses = await WarehouseMaster.find(query)
      .sort({ name: 1 });
    res.json(warehouses);
  } catch (error) {
    console.error('Get warehouse master error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch warehouse master' });
  }
});

// Search warehouses by name (realtime) - case-insensitive, for duplicate check
router.get('/search', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const { location_id, q } = req.query;
    if (!location_id || !String(location_id).trim()) {
      return res.status(400).json({ error: 'location_id is required' });
    }
    const searchName = (q && normalizeUpper(q)) || '';
    const query = { location_id: String(location_id).trim(), is_active: true };
    if (!isAdminRole(user)) {
      query.approval_status = 'approved';
    }
    if (searchName) {
      query.name = new RegExp('^' + escapeRegex(searchName) + '$', 'i');
    }
    const existing = await WarehouseMaster.findOne(query);
    res.json({ exists: !!existing, warehouse: existing ? existing.toJSON() : null });
  } catch (error) {
    console.error('Warehouse search error:', error);
    res.status(500).json({ error: error.message || 'Failed to search' });
  }
});

// Get warehouse master by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const warehouse = await WarehouseMaster.findById(req.params.id);
    if (!warehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }
    if (!isAdminRole(user) && (!warehouse.is_active || warehouse.approval_status !== 'approved')) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }
    res.json(warehouse);
  } catch (error) {
    console.error('Get warehouse error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch warehouse' });
  }
});

// Create warehouse master (admin only) - duplicate check case-insensitive
router.post('/', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!isAdminRole(user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { location_id, name } = req.body;
    if (!location_id || !String(location_id).trim()) {
      return res.status(400).json({ error: 'Location is required' });
    }
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Warehouse name is required' });
    }

    const locId = String(location_id).trim();
    const nameUpper = normalizeUpper(name);
    const existing = await WarehouseMaster.findOne({
      location_id: locId,
      name: new RegExp('^' + escapeRegex(nameUpper) + '$', 'i'),
      is_active: true
    });
    if (existing) {
      return res.status(400).json({ error: 'A warehouse with this name already exists at this location' });
    }

    const warehouse = new WarehouseMaster({
      location_id: locId,
      name: nameUpper,
      submitted_by: req.userId,
      approval_status: 'pending',
      approved_by: null,
      approved_at: null,
      declined_reason: ''
    });
    await warehouse.save();
    res.status(201).json(warehouse);
  } catch (error) {
    console.error('Create warehouse error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Warehouse with this name already exists at this location' });
    }
    res.status(500).json({ error: error.message || 'Failed to create warehouse' });
  }
});

// Update warehouse master (admin only) - duplicate check case-insensitive (exclude self)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!isAdminRole(user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const existingWarehouse = await WarehouseMaster.findById(req.params.id);
    if (!existingWarehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }
    if (existingWarehouse.approval_status === 'approved' && user.role === 'admin') {
      return res.status(403).json({ error: 'Cannot edit after Super Admin approval' });
    }

    const { location_id, name } = req.body;
    if (location_id && String(location_id).trim() && name && String(name).trim()) {
      const locId = String(location_id).trim();
      const nameUpper = normalizeUpper(name);
      const existing = await WarehouseMaster.findOne({
        location_id: locId,
        name: new RegExp('^' + escapeRegex(nameUpper) + '$', 'i'),
        is_active: true,
        _id: { $ne: req.params.id }
      });
      if (existing) {
        return res.status(400).json({ error: 'A warehouse with this name already exists at this location' });
      }
    }

    const updatePayload = { ...req.body };
    if (typeof updatePayload.location_id === 'string') {
      updatePayload.location_id = updatePayload.location_id.trim();
    }
    if (typeof updatePayload.name === 'string') {
      updatePayload.name = normalizeUpper(updatePayload.name);
    }

    const approvalFields = ['approval_status', 'approved_by', 'approved_at', 'declined_reason'];
    const approvalUpdateRequested = approvalFields.some((field) =>
      Object.prototype.hasOwnProperty.call(updatePayload, field)
    );
    if (approvalUpdateRequested && !isSuperAdmin(user)) {
      return res.status(403).json({ error: 'Only Super Admin can approve or decline warehouse' });
    }
    if (approvalUpdateRequested && isSuperAdmin(user) && existingWarehouse.approval_status !== 'pending') {
      return res.status(400).json({
        error: 'Approval already decided. Ask Admin to re-submit before reviewing again.'
      });
    }

    if (!isSuperAdmin(user)) {
      updatePayload.submitted_by = req.userId;
      updatePayload.approval_status = 'pending';
      updatePayload.approved_by = null;
      updatePayload.approved_at = null;
      updatePayload.declined_reason = '';
    } else if (Object.prototype.hasOwnProperty.call(updatePayload, 'approval_status')) {
      if (updatePayload.approval_status === 'approved') {
        updatePayload.approved_by = req.userId;
        updatePayload.approved_at = new Date();
        updatePayload.declined_reason = '';
      } else if (updatePayload.approval_status === 'declined') {
        const declinedReason = String(updatePayload.declined_reason || '').trim();
        if (!declinedReason) {
          return res.status(400).json({ error: 'Decline reason is required' });
        }
        updatePayload.approved_by = null;
        updatePayload.approved_at = null;
        updatePayload.declined_reason = declinedReason;
      } else if (updatePayload.approval_status === 'pending') {
        updatePayload.approved_by = null;
        updatePayload.approved_at = null;
        updatePayload.declined_reason = '';
      }
    }

    const warehouse = await WarehouseMaster.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true, runValidators: true }
    );

    res.json(warehouse);
  } catch (error) {
    console.error('Update warehouse error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Warehouse with this name already exists at this location' });
    }
    res.status(500).json({ error: error.message || 'Failed to update warehouse' });
  }
});

// Approve/decline warehouse (super admin only)
router.patch('/:id/approval', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!isSuperAdmin(user)) {
      return res.status(403).json({ error: 'Super Admin access required' });
    }

    const { status, reason } = req.body;
    if (!['approved', 'declined'].includes(String(status))) {
      return res.status(400).json({ error: 'status must be approved or declined' });
    }

    const warehouse = await WarehouseMaster.findById(req.params.id);
    if (!warehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }
    if (warehouse.approval_status !== 'pending') {
      return res.status(400).json({
        error: 'Approval already decided. Ask Admin to re-submit before reviewing again.'
      });
    }

    const declinedReason = String(reason || '').trim();
    if (status === 'declined' && !declinedReason) {
      return res.status(400).json({ error: 'Decline reason is required' });
    }

    const updatePayload = {
      approval_status: status,
      approved_by: status === 'approved' ? req.userId : null,
      approved_at: status === 'approved' ? new Date() : null,
      declined_reason: status === 'declined' ? declinedReason : ''
    };

    const updatedWarehouse = await WarehouseMaster.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true, runValidators: true }
    );

    res.json(updatedWarehouse);
  } catch (error) {
    console.error('Warehouse approval update error:', error);
    res.status(500).json({ error: error.message || 'Failed to update warehouse approval' });
  }
});

// Delete warehouse master (admin only) - soft delete by setting is_active to false
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!isAdminRole(user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const existingWarehouse = await WarehouseMaster.findById(req.params.id);
    if (!existingWarehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }
    if (existingWarehouse.approval_status === 'approved' && user.role === 'admin') {
      return res.status(403).json({ error: 'Cannot deactivate after Super Admin approval' });
    }

    const warehouse = await WarehouseMaster.findByIdAndUpdate(
      req.params.id,
      { is_active: false },
      { new: true }
    );

    res.json({ message: 'Warehouse deactivated successfully', warehouse });
  } catch (error) {
    console.error('Delete warehouse error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete warehouse' });
  }
});

export default router;
