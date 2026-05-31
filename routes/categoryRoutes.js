import express from 'express';
import Category from '../models/Category.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── GET /api/categories  (public)
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ name: 1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/categories/:idOrSlug  (public)
router.get('/:idOrSlug', async (req, res) => {
  try {
    const param = req.params.idOrSlug;
    const cat = param.match(/^[0-9a-fA-F]{24}$/)
      ? await Category.findById(param)
      : await Category.findOne({ slug: param });
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
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
