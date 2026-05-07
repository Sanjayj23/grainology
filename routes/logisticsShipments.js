import express from 'express';
import LogisticsShipment from '../models/LogisticsShipment.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get all logistics shipments
router.get('/', authenticate, async (req, res) => {
  try {
    const { order_id, status } = req.query;
    const query = {};

    if (order_id) query.order_id = order_id;
    if (status) query.status = status;

    const shipments = await LogisticsShipment.find(query)
      .populate('order_id')
      .sort({ createdAt: -1 });
    res.json(shipments);
  } catch (error) {
    console.error('Get logistics shipments error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch logistics shipments' });
  }
});

// Get logistics shipment by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const shipment = await LogisticsShipment.findById(req.params.id)
      .populate('order_id');
    if (!shipment) {
      return res.status(404).json({ error: 'Logistics shipment not found' });
    }
    res.json(shipment);
  } catch (error) {
    console.error('Get logistics shipment error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch logistics shipment' });
  }
});

// Create logistics shipment
router.post('/', authenticate, async (req, res) => {
  try {
    const shipment = new LogisticsShipment(req.body);
    await shipment.save();
    await shipment.populate('order_id');
    res.status(201).json(shipment);
  } catch (error) {
    console.error('Create logistics shipment error:', error);
    res.status(500).json({ error: error.message || 'Failed to create logistics shipment' });
  }
});

// Update logistics shipment
router.put('/:id', authenticate, async (req, res) => {
  try {
    const shipment = await LogisticsShipment.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate('order_id');

    if (!shipment) {
      return res.status(404).json({ error: 'Logistics shipment not found' });
    }

    res.json(shipment);
  } catch (error) {
    console.error('Update logistics shipment error:', error);
    res.status(500).json({ error: error.message || 'Failed to update logistics shipment' });
  }
});

// Delete logistics shipment
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const shipment = await LogisticsShipment.findByIdAndDelete(req.params.id);
    if (!shipment) {
      return res.status(404).json({ error: 'Logistics shipment not found' });
    }
    res.json({ message: 'Logistics shipment deleted successfully' });
  } catch (error) {
    console.error('Delete logistics shipment error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete logistics shipment' });
  }
});

export default router;

