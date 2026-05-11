import express from 'express';
import Coupon from '../models/Coupon.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

/* ─────────────────────────────────────────────────────────────
   PUBLIC — POST /api/coupons/apply
   Validate a coupon code against a cart subtotal.
   Returns discount details without incrementing usedCount.
───────────────────────────────────────────────────────────── */
router.post('/apply', async (req, res) => {
  try {
    const { code, cartTotal } = req.body;
    if (!code) return res.status(400).json({ message: 'Coupon code is required' });

    const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });
    if (!coupon) return res.status(404).json({ message: 'Invalid coupon code' });
    if (!coupon.isValid) {
      let reason = 'This coupon is no longer active';
      if (coupon.expiresAt && coupon.expiresAt < new Date()) reason = 'This coupon has expired';
      if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) reason = 'This coupon has reached its usage limit';
      return res.status(400).json({ message: reason });
    }
    if (coupon.minOrderAmount > 0 && cartTotal < coupon.minOrderAmount) {
      return res.status(400).json({
        message: `Minimum order of ₹${coupon.minOrderAmount} required for this coupon`,
      });
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (coupon.discountType === 'PERCENT') {
      discountAmount = Math.round((cartTotal * coupon.discountValue) / 100);
    } else {
      discountAmount = Math.min(coupon.discountValue, cartTotal);
    }

    res.json({
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      freeShipping: coupon.freeShipping,
      discountAmount,
      minOrderAmount: coupon.minOrderAmount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────
   PUBLIC — GET /api/coupons/public
   Return only active, non-expired public coupons (limited info)
───────────────────────────────────────────────────────────── */
router.get('/public', async (req, res) => {
  try {
    const now = new Date();
    const coupons = await Coupon.find({
      isActive: true,
      startsAt: { $lte: now },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    }).select('code description discountType discountValue freeShipping minOrderAmount expiresAt');
    res.json(coupons);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────
   ADMIN — GET /api/coupons
───────────────────────────────────────────────────────────── */
router.get('/', protect, admin, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const total = await Coupon.countDocuments();
    const coupons = await Coupon.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    res.json({ coupons, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────
   ADMIN — POST /api/coupons  (Create)
───────────────────────────────────────────────────────────── */
router.post('/', protect, admin, async (req, res) => {
  try {
    const {
      code, description, discountType, discountValue,
      freeShipping, minOrderAmount, maxUses, expiresAt, startsAt, isActive,
    } = req.body;

    if (!code || !discountType || discountValue === undefined)
      return res.status(400).json({ message: 'code, discountType and discountValue are required' });

    const coupon = await Coupon.create({
      code: code.toUpperCase().trim(),
      description,
      discountType,
      discountValue: Number(discountValue),
      freeShipping: !!freeShipping,
      minOrderAmount: Number(minOrderAmount) || 0,
      maxUses: Number(maxUses) || 0,
      expiresAt: expiresAt || null,
      startsAt: startsAt || new Date(),
      isActive: isActive !== false,
    });

    res.status(201).json(coupon);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Coupon code already exists' });
    res.status(400).json({ message: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────
   ADMIN — PUT /api/coupons/:id  (Update)
───────────────────────────────────────────────────────────── */
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const update = { ...req.body };
    if (update.code) update.code = update.code.toUpperCase().trim();
    if (update.discountValue !== undefined) update.discountValue = Number(update.discountValue);
    if (update.minOrderAmount !== undefined) update.minOrderAmount = Number(update.minOrderAmount);
    if (update.maxUses !== undefined) update.maxUses = Number(update.maxUses);

    const coupon = await Coupon.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
    res.json(coupon);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────
   ADMIN — DELETE /api/coupons/:id
───────────────────────────────────────────────────────────── */
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ message: 'Coupon deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
