import express from 'express';
import SupplyTransaction from '../models/SupplyTransaction.js';
import User from '../models/User.js';
import { authenticate, isAdminRole } from '../middleware/auth.js';

const router = express.Router();

// Get all supply transactions
router.get('/', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const {
      supplier_name,
      commodity,
      state,
      warehouse_name,
      date_from,
      date_to,
      sort_by = 'transaction_date',
      sort_order = 'desc',
      page = 1,
      limit = 50
    } = req.query;

    const query = {};

    // Admin sees all, users see all (for demo purposes, can be restricted later)
    if (supplier_name) {
      query.supplier_name = new RegExp(supplier_name, 'i');
    }
    if (commodity) {
      query.commodity = commodity;
    }
    if (state) {
      query.state = state;
    }
    if (warehouse_name) {
      query.warehouse_name = new RegExp(warehouse_name, 'i');
    }
    if (date_from || date_to) {
      query.transaction_date = {};
      if (date_from) {
        query.transaction_date.$gte = new Date(date_from);
      }
      if (date_to) {
        query.transaction_date.$lte = new Date(date_to);
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sort_by]: sort_order === 'asc' ? 1 : -1 };

    const [transactions, total] = await Promise.all([
      SupplyTransaction.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      SupplyTransaction.countDocuments(query)
    ]);

    // Calculate summary statistics
    const stats = await SupplyTransaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalNetAmount: { $sum: '$net_amount' },
          totalNetWeight: { $sum: '$net_weight_mt' },
          totalBags: { $sum: '$no_of_bags' },
          avgRate: { $avg: '$rate_per_mt' }
        }
      }
    ]);

    const summary = stats[0] || {
      totalTransactions: 0,
      totalNetAmount: 0,
      totalNetWeight: 0,
      totalBags: 0,
      avgRate: 0
    };

    res.json({
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      summary
    });
  } catch (error) {
    console.error('Get supply transactions error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch supply transactions' });
  }
});

// Get supply transaction by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const transaction = await SupplyTransaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json(transaction);
  } catch (error) {
    console.error('Get supply transaction error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch transaction' });
  }
});

// Get statistics grouped by different criteria
router.get('/stats/by-supplier', authenticate, async (req, res) => {
  try {
    const stats = await SupplyTransaction.aggregate([
      {
        $group: {
          _id: '$supplier_name',
          count: { $sum: 1 },
          totalNetAmount: { $sum: '$net_amount' },
          totalNetWeight: { $sum: '$net_weight_mt' },
          totalBags: { $sum: '$no_of_bags' },
          avgRate: { $avg: '$rate_per_mt' }
        }
      },
      { $sort: { totalNetAmount: -1 } }
    ]);

    res.json(stats.map(s => ({
      supplier_name: s._id,
      ...s
    })));
  } catch (error) {
    console.error('Get supplier stats error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch statistics' });
  }
});

router.get('/stats/by-commodity', authenticate, async (req, res) => {
  try {
    const stats = await SupplyTransaction.aggregate([
      {
        $group: {
          _id: { commodity: '$commodity', variety: '$variety' },
          count: { $sum: 1 },
          totalNetAmount: { $sum: '$net_amount' },
          totalNetWeight: { $sum: '$net_weight_mt' },
          totalBags: { $sum: '$no_of_bags' },
          avgRate: { $avg: '$rate_per_mt' }
        }
      },
      { $sort: { totalNetAmount: -1 } }
    ]);

    res.json(stats.map(s => ({
      commodity: s._id.commodity,
      variety: s._id.variety,
      ...s
    })));
  } catch (error) {
    console.error('Get commodity stats error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch statistics' });
  }
});

router.get('/stats/by-warehouse', authenticate, async (req, res) => {
  try {
    const stats = await SupplyTransaction.aggregate([
      {
        $group: {
          _id: { warehouse: '$warehouse_name', location: '$location' },
          count: { $sum: 1 },
          totalNetAmount: { $sum: '$net_amount' },
          totalNetWeight: { $sum: '$net_weight_mt' },
          totalBags: { $sum: '$no_of_bags' }
        }
      },
      { $sort: { totalNetAmount: -1 } }
    ]);

    res.json(stats.map(s => ({
      warehouse_name: s._id.warehouse,
      location: s._id.location,
      ...s
    })));
  } catch (error) {
    console.error('Get warehouse stats error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch statistics' });
  }
});

// Create supply transaction
router.post('/', authenticate, async (req, res) => {
  try {
    const transaction = new SupplyTransaction({
      ...req.body,
      created_by: req.userId
    });
    await transaction.save();
    res.status(201).json(transaction);
  } catch (error) {
    console.error('Create supply transaction error:', error);
    res.status(500).json({ error: error.message || 'Failed to create transaction' });
  }
});

// Update supply transaction
router.put('/:id', authenticate, async (req, res) => {
  try {
    const transaction = await SupplyTransaction.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(transaction);
  } catch (error) {
    console.error('Update supply transaction error:', error);
    res.status(500).json({ error: error.message || 'Failed to update transaction' });
  }
});

// Delete supply transaction
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!isAdminRole(user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const transaction = await SupplyTransaction.findByIdAndDelete(req.params.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Delete supply transaction error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete transaction' });
  }
});

export default router;

