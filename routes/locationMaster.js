import express from 'express';
import LocationMaster from '../models/LocationMaster.js';
import User from '../models/User.js';
import { authenticate, isAdminRole, isSuperAdmin } from '../middleware/auth.js';

const router = express.Router();
const normalizeUpper = (value) => String(value).trim().toUpperCase();
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Get all location master records (optional filter by state, one-letter search q)
router.get('/', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const { is_active, state, q, approval_status } = req.query;
    const query = {};
    const approvalStatus = String(approval_status || '').trim().toLowerCase();

    if (is_active !== undefined) {
      query.is_active = is_active === 'true';
    }
    if (state && String(state).trim()) {
      query.state = String(state).trim();
    }
    if (q && String(q).trim()) {
      const search = String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: new RegExp('^' + search, 'i') },
        { state: new RegExp('^' + search, 'i') }
      ];
    }
    if (['pending', 'approved', 'declined'].includes(approvalStatus)) {
      query.approval_status = approvalStatus;
    }
    if (!isAdminRole(user)) {
      query.is_active = true;
      query.approval_status = 'approved';
    }

    const locations = await LocationMaster.find(query)
      .sort({ state: 1, name: 1 });
    res.json(locations);
  } catch (error) {
    console.error('Get location master error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch location master' });
  }
});

// Search locations by name (realtime) - case-insensitive, for duplicate check + suggestions
router.get('/search', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const { state, q, exclude_id } = req.query;
    if (!q || !String(q).trim()) {
      return res.status(400).json({ error: 'q is required' });
    }
    const stateTrim = state && String(state).trim() ? String(state).trim() : '';
    const searchName = normalizeUpper(q);
    const excludeId = exclude_id && String(exclude_id).trim() ? String(exclude_id).trim() : '';

    const exactQuery = {
      name: new RegExp('^' + escapeRegex(searchName) + '$', 'i'),
      is_active: true
    };
    if (!isAdminRole(user)) {
      exactQuery.approval_status = 'approved';
    }
    if (excludeId) {
      exactQuery._id = { $ne: excludeId };
    }
    const existing = await LocationMaster.findOne(exactQuery).sort({ state: 1, name: 1 });

    const suggestionQuery = {
      name: new RegExp(escapeRegex(searchName), 'i'),
      is_active: true
    };
    if (!isAdminRole(user)) {
      suggestionQuery.approval_status = 'approved';
    }
    if (excludeId) {
      suggestionQuery._id = { $ne: excludeId };
    }

    const matches = await LocationMaster.find(suggestionQuery)
      .sort({ state: 1, name: 1 })
      .limit(10);

    const existsInState = !!(existing && stateTrim && String(existing.state || '').trim() === stateTrim);

    res.json({
      exists: !!existing,
      location: existing ? existing.toJSON() : null,
      existsAnywhere: !!existing,
      existsInState,
      matches
    });
  } catch (error) {
    console.error('Location search error:', error);
    res.status(500).json({ error: error.message || 'Failed to search' });
  }
});

// Get location master by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const location = await LocationMaster.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    if (!isAdminRole(user) && (!location.is_active || location.approval_status !== 'approved')) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json(location);
  } catch (error) {
    console.error('Get location error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch location' });
  }
});

// Create location master (admin only) - duplicate check case-insensitive (global by location name)
router.post('/', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!isAdminRole(user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { state, name } = req.body;
    if (!state || !String(state).trim()) {
      return res.status(400).json({ error: 'State is required' });
    }
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Location name is required' });
    }

    const stateTrim = String(state).trim();
    const nameUpper = normalizeUpper(name);
    const existing = await LocationMaster.findOne({
      name: new RegExp('^' + escapeRegex(nameUpper) + '$', 'i'),
      is_active: true
    });
    if (existing) {
      return res.status(400).json({
        error: `Location "${nameUpper}" already exists in state "${String(existing.state || '').toUpperCase()}". Same location cannot be added in another state.`
      });
    }

    const location = new LocationMaster({
      state: stateTrim,
      name: nameUpper,
      submitted_by: req.userId,
      approval_status: 'pending'
    });
    await location.save();
    res.status(201).json(location);
  } catch (error) {
    console.error('Create location error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Location with this name already exists' });
    }
    res.status(500).json({ error: error.message || 'Failed to create location' });
  }
});

// Update location master (admin only) - cannot edit if already approved
router.put('/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!isAdminRole(user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const existing = await LocationMaster.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Location not found' });
    }
    if (existing.approval_status === 'approved' && user.role === 'admin') {
      return res.status(403).json({ error: 'Cannot edit after Super Admin approval' });
    }

    const { state, name } = req.body;
    if (state && String(state).trim() && name && String(name).trim()) {
      const nameUpper = normalizeUpper(name);
      const dup = await LocationMaster.findOne({
        name: new RegExp('^' + escapeRegex(nameUpper) + '$', 'i'),
        is_active: true,
        _id: { $ne: req.params.id }
      });
      if (dup) {
        return res.status(400).json({
          error: `Location "${nameUpper}" already exists in state "${String(dup.state || '').toUpperCase()}". Same location cannot be added in another state.`
        });
      }
    }

    const updatePayload = { ...req.body };
    if (typeof updatePayload.state === 'string') {
      updatePayload.state = updatePayload.state.trim();
    }
    if (typeof updatePayload.name === 'string') {
      updatePayload.name = normalizeUpper(updatePayload.name);
    }

    const approvalFields = ['approval_status', 'approved_by', 'approved_at', 'declined_reason'];
    const approvalUpdateRequested = approvalFields.some((field) =>
      Object.prototype.hasOwnProperty.call(updatePayload, field)
    );
    if (approvalUpdateRequested && !isSuperAdmin(user)) {
      return res.status(403).json({ error: 'Only Super Admin can approve or decline location' });
    }
    if (approvalUpdateRequested && isSuperAdmin(user) && existing.approval_status !== 'pending') {
      return res.status(400).json({
        error: 'Approval already decided. Ask Admin to re-submit before reviewing again.'
      });
    }

    if (!isSuperAdmin(user)) {
      updatePayload.submitted_by = req.userId;
      updatePayload.approval_status = 'pending';
      updatePayload.declined_reason = '';
      updatePayload.approved_by = null;
      updatePayload.approved_at = null;
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

    const location = await LocationMaster.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true, runValidators: true }
    );
    res.json(location);
  } catch (error) {
    console.error('Update location error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Location with this name already exists' });
    }
    res.status(500).json({ error: error.message || 'Failed to update location' });
  }
});

// Approve/decline location (super admin only)
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

    const location = await LocationMaster.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    if (location.approval_status !== 'pending') {
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

    const updatedLocation = await LocationMaster.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true, runValidators: true }
    );

    res.json(updatedLocation);
  } catch (error) {
    console.error('Location approval update error:', error);
    res.status(500).json({ error: error.message || 'Failed to update location approval' });
  }
});

// Delete location master
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!isAdminRole(user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const existing = await LocationMaster.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Super Admin: hard delete (permanent)
    if (isSuperAdmin(user)) {
      await LocationMaster.findByIdAndDelete(req.params.id);
      return res.json({ message: 'Location permanently deleted' });
    }

    // Admin: soft delete (only if not super-approved)
    if (existing.approval_status === 'approved' && user.role === 'admin') {
      return res.status(403).json({ error: 'Cannot deactivate after Super Admin approval' });
    }

    const location = await LocationMaster.findByIdAndUpdate(
      req.params.id,
      { is_active: false },
      { new: true }
    );

    res.json({ message: 'Location deactivated successfully', location });
  } catch (error) {
    console.error('Delete location error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete location' });
  }
});

export default router;
