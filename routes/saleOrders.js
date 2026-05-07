import express from 'express';
import SaleOrder from '../models/SaleOrder.js';
import User from '../models/User.js';
import { authenticate, isAdminRole } from '../middleware/auth.js';

const router = express.Router();

// Get all sale orders
router.get('/', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const query = {};

    // Non-admin users can only see their own orders
    if (!isAdminRole(user)) {
      query.seller_id = req.userId;
    }

    const orders = await SaleOrder.find(query)
      .populate('seller_id', 'name email')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Get sale orders error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch sale orders' });
  }
});

// Get sale order by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const order = await SaleOrder.findById(req.params.id).populate('seller_id', 'name email');
    if (!order) {
      return res.status(404).json({ error: 'Sale order not found' });
    }
    res.json(order);
  } catch (error) {
    console.error('Get sale order error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch sale order' });
  }
});

// Create sale order (admin can create for any customer, customers create for themselves)
router.post('/', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const { seller_id, ...orderData } = req.body;
    
    // Admin can specify seller_id, customers can only create for themselves
    const targetSellerId = isAdminRole(user) && seller_id ? seller_id : req.userId;
    
    const order = new SaleOrder({
      ...orderData,
      seller_id: targetSellerId
    });
    await order.save();
    await order.populate('seller_id', 'name email mobile_number');
    res.status(201).json(order);
  } catch (error) {
    console.error('Create sale order error:', error);
    res.status(500).json({ error: error.message || 'Failed to create sale order' });
  }
});

// Update sale order
router.put('/:id', authenticate, async (req, res) => {
  try {
    const order = await SaleOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Sale order not found' });
    }

    const user = await User.findById(req.userId);
    // Only seller or admin/super_admin can update
    if (order.seller_id.toString() !== req.userId && !isAdminRole(user)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updatedOrder = await SaleOrder.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate('seller_id', 'name email');

    res.json(updatedOrder);
  } catch (error) {
    console.error('Update sale order error:', error);
    res.status(500).json({ error: error.message || 'Failed to update sale order' });
  }
});

export default router;
