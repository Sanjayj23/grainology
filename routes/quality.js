import express from 'express';
import QualityParameter from '../models/QualityParameter.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all quality parameters
router.get('/', authenticate, async (req, res) => {
  try {
    const { commodity } = req.query;
    const query = {};
    
    if (commodity) {
      query.commodity = commodity;
    }

    const parameters = await QualityParameter.find(query).sort({ commodity: 1, param_name: 1 });
    res.json(parameters);
  } catch (error) {
    console.error('Get quality parameters error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch quality parameters' });
  }
});

// Get quality parameter by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const parameter = await QualityParameter.findById(req.params.id);
    if (!parameter) {
      return res.status(404).json({ error: 'Quality parameter not found' });
    }
    res.json(parameter);
  } catch (error) {
    console.error('Get quality parameter error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch quality parameter' });
  }
});

// Create quality parameter (admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const parameter = new QualityParameter(req.body);
    await parameter.save();
    res.status(201).json(parameter);
  } catch (error) {
    console.error('Create quality parameter error:', error);
    res.status(500).json({ error: error.message || 'Failed to create quality parameter' });
  }
});

// Update quality parameter (admin only)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const parameter = await QualityParameter.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!parameter) {
      return res.status(404).json({ error: 'Quality parameter not found' });
    }

    res.json(parameter);
  } catch (error) {
    console.error('Update quality parameter error:', error);
    res.status(500).json({ error: error.message || 'Failed to update quality parameter' });
  }
});

// Delete quality parameter (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const parameter = await QualityParameter.findByIdAndDelete(req.params.id);
    if (!parameter) {
      return res.status(404).json({ error: 'Quality parameter not found' });
    }
    res.json({ message: 'Quality parameter deleted successfully' });
  } catch (error) {
    console.error('Delete quality parameter error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete quality parameter' });
  }
});

export default router;

