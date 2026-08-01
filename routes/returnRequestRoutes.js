import express from 'express';
import ReturnRequest from '../models/ReturnRequest.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { sendWhatsAppSelfMessage } from '../utils/whatsappService.js';

const router = express.Router();

// ── POST /api/return-requests  Public: customer submits an order issue ──
// No login required — covers WhatsApp orders that have no website account.
router.post('/', async (req, res) => {
  try {
    const {
      customerName, phone, email,
      orderSource, orderIdText,
      deliveredAt, description, images,
    } = req.body;

    if (!customerName || !phone || !deliveredAt || !description)
      return res.status(400).json({ message: 'Name, phone, delivery date and description are required' });

    const validSources = ['WEBSITE', 'WHATSAPP', 'OTHER'];
    const source = validSources.includes(orderSource) ? orderSource : 'OTHER';

    const request = await ReturnRequest.create({
      customerName: customerName.trim(),
      phone: phone.trim(),
      email: email?.trim(),
      orderSource: source,
      orderIdText: orderIdText?.trim(),
      deliveredAt,
      description: description.trim(),
      images: Array.isArray(images) ? images.slice(0, 6) : [],
    });

    res.status(201).json({ success: true, message: 'Request submitted. Our team will review it shortly.', request });

    // Fire-and-forget WhatsApp self-notify — never delays the customer's response
    setImmediate(() => {
      const lines = [
        '🔔 *New Return/Replacement Request*',
        '',
        `👤 ${request.customerName}`,
        `📞 ${request.phone}`,
        `🛒 Ordered via: ${request.orderSource}`,
        request.orderIdText ? `🧾 Order ref: ${request.orderIdText}` : null,
        `📅 Delivered: ${new Date(request.deliveredAt).toLocaleDateString('en-IN')}`,
        `📝 Issue: ${request.description}`,
        request.images.length ? `📷 ${request.images.length} photo(s) attached — see admin panel` : null,
        '',
        'Review in Admin Panel → Return Requests',
      ].filter(Boolean).join('\n');
      sendWhatsAppSelfMessage(lines).catch(() => {});
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── GET /api/return-requests  Admin: list all requests ──
router.get('/', protect, admin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status.toUpperCase();
    const skip = (Number(page) - 1) * Number(limit);
    const total = await ReturnRequest.countDocuments(filter);
    const requests = await ReturnRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    res.json({ requests, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/return-requests/:id/approve  Admin: accept — set Return or Replacement ──
router.patch('/:id/approve', protect, admin, async (req, res) => {
  try {
    const { resolutionType, adminNote } = req.body;
    if (!['RETURN', 'REPLACEMENT'].includes(resolutionType))
      return res.status(400).json({ message: 'resolutionType must be RETURN or REPLACEMENT' });

    const request = await ReturnRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'PENDING')
      return res.status(400).json({ message: 'Request has already been processed' });

    request.status = 'APPROVED';
    request.resolutionType = resolutionType;
    if (adminNote) request.adminNote = adminNote;
    request.processedAt = new Date();

    const updated = await request.save();
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── PATCH /api/return-requests/:id/reject  Admin: reject with a reason ──
router.patch('/:id/reject', protect, admin, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) return res.status(400).json({ message: 'A rejection reason is required' });

    const request = await ReturnRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'PENDING')
      return res.status(400).json({ message: 'Request has already been processed' });

    request.status = 'REJECTED';
    request.adminNote = reason.trim();
    request.processedAt = new Date();

    const updated = await request.save();
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
