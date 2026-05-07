import express from 'express';
import User from '../models/User.js';
import { authenticate, isAdminRole } from '../middleware/auth.js';

const router = express.Router();

// Get all profiles (admin only)
router.get('/', authenticate, async (req, res) => {
  try {
    const profiles = await User.find({}).sort({ createdAt: -1 });
    res.json(profiles);
  } catch (error) {
    console.error('Get profiles error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch profiles' });
  }
});

// Get profile by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const profile = await User.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json(profile);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch profile' });
  }
});

// Get current user's profile
router.get('/me/current', authenticate, async (req, res) => {
  try {
    const profile = await User.findById(req.userId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json(profile);
  } catch (error) {
    console.error('Get current profile error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch profile' });
  }
});

// Update profile
router.put('/:id', authenticate, async (req, res) => {
  try {
    // Users can only update their own profile unless admin
    if (req.params.id !== req.userId && !isAdminRole(req.user)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updatedProfile = await User.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updatedProfile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(updatedProfile);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: error.message || 'Failed to update profile' });
  }
});

export default router;

