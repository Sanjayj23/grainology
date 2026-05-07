import express from 'express';
import PurchaseOrder from '../models/PurchaseOrder.js';
import User from '../models/User.js';
import { authenticate, isAdminRole } from '../middleware/auth.js';

const router = express.Router();

// Get all purchase orders
router.get('/', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const query = {};

    // Non-admin users can only see their own orders
    if (!isAdminRole(user)) {
      query.buyer_id = req.userId;
    }

    const orders = await PurchaseOrder.find(query)
      .populate('buyer_id', 'name email')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Get purchase orders error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch purchase orders' });
  }
});

// Get purchase order by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const order = await PurchaseOrder.findById(req.params.id).populate('buyer_id', 'name email');
    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    res.json(order);
  } catch (error) {
    console.error('Get purchase order error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch purchase order' });
  }
});

// Create purchase order (admin can create for any customer, customers create for themselves)
router.post('/', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const { buyer_id, ...orderData } = req.body;
    
    // Admin can specify buyer_id, customers can only create for themselves
    const targetBuyerId = isAdminRole(user) && buyer_id ? buyer_id : req.userId;
    
    const order = new PurchaseOrder({
      ...orderData,
      buyer_id: targetBuyerId
    });
    await order.save();
    await order.populate('buyer_id', 'name email mobile_number');
    res.status(201).json(order);
  } catch (error) {
    console.error('Create purchase order error:', error);
    res.status(500).json({ error: error.message || 'Failed to create purchase order' });
  }
});

// Update purchase order
router.put('/:id', authenticate, async (req, res) => {
  try {
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    const user = await User.findById(req.userId);
    // Only buyer or admin/super_admin can update
    if (order.buyer_id.toString() !== req.userId && !isAdminRole(user)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updatedOrder = await PurchaseOrder.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate('buyer_id', 'name email');

    res.json(updatedOrder);
  } catch (error) {
    console.error('Update purchase order error:', error);
    res.status(500).json({ error: error.message || 'Failed to update purchase order' });
  }
});

export default router;
