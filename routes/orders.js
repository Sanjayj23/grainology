import express from 'express';
import Order from '../models/Order.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import SaleOrder from '../models/SaleOrder.js';
import Offer from '../models/Offer.js';
import User from '../models/User.js';
import { authenticate, isAdminRole } from '../middleware/auth.js';

const router = express.Router();

// Get all orders
router.get('/', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    let query = {};

    // Handle or condition from query params
    if (req.query.or) {
      // Parse Supabase-style or: "buyer_id.eq.userId,offer_id.in.(select...)"
      const orCondition = req.query.or;
      const userIdStr = req.userId.toString();
      
      // Check if user is buyer or seller
      const isBuyer = orCondition.includes(`buyer_id.eq.${userIdStr}`);
      const isSeller = orCondition.includes('offer_id.in') || orCondition.includes('seller_id');
      
      if (isBuyer || isSeller) {
        // Use $or to match either buyer_id or offer_id from user's offers
        const userOffers = await Offer.find({ seller_id: req.userId }).select('_id');
        const offerIds = userOffers.map(o => o._id);
        
        const orConditions = [];
        if (isBuyer) {
          orConditions.push({ buyer_id: req.userId });
        }
        if (isSeller && offerIds.length > 0) {
          orConditions.push({ offer_id: { $in: offerIds } });
        }
        
        if (orConditions.length > 0) {
          query = { $or: orConditions };
        } else {
          query = { _id: { $in: [] } }; // Return empty
        }
      }
    } else {
      // Non-admin users can only see their own orders
      if (!isAdminRole(user)) {
        // Get user's offers if farmer
        if (user.role === 'farmer') {
          const userOffers = await Offer.find({ seller_id: req.userId }).select('_id');
          const offerIds = userOffers.map(o => o._id);
          if (offerIds.length > 0) {
            query.offer_id = { $in: offerIds };
          } else {
            query.offer_id = { $in: [] };
          }
        } else {
          // For buyers, show their orders
          query.buyer_id = req.userId;
        }
      }
      // Admin sees all orders
    }

    // Get all order types
    const [tradeOrders, purchaseOrders, saleOrders] = await Promise.all([
      Order.find(query)
        .populate({
          path: 'offer_id',
          populate: {
            path: 'seller_id',
            select: 'name email'
          }
        })
        .populate('buyer_id', 'name email')
        .sort({ createdAt: -1 }),
      
      // Get purchase orders - admin sees all, customers see their own
      PurchaseOrder.find(isAdminRole(user) ? {} : { buyer_id: req.userId })
        .populate('buyer_id', 'name email mobile_number')
        .sort({ createdAt: -1 }),
      
      // Get sale orders - admin sees all, customers see their own
      SaleOrder.find(isAdminRole(user) ? {} : { seller_id: req.userId })
        .populate('seller_id', 'name email mobile_number')
        .sort({ createdAt: -1 })
    ]);

    // Transform trade orders
    const transformedTradeOrders = tradeOrders.map(order => {
      const orderObj = order.toJSON();
      return {
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
      };
    });

    // Transform purchase orders
    const transformedPurchaseOrders = purchaseOrders.map(order => {
      const orderObj = order.toJSON();
      return {
        ...orderObj,
        order_type: 'purchase',
        buyer: orderObj.buyer_id ? {
          name: orderObj.buyer_id.name,
          email: orderObj.buyer_id.email,
          mobile_number: orderObj.buyer_id.mobile_number
        } : null,
        customer_name: orderObj.buyer_id?.name || 'N/A'
      };
    });

    // Transform sale orders
    const transformedSaleOrders = saleOrders.map(order => {
      const orderObj = order.toJSON();
      return {
        ...orderObj,
        order_type: 'sale',
        seller: orderObj.seller_id ? {
          name: orderObj.seller_id.name,
          email: orderObj.seller_id.email,
          mobile_number: orderObj.seller_id.mobile_number
        } : null,
        customer_name: orderObj.seller_id?.name || 'N/A'
      };
    });

    // Combine all orders and sort by creation date
    const allOrders = [
      ...transformedTradeOrders,
      ...transformedPurchaseOrders,
      ...transformedSaleOrders
    ].sort((a, b) => new Date(b.created_at || b.createdAt).getTime() - new Date(a.created_at || a.createdAt).getTime());

    res.json(allOrders);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch orders' });
  }
});

// Get order by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate({
        path: 'offer_id',
        populate: {
          path: 'seller_id',
          select: 'name email'
        }
      })
      .populate('buyer_id', 'name email');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderObj = order.toJSON();
    res.json({
      ...orderObj,
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
    console.error('Get order error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch order' });
  }
});

// Create order
router.post('/', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.kyc_status !== 'verified') {
      return res.status(400).json({ error: 'Please complete KYC verification before placing orders' });
    }

    const { offer_id, quantity_mt, final_price_per_quintal } = req.body;

    // Get the offer to copy the sauda date if it exists
    const offer = await Offer.findById(offer_id);
    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    const order = new Order({
      offer_id,
      buyer_id: req.userId,
      quantity_mt,
      final_price_per_quintal,
      status: 'Pending Approval',
      deduction_amount: 0,
      sauda_confirmation_date: offer.sauda_confirmation_date
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
    console.error('Create order error:', error);
    res.status(500).json({ error: error.message || 'Failed to create order' });
  }
});

// Update order status (admin only)
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!isAdminRole(user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true, runValidators: true }
    )
      .populate({
        path: 'offer_id',
        populate: {
          path: 'seller_id',
          select: 'name email'
        }
      })
      .populate('buyer_id', 'name email');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderObj = order.toJSON();
    res.json({
      ...orderObj,
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
    console.error('Update order status error:', error);
    res.status(500).json({ error: error.message || 'Failed to update order status' });
  }
});

// Finalize order (admin only)
router.put('/:id/finalize', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!isAdminRole(user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { deduction_amount } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { 
        $set: { 
          deduction_amount: deduction_amount || 0,
          status: 'Completed'
        }
      },
      { new: true, runValidators: true }
    )
      .populate({
        path: 'offer_id',
        populate: {
          path: 'seller_id',
          select: 'name email'
        }
      })
      .populate('buyer_id', 'name email');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderObj = order.toJSON();
    res.json({
      ...orderObj,
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
    console.error('Finalize order error:', error);
    res.status(500).json({ error: error.message || 'Failed to finalize order' });
  }
});

export default router;

