import express from 'express';
import VarietyMaster from '../models/VarietyMaster.js';
import User from '../models/User.js';
import { authenticate, isAdminRole, isSuperAdmin } from '../middleware/auth.js';

const router = express.Router();
const normalizeUpper = (value) => String(value).trim().toUpperCase();
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeVarietyPayload = (payload = {}) => {
  const normalized = { ...payload };
  if (typeof normalized.commodity_name === 'string') {
    normalized.commodity_name = normalizeUpper(normalized.commodity_name);
  }
  if (typeof normalized.variety_name === 'string') {
    normalized.variety_name = normalizeUpper(normalized.variety_name);
  }
  if (typeof normalized.description === 'string') {
    normalized.description = normalized.description.trim();
  }
  return normalized;
};

// Get all variety master records
router.get('/', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const { commodity_name } = req.query;
    const query = {};

    if (commodity_name && String(commodity_name).trim()) {
      const commodityUpper = normalizeUpper(commodity_name);
      query.commodity_name = new RegExp(`^${escapeRegex(commodityUpper)}$`, 'i');
    }
    if (!isAdminRole(user)) {
      query.is_active = true;
      query.approval_status = 'approved';
    }

    const varieties = await VarietyMaster.find(query)
      .sort({ commodity_name: 1, variety_name: 1 });
    res.json(varieties);
  } catch (error) {
    console.error('Get variety master error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch variety master' });
  }
});

// Get variety master by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const variety = await VarietyMaster.findById(req.params.id);
    if (!variety) {
      return res.status(404).json({ error: 'Variety not found' });
    }
    if (!isAdminRole(user) && (!variety.is_active || variety.approval_status !== 'approved')) {
      return res.status(404).json({ error: 'Variety not found' });
    }
    res.json(variety);
  } catch (error) {
    console.error('Get variety error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch variety' });
  }
});

// Create variety master (admin only)
router.post('/', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!isAdminRole(user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const payload = normalizeVarietyPayload(req.body);
    if (!payload.commodity_name || !payload.variety_name) {
      return res.status(400).json({ error: 'Commodity and variety names are required' });
    }

    const variety = new VarietyMaster({
      ...payload,
      submitted_by: req.userId,
      approval_status: 'pending',
      approved_by: null,
      approved_at: null,
      declined_reason: ''
    });
    await variety.save();
    res.status(201).json(variety);
  } catch (error) {
    console.error('Create variety error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Variety with this name already exists for this commodity' });
    }
    res.status(500).json({ error: error.message || 'Failed to create variety' });
  }
});

// Update variety master (admin only)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!isAdminRole(user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const existing = await VarietyMaster.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Variety not found' });
    }
    if (existing.approval_status === 'approved' && user.role === 'admin') {
      return res.status(403).json({ error: 'Cannot edit after Super Admin approval' });
    }

    const payload = normalizeVarietyPayload(req.body);
    if ('commodity_name' in payload && !payload.commodity_name) {
      return res.status(400).json({ error: 'Commodity name is required' });
    }
    if ('variety_name' in payload && !payload.variety_name) {
      return res.status(400).json({ error: 'Variety name is required' });
    }

    const approvalFields = ['approval_status', 'approved_by', 'approved_at', 'declined_reason'];
    const approvalUpdateRequested = approvalFields.some((field) =>
      Object.prototype.hasOwnProperty.call(payload, field)
    );
    if (approvalUpdateRequested && !isSuperAdmin(user)) {
      return res.status(403).json({ error: 'Only Super Admin can approve or decline variety' });
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

    const variety = await VarietyMaster.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true, runValidators: true }
    );

    res.json(variety);
  } catch (error) {
    console.error('Update variety error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Variety with this name already exists for this commodity' });
    }
    res.status(500).json({ error: error.message || 'Failed to update variety' });
  }
});

// Approve/decline variety (super admin only)
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

    const variety = await VarietyMaster.findById(req.params.id);
    if (!variety) {
      return res.status(404).json({ error: 'Variety not found' });
    }
    if (variety.approval_status !== 'pending') {
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

    const updatedVariety = await VarietyMaster.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true, runValidators: true }
    );

    res.json(updatedVariety);
  } catch (error) {
    console.error('Variety approval update error:', error);
    res.status(500).json({ error: error.message || 'Failed to update variety approval' });
  }
});

// Delete variety master (admin only) - soft delete by setting is_active to false
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!isAdminRole(user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const existing = await VarietyMaster.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Variety not found' });
    }
    if (existing.approval_status === 'approved' && user.role === 'admin') {
      return res.status(403).json({ error: 'Cannot deactivate after Super Admin approval' });
    }

    const variety = await VarietyMaster.findByIdAndUpdate(
      req.params.id,
      { is_active: false },
      { new: true }
    );

    res.json({ message: 'Variety deactivated successfully', variety });
  } catch (error) {
    console.error('Delete variety error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete variety' });
  }
});

export default router;
