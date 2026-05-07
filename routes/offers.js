import express from 'express';
import Offer from '../models/Offer.js';
import User from '../models/User.js';
import { authenticate, isAdminRole } from '../middleware/auth.js';

const router = express.Router();

// Get all offers
router.get('/', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const { status } = req.query;
    const query = {};
    
    if (status) {
      query.status = status;
    }

    // Non-admin users see only Active offers or their own offers
    if (!isAdminRole(user)) {
      query.$or = [
        { status: 'Active' },
        { seller_id: req.userId }
      ];
    }

    const offers = await Offer.find(query)
      .populate('seller_id', 'name email')
      .sort({ createdAt: -1 });

    // Transform to match frontend expectations
    const transformedOffers = offers.map(offer => {
      const offerObj = offer.toJSON();
      return {
        ...offerObj,
        seller: offerObj.seller_id ? {
          name: offerObj.seller_id.name
        } : null
      };
    });

    res.json(transformedOffers);
  } catch (error) {
    console.error('Get offers error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch offers' });
  }
});

// Get offer by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id)
      .populate('seller_id', 'name email');

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    const offerObj = offer.toJSON();
    res.json({
      ...offerObj,
      seller: offerObj.seller_id ? {
        name: offerObj.seller_id.name
      } : null
    });
  } catch (error) {
    console.error('Get offer error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch offer' });
  }
});

// Create offer
router.post('/', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.kyc_status !== 'verified') {
      return res.status(400).json({ error: 'Please complete KYC verification before creating offers' });
    }

    const offer = new Offer({
      ...req.body,
      seller_id: req.userId
    });

    await offer.save();
    await offer.populate('seller_id', 'name email');

    const offerObj = offer.toJSON();
    res.status(201).json({
      ...offerObj,
      seller: offerObj.seller_id ? {
        name: offerObj.seller_id.name
      } : null
    });
  } catch (error) {
    console.error('Create offer error:', error);
    res.status(500).json({ error: error.message || 'Failed to create offer' });
  }
});

// Update offer
router.put('/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    // Only seller or admin can update
    if (offer.seller_id.toString() !== req.userId && !isAdminRole(user)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updatedOffer = await Offer.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate('seller_id', 'name email');

    const offerObj = updatedOffer.toJSON();
    res.json({
      ...offerObj,
      seller: offerObj.seller_id ? {
        name: offerObj.seller_id.name
      } : null
    });
  } catch (error) {
    console.error('Update offer error:', error);
    res.status(500).json({ error: error.message || 'Failed to update offer' });
  }
});

// Delete offer
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    // Only seller or admin can delete
    if (offer.seller_id.toString() !== req.userId && !isAdminRole(user)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await Offer.findByIdAndDelete(req.params.id);
    res.json({ message: 'Offer deleted successfully' });
  } catch (error) {
    console.error('Delete offer error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete offer' });
  }
});

export default router;

