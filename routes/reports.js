import express from 'express';
import Report from '../models/Report.js';
import { authenticate, isAdminRole } from '../middleware/auth.js';

const router = express.Router();

// Get all reports
router.get('/', authenticate, async (req, res) => {
  try {
    const { report_type, generated_by } = req.query;
    const query = {};

    if (report_type) query.report_type = report_type;
    if (generated_by) query.generated_by = generated_by;

    const reports = await Report.find(query)
      .populate('generated_by', 'name email')
      .sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch reports' });
  }
});

// Get report by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id).populate('generated_by', 'name email');
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json(report);
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch report' });
  }
});

// Create report
router.post('/', authenticate, async (req, res) => {
  try {
    const report = new Report({
      ...req.body,
      generated_by: req.userId
    });
    await report.save();
    await report.populate('generated_by', 'name email');
    res.status(201).json(report);
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ error: error.message || 'Failed to create report' });
  }
});

// Delete report
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Only creator or admin can delete
    if (report.generated_by.toString() !== req.userId && !isAdminRole(req.user)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await Report.findByIdAndDelete(req.params.id);
    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete report' });
  }
});

export default router;

