import express from 'express';
import LogisticsProvider from '../models/LogisticsProvider.js';
import LogisticsLocationMaster from '../models/LogisticsLocationMaster.js';
import User from '../models/User.js';
import { authenticate, isAdminRole } from '../middleware/auth.js';

const router = express.Router();
const normalizeText = (value) => String(value || '').trim();
const normalizeKeyPart = (value) => normalizeText(value).toUpperCase();

const normalizeProviderPayload = (input = {}) => ({
  company_name: normalizeText(input.company_name),
  mobile_number: normalizeText(input.mobile_number),
  email: normalizeText(input.email),
  address: normalizeText(input.address),
  district: normalizeText(input.district),
  state: normalizeText(input.state),
  country: normalizeText(input.country || 'India'),
  pincode: normalizeText(input.pincode),
  is_active: input.is_active !== undefined ? Boolean(input.is_active) : true
});

const normalizeLocationPayload = (input = {}) => ({
  district: normalizeText(input.district),
  state: normalizeText(input.state),
  country: normalizeText(input.country),
  pincode: normalizeText(input.pincode)
});

const hasLocationValues = (location = {}) =>
  [location.district, location.state, location.country, location.pincode].some(Boolean);

const buildLocationKey = (location = {}) => [
  normalizeKeyPart(location.district),
  normalizeKeyPart(location.state),
  normalizeKeyPart(location.country),
  normalizeKeyPart(location.pincode)
].join('||');

const persistLogisticsLocationMasters = async (providersInput) => {
  const providers = Array.isArray(providersInput) ? providersInput : [providersInput];
  const now = new Date();
  const records = new Map();

  providers.forEach((provider) => {
    const location = normalizeLocationPayload(provider);
    if (!hasLocationValues(location)) return;

    const key = buildLocationKey(location);
    if (!key || records.has(key)) return;

    records.set(key, {
      key,
      ...location,
      is_active: true,
      last_seen_at: now
    });
  });

  if (!records.size) return;

  await LogisticsLocationMaster.bulkWrite(
    Array.from(records.values()).map((record) => ({
      updateOne: {
        filter: { key: record.key },
        update: { $set: record },
        upsert: true
      }
    }))
  );
};

const syncLocationMasterFromProviders = async () => {
  const providers = await LogisticsProvider.find({
    $or: [
      { district: { $exists: true, $ne: '' } },
      { state: { $exists: true, $ne: '' } },
      { country: { $exists: true, $ne: '' } },
      { pincode: { $exists: true, $ne: '' } }
    ]
  })
    .select('district state country pincode')
    .lean();

  if (!providers.length) return;
  await persistLogisticsLocationMasters(providers);
};

// Get all logistics providers
router.get('/', async (req, res) => {
  try {
    const { is_active, pickup_city, delivery_city, id, company_name, district, state, country, pincode } = req.query;
    const query = {};

    if (id) query._id = id;
    if (is_active !== undefined) query.is_active = is_active === 'true';
    if (pickup_city) query.pickup_city = pickup_city;
    if (delivery_city) query.delivery_city = delivery_city;
    if (company_name) query.company_name = new RegExp(company_name, 'i');
    if (district) query.district = new RegExp(String(district), 'i');
    if (state) query.state = new RegExp(String(state), 'i');
    if (country) query.country = new RegExp(String(country), 'i');
    if (pincode) query.pincode = new RegExp(String(pincode), 'i');

    const providers = await LogisticsProvider.find(query).sort({ company_name: 1 });
    res.json(providers);
  } catch (error) {
    console.error('Get logistics providers error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch logistics providers' });
  }
});

router.get('/filter-options', async (req, res) => {
  try {
    await syncLocationMasterFromProviders();

    const locations = await LogisticsLocationMaster.find({ is_active: true })
      .select('district state country pincode')
      .sort({ district: 1, state: 1, country: 1, pincode: 1 })
      .lean();

    const uniqueOptions = (field) => (
      Array.from(
        new Set(
          locations
            .map((location) => normalizeText(location[field]))
            .filter(Boolean)
        )
      ).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
    );

    res.json({
      combinations: locations.map((location) => ({
        district: normalizeText(location.district),
        state: normalizeText(location.state),
        country: normalizeText(location.country),
        pincode: normalizeText(location.pincode)
      })),
      districts: uniqueOptions('district'),
      states: uniqueOptions('state'),
      countries: uniqueOptions('country'),
      pincodes: uniqueOptions('pincode')
    });
  } catch (error) {
    console.error('Get logistics filter options error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch logistics filter options' });
  }
});

// Get logistics provider by ID
router.get('/:id', async (req, res) => {
  try {
    const provider = await LogisticsProvider.findById(req.params.id);
    if (!provider) {
      return res.status(404).json({ error: 'Logistics provider not found' });
    }
    res.json(provider);
  } catch (error) {
    console.error('Get logistics provider error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch logistics provider' });
  }
});

// Create logistics provider (admin only)
router.post('/', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!isAdminRole(user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const body = normalizeProviderPayload(Array.isArray(req.body) ? req.body[0] : req.body);
    const provider = new LogisticsProvider(body);
    await provider.save();
    await persistLogisticsLocationMasters(provider.toObject());
    res.status(201).json(provider);
  } catch (error) {
    console.error('Create logistics provider error:', error);
    res.status(500).json({ error: error.message || 'Failed to create logistics provider' });
  }
});

// Update logistics provider (admin only)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!isAdminRole(user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const provider = await LogisticsProvider.findByIdAndUpdate(
      req.params.id,
      { $set: normalizeProviderPayload(req.body) },
      { new: true, runValidators: true }
    );

    if (!provider) {
      return res.status(404).json({ error: 'Logistics provider not found' });
    }

    await persistLogisticsLocationMasters(provider.toObject());
    res.json(provider);
  } catch (error) {
    console.error('Update logistics provider error:', error);
    res.status(500).json({ error: error.message || 'Failed to update logistics provider' });
  }
});

// Delete logistics provider (admin only)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!isAdminRole(user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const provider = await LogisticsProvider.findByIdAndDelete(req.params.id);
    if (!provider) {
      return res.status(404).json({ error: 'Logistics provider not found' });
    }
    res.json({ message: 'Logistics provider deleted successfully' });
  } catch (error) {
    console.error('Delete logistics provider error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete logistics provider' });
  }
});

export default router;
