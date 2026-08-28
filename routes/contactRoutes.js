import express from 'express';
import Newsletter from '../models-sql/Newsletter.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { serializeNewsletter } from '../utils/serializers.js';

const router = express.Router();

// In-memory store for contact messages
let messages = [];

// ── POST /api/contact  Submit contact form
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name || !email || !message)
      return res.status(400).json({ message: 'Name, email and message are required' });

    const entry = {
      _id: `msg_${Date.now()}`,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone || '',
      subject: subject || 'General Enquiry',
      message: message.trim(),
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    messages.unshift(entry);
    if (messages.length > 200) messages = messages.slice(0, 200);
    res.status(201).json({ success: true, message: "Message received! We'll reply within 24 hours." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/contact  Admin: get all messages
router.get('/', protect, admin, async (req, res) => {
  res.json({ messages, total: messages.length });
});

// ── PATCH /api/contact/:id/read  Admin: mark as read
router.patch('/:id/read', protect, admin, async (req, res) => {
  const msg = messages.find(m => m._id === req.params.id);
  if (!msg) return res.status(404).json({ message: 'Message not found' });
  msg.isRead = true;
  res.json(msg);
});

// ── POST /api/contact/newsletter  Subscribe to newsletter
router.post('/newsletter', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const normalizedEmail = email.toLowerCase().trim();

    const [, created] = await Newsletter.findOrCreate({
      where: { email: normalizedEmail },
      defaults: { email: normalizedEmail, isActive: true },
    });

    if (!created) {
      return res.status(200).json({ success: true, message: "You're already subscribed!" });
    }
    res.status(201).json({ success: true, message: "You're now subscribed! Welcome to the Madiha family." });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(200).json({ success: true, message: "You're already subscribed!" });
    }
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/contact/newsletter  Admin: get all subscribers
router.get('/newsletter', protect, admin, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const total = await Newsletter.count({ where: { isActive: true } });
    const subscribers = await Newsletter.findAll({
      where: { isActive: true }, order: [['createdAt', 'DESC']], offset, limit: Number(limit),
    });
    res.json({ subscribers: subscribers.map(serializeNewsletter), total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
