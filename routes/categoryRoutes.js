import express from 'express';
import Category from '../models-sql/Category.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import redis from '../config/redis.js';
import { serializeCategory } from '../utils/serializers.js';

const router = express.Router();
const CACHE_KEY = 'categories_all';
const clearCache = () => redis.deleteByPattern('categories_*');

const isId = (v) => /^[0-9a-fA-F]{24}$/.test(v || '');

// ── GET /api/categories  (public)
router.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    const cached = await redis.get(CACHE_KEY);
    if (cached) return res.json(JSON.parse(cached));

    const categories = await Category.findAll({ order: [['name', 'ASC']] });
    const result = categories.map(serializeCategory);
    await redis.setex(CACHE_KEY, 300, JSON.stringify(result));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/categories/:idOrSlug  (public)
router.get('/:idOrSlug', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    const param = req.params.idOrSlug;
    const cacheKey = `categories_item_${param}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const cat = isId(param)
      ? await Category.findByPk(param)
      : await Category.findOne({ where: { slug: param } });
    if (!cat) return res.status(404).json({ message: 'Category not found' });
    const result = serializeCategory(cat);
    await redis.setex(cacheKey, 300, JSON.stringify(result));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/categories  Admin: create
router.post('/', protect, admin, async (req, res) => {
  try {
    const { name, slug, description, image, parentCategory, seoTitle, seoDescription, seoKeywords } = req.body;
    const exists = await Category.findOne({ where: { slug } });
    if (exists) return res.status(400).json({ message: 'Category slug already exists' });
    const cat = await Category.create({ name, slug, description, image, parentCategoryId: parentCategory || null, seoTitle, seoDescription, seoKeywords });
    await clearCache();
    res.status(201).json(serializeCategory(cat));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── PUT /api/categories/:id  Admin: update
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const cat = await Category.findByPk(req.params.id);
    if (!cat) return res.status(404).json({ message: 'Category not found' });
    const b = req.body;
    await cat.update({
      name: b.name ?? cat.name, slug: b.slug ?? cat.slug, description: b.description ?? cat.description,
      image: b.image ?? cat.image, parentCategoryId: b.parentCategory !== undefined ? b.parentCategory || null : cat.parentCategoryId,
      seoTitle: b.seoTitle ?? cat.seoTitle, seoDescription: b.seoDescription ?? cat.seoDescription, seoKeywords: b.seoKeywords ?? cat.seoKeywords,
    });
    await clearCache();
    res.json(serializeCategory(cat));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── DELETE /api/categories/:id  Admin: delete
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const cat = await Category.findByPk(req.params.id);
    if (!cat) return res.status(404).json({ message: 'Category not found' });
    await cat.destroy();
    await clearCache();
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
