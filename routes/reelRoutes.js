import express from 'express';
import Reel from '../models-sql/Reel.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import redis from '../config/redis.js';
import { serializeReel } from '../utils/serializers.js';
import { deleteMediaUrls } from '../utils/mediaCleanup.js';

const router = express.Router();
const CACHE_KEY = 'reels_public';
const clearCache = () => redis.del(CACHE_KEY);

// ── GET /api/reels (Public)
router.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    const cached = await redis.get(CACHE_KEY);
    if (cached) return res.json(JSON.parse(cached));

    const reels = await Reel.findAll({ where: { isActive: true }, order: [['order', 'ASC']] });
    const result = reels.map(serializeReel);
    await redis.setex(CACHE_KEY, 300, JSON.stringify(result));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/reels/all-admin (Admin)
router.get('/all-admin', protect, admin, async (req, res) => {
  try {
    const reels = await Reel.findAll({ order: [['order', 'ASC']] });
    res.json(reels.map(serializeReel));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/reels (Admin)
router.post('/', protect, admin, async (req, res) => {
  try {
    const { videoUrl, thumbnail, caption, instagramLink, order, isActive } = req.body;
    if (!videoUrl?.trim() && !instagramLink?.trim()) {
      return res.status(400).json({ message: 'Provide a video (upload or direct link) or an Instagram link — one is required.' });
    }
    const reel = await Reel.create({ videoUrl: videoUrl || '', thumbnail, caption, instagramLink, order, isActive });
    await clearCache();
    res.status(201).json(serializeReel(reel));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── PUT /api/reels/:id (Admin)
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const reel = await Reel.findByPk(req.params.id);
    if (!reel) return res.status(404).json({ message: 'Reel not found' });
    const r = req.body;
    const nextVideoUrl = r.videoUrl ?? reel.videoUrl;
    const nextInstagramLink = r.instagramLink ?? reel.instagramLink;
    if (!nextVideoUrl?.trim() && !nextInstagramLink?.trim()) {
      return res.status(400).json({ message: 'Provide a video (upload or direct link) or an Instagram link — one is required.' });
    }
    await reel.update({
      videoUrl: nextVideoUrl, thumbnail: r.thumbnail ?? reel.thumbnail,
      caption: r.caption ?? reel.caption, instagramLink: nextInstagramLink,
      order: r.order ?? reel.order, isActive: r.isActive ?? reel.isActive,
    });
    await clearCache();
    res.json(serializeReel(reel));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── DELETE /api/reels/:id (Admin)
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const reel = await Reel.findByPk(req.params.id);
    if (!reel) return res.status(404).json({ message: 'Reel not found' });
    await deleteMediaUrls([reel.videoUrl, reel.thumbnail]);
    await reel.destroy();
    await clearCache();
    res.json({ message: 'Reel deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
