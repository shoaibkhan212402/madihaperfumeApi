import express from 'express';
import { Promo } from '../models-sql/Promo.js';
import { Product } from '../models-sql/Product.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { serializePromo } from '../utils/serializers.js';

const router = express.Router();

// ── GET /api/promos  (Public — active promos list, no product population)
router.get('/', async (req, res) => {
  try {
    const promos = await Promo.findAll({ where: { isActive: true } });
    res.json(promos.map(serializePromo));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/promos/all-admin  Admin: get all promos (must come BEFORE /:slug)
router.get('/all-admin', protect, admin, async (req, res) => {
  try {
    const promos = await Promo.findAll({
      include: [{ model: Product, as: 'products', attributes: ['id', 'name', 'price', 'isActive'], through: { attributes: [] }, include: [{ association: 'images' }] }],
    });
    res.json(promos.map(serializePromo));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/promos/:slug  (Public — full product population)
router.get('/:slug', async (req, res) => {
  try {
    const promo = await Promo.findOne({
      where: { slug: req.params.slug, isActive: true },
      include: [{ model: Product, as: 'products', attributes: ['id', 'name', 'price', 'slug', 'isActive'], through: { attributes: [] }, include: [{ association: 'images' }] }],
    });
    if (!promo) return res.status(404).json({ message: 'Promo not found' });
    res.json(serializePromo(promo));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/promos  Admin: create
router.post('/', protect, admin, async (req, res) => {
  try {
    const { products, ...rest } = req.body;
    const promo = await Promo.create(rest);
    if (products?.length) await promo.setProducts(products);
    res.status(201).json(serializePromo(promo));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── PUT /api/promos/:id  Admin: update
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const { products, ...rest } = req.body;
    const promo = await Promo.findByPk(req.params.id);
    if (!promo) return res.status(404).json({ message: 'Promo not found' });
    await promo.update(rest);
    if (products !== undefined) await promo.setProducts(products);
    const updated = await Promo.findByPk(promo.id, {
      include: [{ model: Product, as: 'products', attributes: ['id', 'name', 'price', 'isActive'], through: { attributes: [] } }],
    });
    res.json(serializePromo(updated));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── DELETE /api/promos/:id  Admin: delete
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const promo = await Promo.findByPk(req.params.id);
    if (!promo) return res.status(404).json({ message: 'Promo not found' });
    await promo.destroy();
    res.json({ message: 'Promo deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
