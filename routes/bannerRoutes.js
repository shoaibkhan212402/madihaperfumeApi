import express from 'express';
import Banner from '../models-sql/Banner.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import redis from '../config/redis.js';
import { serializeBanner } from '../utils/serializers.js';

const router = express.Router();
const CACHE_KEY = 'banners_public';
const clearCache = () => redis.del(CACHE_KEY);

// ── GET /api/banners (Public)
router.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    const cached = await redis.get(CACHE_KEY);
    if (cached) return res.json(JSON.parse(cached));

    const banners = await Banner.findAll({ where: { isActive: true }, order: [['order', 'ASC']] });
    const result = banners.map(serializeBanner);
    await redis.setex(CACHE_KEY, 300, JSON.stringify(result));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/banners/all-admin (Admin)
router.get('/all-admin', protect, admin, async (req, res) => {
  try {
    const banners = await Banner.findAll({ order: [['order', 'ASC']] });
    res.json(banners.map(serializeBanner));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/banners (Admin)
router.post('/', protect, admin, async (req, res) => {
  try {
    const b = req.body;
    const banner = await Banner.create({
      titleFirst: b.title?.first || '', titleSecond: b.title?.second || '',
      eyebrow: b.eyebrow, subtitle: b.subtitle, image: b.image, mobileImage: b.mobileImage,
      textColor: b.textColor, ctaLabel: b.ctaLabel, ctaLink: b.ctaLink, cta2Label: b.cta2Label, cta2Link: b.cta2Link,
      order: b.order, isActive: b.isActive,
    });
    await clearCache();
    res.status(201).json(serializeBanner(banner));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── PUT /api/banners/:id (Admin)
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const banner = await Banner.findByPk(req.params.id);
    if (!banner) return res.status(404).json({ message: 'Banner not found' });
    const b = req.body;
    await banner.update({
      titleFirst: b.title?.first ?? banner.titleFirst, titleSecond: b.title?.second ?? banner.titleSecond,
      eyebrow: b.eyebrow ?? banner.eyebrow, subtitle: b.subtitle ?? banner.subtitle,
      image: b.image ?? banner.image, mobileImage: b.mobileImage ?? banner.mobileImage,
      textColor: b.textColor ?? banner.textColor, ctaLabel: b.ctaLabel ?? banner.ctaLabel,
      ctaLink: b.ctaLink ?? banner.ctaLink, cta2Label: b.cta2Label ?? banner.cta2Label, cta2Link: b.cta2Link ?? banner.cta2Link,
      order: b.order ?? banner.order, isActive: b.isActive ?? banner.isActive,
    });
    await clearCache();
    res.json(serializeBanner(banner));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── DELETE /api/banners/:id (Admin)
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const banner = await Banner.findByPk(req.params.id);
    if (!banner) return res.status(404).json({ message: 'Banner not found' });
    await banner.destroy();
    await clearCache();
    res.json({ message: 'Banner deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
