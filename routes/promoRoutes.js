import express from 'express';
import Promo from '../models/Promo.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── GET /api/promos  (Public — active promos list, no product population)
router.get('/', async (req, res) => {
  try {
    const promos = await Promo.find({ isActive: true });
    res.json(promos);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/promos/all-admin  Admin: get all promos (must come BEFORE /:slug)
router.get('/all-admin', protect, admin, async (req, res) => {
  try {
    const promos = await Promo.find({}).populate('products', 'name price images isActive');
    res.json(promos);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/promos/:slug  (Public — full product population)
router.get('/:slug', async (req, res) => {
  try {
    const promo = await Promo.findOne({ slug: req.params.slug, isActive: true })
      .populate('products', 'name price images isActive slug');
    if (!promo) return res.status(404).json({ message: 'Promo not found' });
    res.json(promo);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/promos  Admin: create
router.post('/', protect, admin, async (req, res) => {
  try {
    const promo = await Promo.create(req.body);
    res.status(201).json(promo);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── PUT /api/promos/:id  Admin: update
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const promo = await Promo.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('products', 'name price images isActive');
    if (!promo) return res.status(404).json({ message: 'Promo not found' });
    res.json(promo);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── DELETE /api/promos/:id  Admin: delete
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const promo = await Promo.findByIdAndDelete(req.params.id);
    if (!promo) return res.status(404).json({ message: 'Promo not found' });
    res.json({ message: 'Promo deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
