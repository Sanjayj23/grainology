import express from 'express';
import CommodityMaster from '../models/CommodityMaster.js';
import User from '../models/User.js';
import { authenticate, isAdminRole, isSuperAdmin } from '../middleware/auth.js';

const router = express.Router();
const normalizeUpper = (value) => String(value).trim().toUpperCase();

const normalizeCommodityPayload = (payload = {}) => {
  const normalized = { ...payload };
  if (typeof normalized.name === 'string') {
    normalized.name = normalizeUpper(normalized.name);
  }
  if (typeof normalized.category === 'string') {
    normalized.category = normalizeUpper(normalized.category);
  }
  if (typeof normalized.description === 'string') {
    normalized.description = normalized.description.trim();
  }
  return normalized;
};

// Get all commodity master records
router.get('/', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const { is_active } = req.query;
    const query = {};

    if (is_active !== undefined) {
      query.is_active = is_active === 'true';
    }
    if (!isAdminRole(user)) {
      query.is_active = true;
      query.approval_status = 'approved';
    }

    const commodities = await CommodityMaster.find(query)
      .sort({ name: 1 });
    res.json(commodities);
  } catch (error) {
    console.error('Get commodity master error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch commodity master' });
  }
});

// Get commodity master by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const commodity = await CommodityMaster.findById(req.params.id);
    if (!commodity) {
      return res.status(404).json({ error: 'Commodity not found' });
    }
    if (!isAdminRole(user) && (!commodity.is_active || commodity.approval_status !== 'approved')) {
      return res.status(404).json({ error: 'Commodity not found' });
    }
    res.json(commodity);
  } catch (error) {
    console.error('Get commodity error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch commodity' });
  }
});

// Create commodity master (admin only)
router.post('/', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!isAdminRole(user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const payload = normalizeCommodityPayload(req.body);
    if (!payload.name) {
      return res.status(400).json({ error: 'Commodity name is required' });
    }

    const commodity = new CommodityMaster({
      ...payload,
      submitted_by: req.userId,
      approval_status: 'pending',
      approved_by: null,
      approved_at: null,
      declined_reason: ''
    });
    await commodity.save();
    res.status(201).json(commodity);
  } catch (error) {
    console.error('Create commodity error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Commodity with this name already exists' });
    }
    res.status(500).json({ error: error.message || 'Failed to create commodity' });
  }
});

// Update commodity master (admin only)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!isAdminRole(user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const existing = await CommodityMaster.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Commodity not found' });
    }
    if (existing.approval_status === 'approved' && user.role === 'admin') {
      return res.status(403).json({ error: 'Cannot edit after Super Admin approval' });
    }

    const payload = normalizeCommodityPayload(req.body);
    if ('name' in payload && !payload.name) {
      return res.status(400).json({ error: 'Commodity name is required' });
    }

    const approvalFields = ['approval_status', 'approved_by', 'approved_at', 'declined_reason'];
    const approvalUpdateRequested = approvalFields.some((field) =>
      Object.prototype.hasOwnProperty.call(payload, field)
    );
    if (approvalUpdateRequested && !isSuperAdmin(user)) {
      return res.status(403).json({ error: 'Only Super Admin can approve or decline commodity' });
    }
    if (approvalUpdateRequested && isSuperAdmin(user) && existing.approval_status !== 'pending') {
      return res.status(400).json({
        error: 'Approval already decided. Ask Admin to re-submit before reviewing again.'
      });
    }

    const updatePayload = { ...payload };
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

    const commodity = await CommodityMaster.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true, runValidators: true }
    );

    res.json(commodity);
  } catch (error) {
    console.error('Update commodity error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Commodity with this name already exists' });
    }
    res.status(500).json({ error: error.message || 'Failed to update commodity' });
  }
});

// Approve/decline commodity (super admin only)
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

    const commodity = await CommodityMaster.findById(req.params.id);
    if (!commodity) {
      return res.status(404).json({ error: 'Commodity not found' });
    }
    if (commodity.approval_status !== 'pending') {
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

    const updatedCommodity = await CommodityMaster.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true, runValidators: true }
    );

    res.json(updatedCommodity);
  } catch (error) {
    console.error('Commodity approval update error:', error);
    res.status(500).json({ error: error.message || 'Failed to update commodity approval' });
  }
});

// Delete commodity master (admin only) - soft delete by setting is_active to false
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!isAdminRole(user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const existing = await CommodityMaster.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Commodity not found' });
    }
    if (existing.approval_status === 'approved' && user.role === 'admin') {
      return res.status(403).json({ error: 'Cannot deactivate after Super Admin approval' });
    }

    const commodity = await CommodityMaster.findByIdAndUpdate(
      req.params.id,
      { is_active: false },
      { new: true }
    );

    res.json({ message: 'Commodity deactivated successfully', commodity });
  } catch (error) {
    console.error('Delete commodity error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete commodity' });
  }
});

export default router;
