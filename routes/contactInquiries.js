import express from 'express';
import ContactInquiry from '../models/ContactInquiry.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const payload = {
      name: String(req.body?.name || '').trim(),
      email: String(req.body?.email || '').trim(),
      phone: String(req.body?.phone || '').trim(),
      subject: String(req.body?.subject || '').trim(),
      message: String(req.body?.message || '').trim()
    };

    if (!payload.name || !payload.email || !payload.subject || !payload.message) {
      return res.status(400).json({ error: 'Name, email, subject, and message are required.' });
    }

    const inquiry = await ContactInquiry.create(payload);
    res.status(201).json(inquiry);
  } catch (error) {
    console.error('Create contact inquiry error:', error);
    res.status(500).json({ error: error.message || 'Failed to submit contact inquiry' });
  }
});

router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const inquiries = await ContactInquiry.find({}).sort({ createdAt: -1 }).lean();
    const normalized = inquiries.map((inquiry) => ({
      ...inquiry,
      id: inquiry._id.toString(),
      created_at: inquiry.createdAt,
      updated_at: inquiry.updatedAt
    }));

    normalized.forEach((inquiry) => {
      delete inquiry._id;
      delete inquiry.__v;
      delete inquiry.createdAt;
      delete inquiry.updatedAt;
    });

    res.json(normalized);
  } catch (error) {
    console.error('Get contact inquiries error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch contact inquiries' });
  }
});

export default router;
