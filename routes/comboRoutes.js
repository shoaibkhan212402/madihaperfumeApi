import express from 'express';
import Combo from '../models/Combo.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import redis from '../config/redis.js';

const router = express.Router();
const clearCache = () => redis.deleteByPattern('combos_*');

// ── GET /api/combos  (public)
router.get('/', async (req, res) => {
  try {
    const { featured } = req.query;
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    const cacheKey = `combos_${JSON.stringify(req.query)}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const filter = { isActive: true };
    if (featured === 'true') filter.isFeatured = true;
    const combos = await Combo.find(filter).populate('products', 'name price image').sort({ createdAt: -1 }).lean();
    await redis.setex(cacheKey, 300, JSON.stringify(combos));
    res.json(combos);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/combos/all-admin  Admin: all including inactive
router.get('/all-admin', protect, admin, async (req, res) => {
  try {
    const combos = await Combo.find({}).populate('products', 'name price').sort({ createdAt: -1 });
    res.json(combos);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/combos/:idOrSlug  (public)
router.get('/:idOrSlug', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    const param = req.params.idOrSlug;
    const cacheKey = `combos_item_${param}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const combo = param.match(/^[0-9a-fA-F]{24}$/)
      ? await Combo.findById(param).populate('products').lean()
      : await Combo.findOne({ slug: param }).populate('products').lean();
    if (!combo) return res.status(404).json({ message: 'Combo not found' });
    await redis.setex(cacheKey, 300, JSON.stringify(combo));
    res.json(combo);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/combos  Admin: create
router.post('/', protect, admin, async (req, res) => {
  try {
    const { includes, ...rest } = req.body;
    const combo = await Combo.create({ ...rest, includes: includes?.map((text) => ({ text })) || [] });
    await clearCache();
    res.status(201).json(combo);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── PUT /api/combos/:id  Admin: update
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const { includes, ...rest } = req.body;
    const combo = await Combo.findById(req.params.id);
    if (!combo) return res.status(404).json({ message: 'Combo not found' });
    Object.assign(combo, rest);
    if (includes) combo.includes = includes.map((text) => ({ text }));
    const updated = await combo.save();
    await clearCache();
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── DELETE /api/combos/:id  Admin: delete
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const combo = await Combo.findByIdAndDelete(req.params.id);
    if (!combo) return res.status(404).json({ message: 'Combo not found' });
    await clearCache();
    res.json({ message: 'Combo deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/combos/:id/toggle  Admin: toggle active
router.patch('/:id/toggle', protect, admin, async (req, res) => {
  try {
    const combo = await Combo.findById(req.params.id);
    if (!combo) return res.status(404).json({ message: 'Combo not found' });
    combo.isActive = !combo.isActive;
    await combo.save();
    await clearCache();
    res.json({ isActive: combo.isActive });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
