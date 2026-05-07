import express from 'express';
import SiteSettings from '../models/SiteSettings.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

const DEFAULT_SETTINGS = {
  key: 'global',
  contactDetails: [
    { key: 'email', title: 'Email', lines: ['support@grainology.com', 'info@grainology.com'] },
    { key: 'phone', title: 'Phone', lines: ['+91 1800-XXX-XXXX', '+91 1800-XXX-XXXX (Toll Free)'] },
    { key: 'address', title: 'Address', lines: ['India'] }
  ],
  businessHours: {
    heading: 'Business hours',
    primary: 'Monday to Friday: 9:00 AM to 6:00 PM',
    secondary: 'Saturday: 10:00 AM to 4:00 PM'
  },
  homepageStats: [
    {
      value: 50,
      prefix: '',
      suffix: 'K+',
      label: 'Active Users',
      text: 'A growing network of platform participants uses Grainology for trade discovery, workflows, and operations.'
    },
    {
      value: 500,
      prefix: '₹',
      suffix: 'Cr+',
      label: 'Trade Volume',
      text: 'Trade activity across the platform reflects large-scale commodity movement and recurring business usage.'
    },
    {
      value: 1000,
      prefix: '',
      suffix: '+',
      label: 'Cities Covered',
      text: 'Users can engage with Grainology across a wide geographic footprint spanning multiple agricultural markets.'
    },
    {
      value: 24,
      prefix: '',
      suffix: '/7',
      label: 'Support',
      text: 'Teams can rely on continuous assistance for platform operations, onboarding, and issue resolution.'
    }
  ]
};

function cleanLines(lines = []) {
  return lines
    .map((line) => String(line || '').trim())
    .filter(Boolean);
}

function normalizeStats(stats = []) {
  return stats.slice(0, 4).map((stat, index) => ({
    value: Number(stat?.value) || 0,
    prefix: String(stat?.prefix || ''),
    suffix: String(stat?.suffix || ''),
    label: String(stat?.label || `Stat ${index + 1}`).trim(),
    text: String(stat?.text || '').trim()
  }));
}

function normalizeContactDetails(contactDetails = []) {
  return contactDetails.slice(0, 3).map((item, index) => ({
    key: String(item?.key || ['email', 'phone', 'address'][index] || `item-${index + 1}`),
    title: String(item?.title || `Item ${index + 1}`).trim(),
    lines: cleanLines(item?.lines)
  }));
}

async function getOrCreateSettings() {
  const existing = await SiteSettings.findOne({ key: 'global' });
  if (existing) return existing;
  return SiteSettings.create(DEFAULT_SETTINGS);
}

router.get('/', async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.json(settings);
  } catch (error) {
    console.error('Get site settings error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch site settings' });
  }
});

router.put('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const payload = {
      contactDetails: normalizeContactDetails(req.body?.contactDetails),
      businessHours: {
        heading: String(req.body?.businessHours?.heading || DEFAULT_SETTINGS.businessHours.heading).trim(),
        primary: String(req.body?.businessHours?.primary || DEFAULT_SETTINGS.businessHours.primary).trim(),
        secondary: String(req.body?.businessHours?.secondary || DEFAULT_SETTINGS.businessHours.secondary).trim()
      },
      homepageStats: normalizeStats(req.body?.homepageStats)
    };

    if (payload.contactDetails.length === 0 || payload.homepageStats.length === 0) {
      return res.status(400).json({ error: 'Contact details and homepage stats are required.' });
    }

    const settings = await SiteSettings.findOneAndUpdate(
      { key: 'global' },
      { $set: payload, $setOnInsert: { key: 'global' } },
      { new: true, upsert: true, runValidators: true }
    );

    res.json(settings);
  } catch (error) {
    console.error('Update site settings error:', error);
    res.status(500).json({ error: error.message || 'Failed to update site settings' });
  }
});

export default router;
