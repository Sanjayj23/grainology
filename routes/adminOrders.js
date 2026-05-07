// Admin POS - Create orders for customers
import express from 'express';
import Order from '../models/Order.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import SaleOrder from '../models/SaleOrder.js';
import User from '../models/User.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// All routes require admin
router.use(authenticate);
router.use(requireAdmin);

// Create trade order for customer (POS)
router.post('/trade-order', async (req, res) => {
  try {
    const { buyer_id, offer_id, quantity_mt, final_price_per_quintal } = req.body;

    if (!buyer_id || !offer_id) {
      return res.status(400).json({ error: 'buyer_id and offer_id are required' });
    }

    const buyer = await User.findById(buyer_id);
    if (!buyer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const order = new Order({
      offer_id,
      buyer_id,
      quantity_mt,
      final_price_per_quintal,
      status: 'Pending Approval',
      deduction_amount: 0
    });

    await order.save();
    await order.populate({
      path: 'offer_id',
      populate: {
        path: 'seller_id',
        select: 'name email'
      }
    });
    await order.populate('buyer_id', 'name email');

    const orderObj = order.toJSON();
    res.status(201).json({
      ...orderObj,
      order_type: 'trade',
      offer: orderObj.offer_id ? {
        ...orderObj.offer_id,
        seller: orderObj.offer_id.seller_id ? {
          name: orderObj.offer_id.seller_id.name
        } : null
      } : null,
      buyer: orderObj.buyer_id ? {
        name: orderObj.buyer_id.name
      } : null
    });
  } catch (error) {
    console.error('Create trade order error:', error);
    res.status(500).json({ error: error.message || 'Failed to create trade order' });
  }
});

// Create purchase order for customer (POS)
router.post('/purchase-order', async (req, res) => {
  try {
    const { buyer_id, ...orderData } = req.body;

    if (!buyer_id) {
      return res.status(400).json({ error: 'buyer_id is required' });
    }

    const buyer = await User.findById(buyer_id);
    if (!buyer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const order = new PurchaseOrder({
      ...orderData,
      buyer_id
    });
    await order.save();
    await order.populate('buyer_id', 'name email mobile_number');
    
    const orderObj = order.toJSON();
    res.status(201).json({
      ...orderObj,
      order_type: 'purchase',
      buyer: orderObj.buyer_id ? {
        name: orderObj.buyer_id.name,
        email: orderObj.buyer_id.email,
        mobile_number: orderObj.buyer_id.mobile_number
      } : null,
      customer_name: orderObj.buyer_id?.name || 'N/A'
    });
  } catch (error) {
    console.error('Create purchase order error:', error);
    res.status(500).json({ error: error.message || 'Failed to create purchase order' });
  }
});

// Create sale order for customer (POS)
router.post('/sale-order', async (req, res) => {
  try {
    const { seller_id, ...orderData } = req.body;

    if (!seller_id) {
      return res.status(400).json({ error: 'seller_id is required' });
    }

    const seller = await User.findById(seller_id);
    if (!seller) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const order = new SaleOrder({
      ...orderData,
      seller_id
    });
    await order.save();
    await order.populate('seller_id', 'name email mobile_number');
    
    const orderObj = order.toJSON();
    res.status(201).json({
      ...orderObj,
      order_type: 'sale',
      seller: orderObj.seller_id ? {
        name: orderObj.seller_id.name,
        email: orderObj.seller_id.email,
        mobile_number: orderObj.seller_id.mobile_number
      } : null,
      customer_name: orderObj.seller_id?.name || 'N/A'
    });
  } catch (error) {
    console.error('Create sale order error:', error);
    res.status(500).json({ error: error.message || 'Failed to create sale order' });
  }
});

// Get all customers for POS selection
router.get('/customers', async (req, res) => {
  try {
    const customers = await User.find({
      role: { $in: ['farmer', 'trader', 'fpo', 'corporate', 'miller', 'financer'] }
    })
      .select('id name email mobile_number role')
      .sort({ name: 1 });
    
    res.json(customers);
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch customers' });
  }
});

export default router;

