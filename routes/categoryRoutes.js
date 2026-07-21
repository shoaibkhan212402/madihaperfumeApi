import express from 'express';
import Category from '../models/Category.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import redis from '../config/redis.js';

const router = express.Router();
const CACHE_KEY = 'categories_all';
const clearCache = () => redis.del(CACHE_KEY);

// ── GET /api/categories  (public)
router.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    const cached = await redis.get(CACHE_KEY);
    if (cached) return res.json(JSON.parse(cached));

    const categories = await Category.find({}).sort({ name: 1 }).lean();
    await redis.setex(CACHE_KEY, 300, JSON.stringify(categories));
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/categories/:idOrSlug  (public)
router.get('/:idOrSlug', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    const param = req.params.idOrSlug;
    const cat = param.match(/^[0-9a-fA-F]{24}$/)
      ? await Category.findById(param).lean()
      : await Category.findOne({ slug: param }).lean();
    if (!cat) return res.status(404).json({ message: 'Category not found' });
    res.json(cat);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/categories  Admin: create
router.post('/', protect, admin, async (req, res) => {
  try {
    const { name, slug, description, image, parentCategory, seoTitle, seoDescription, seoKeywords } = req.body;
    const exists = await Category.findOne({ slug });
    if (exists) return res.status(400).json({ message: 'Category slug already exists' });
    const cat = await Category.create({ name, slug, description, image, parentCategory, seoTitle, seoDescription, seoKeywords });
    await clearCache();
    res.status(201).json(cat);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── PUT /api/categories/:id  Admin: update
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const cat = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!cat) return res.status(404).json({ message: 'Category not found' });
    await clearCache();
    res.json(cat);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── DELETE /api/categories/:id  Admin: delete
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const cat = await Category.findByIdAndDelete(req.params.id);
    if (!cat) return res.status(404).json({ message: 'Category not found' });
    await clearCache();
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
