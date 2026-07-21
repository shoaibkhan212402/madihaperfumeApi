import express from 'express';
import Banner from '../models/Banner.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import redis from '../config/redis.js';

const router = express.Router();
const CACHE_KEY = 'banners_public';
const clearCache = () => redis.del(CACHE_KEY);

// ── GET /api/banners (Public)
router.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    const cached = await redis.get(CACHE_KEY);
    if (cached) return res.json(JSON.parse(cached));

    const banners = await Banner.find({ isActive: true }).sort({ order: 1 }).lean();
    await redis.setex(CACHE_KEY, 300, JSON.stringify(banners));
    res.json(banners);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/banners/all-admin (Admin)
router.get('/all-admin', protect, admin, async (req, res) => {
  try {
    const banners = await Banner.find({}).sort({ order: 1 });
    res.json(banners);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/banners (Admin)
router.post('/', protect, admin, async (req, res) => {
  try {
    const banner = await Banner.create(req.body);
    await clearCache();
    res.status(201).json(banner);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── PUT /api/banners/:id (Admin)
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!banner) return res.status(404).json({ message: 'Banner not found' });
    await clearCache();
    res.json(banner);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── DELETE /api/banners/:id (Admin)
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) return res.status(404).json({ message: 'Banner not found' });
    await clearCache();
    res.json({ message: 'Banner deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
