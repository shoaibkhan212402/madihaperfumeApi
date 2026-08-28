import express from 'express';
import { Op } from 'sequelize';
import Coupon from '../models-sql/Coupon.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { serializeCoupon } from '../utils/serializers.js';

const router = express.Router();

/* ─────────────────────────────────────────────────────────────
   PUBLIC — POST /api/coupons/apply
───────────────────────────────────────────────────────────── */
router.post('/apply', async (req, res) => {
  try {
    const { code, cartTotal } = req.body;
    if (!code) return res.status(400).json({ message: 'Coupon code is required' });

    const coupon = await Coupon.findOne({ where: { code: code.toUpperCase().trim() } });
    if (!coupon) return res.status(404).json({ message: 'Invalid coupon code' });
    if (!coupon.isCouponValid()) {
      let reason = 'This coupon is no longer active';
      if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) reason = 'This coupon has expired';
      if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) reason = 'This coupon has reached its usage limit';
      return res.status(400).json({ message: reason });
    }
    if (coupon.minOrderAmount > 0 && cartTotal < coupon.minOrderAmount) {
      return res.status(400).json({
        message: `Minimum order of ₹${coupon.minOrderAmount} required for this coupon`,
      });
    }

    let discountAmount = 0;
    if (coupon.discountType === 'PERCENT') {
      discountAmount = Math.round((cartTotal * coupon.discountValue) / 100);
    } else {
      discountAmount = Math.min(Number(coupon.discountValue), cartTotal);
    }

    res.json({
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      freeShipping: coupon.freeShipping,
      discountAmount,
      minOrderAmount: Number(coupon.minOrderAmount),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────
   PUBLIC — GET /api/coupons/public
───────────────────────────────────────────────────────────── */
router.get('/public', async (req, res) => {
  try {
    const now = new Date();
    const coupons = await Coupon.findAll({
      where: {
        isActive: true,
        startsAt: { [Op.lte]: now },
        [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: now } }],
      },
      attributes: ['code', 'description', 'discountType', 'discountValue', 'freeShipping', 'minOrderAmount', 'expiresAt'],
    });
    res.json(coupons.map(serializeCoupon));
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
    const offset = (Number(page) - 1) * Number(limit);
    const total = await Coupon.count();
    const coupons = await Coupon.findAll({ order: [['createdAt', 'DESC']], offset, limit: Number(limit) });
    res.json({ coupons: coupons.map(serializeCoupon), total });
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
      code, description, discountType,
      discountValue: Number(discountValue),
      freeShipping: !!freeShipping,
      minOrderAmount: Number(minOrderAmount) || 0,
      maxUses: Number(maxUses) || 0,
      expiresAt: expiresAt || null,
      startsAt: startsAt || new Date(),
      isActive: isActive !== false,
    });

    res.status(201).json(serializeCoupon(coupon));
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') return res.status(400).json({ message: 'Coupon code already exists' });
    res.status(400).json({ message: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────
   ADMIN — PUT /api/coupons/:id  (Update)
───────────────────────────────────────────────────────────── */
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });

    const b = req.body;
    await coupon.update({
      code: b.code ?? coupon.code,
      description: b.description ?? coupon.description,
      discountType: b.discountType ?? coupon.discountType,
      discountValue: b.discountValue !== undefined ? Number(b.discountValue) : coupon.discountValue,
      freeShipping: b.freeShipping ?? coupon.freeShipping,
      minOrderAmount: b.minOrderAmount !== undefined ? Number(b.minOrderAmount) : coupon.minOrderAmount,
      maxUses: b.maxUses !== undefined ? Number(b.maxUses) : coupon.maxUses,
      expiresAt: b.expiresAt !== undefined ? b.expiresAt : coupon.expiresAt,
      startsAt: b.startsAt ?? coupon.startsAt,
      isActive: b.isActive ?? coupon.isActive,
    });
    res.json(serializeCoupon(coupon));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────
   ADMIN — DELETE /api/coupons/:id
───────────────────────────────────────────────────────────── */
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const coupon = await Coupon.findByPk(req.params.id);
    if (coupon) await coupon.destroy();
    res.json({ message: 'Coupon deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
