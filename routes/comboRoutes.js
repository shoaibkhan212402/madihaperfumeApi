import express from 'express';
import { Combo, ComboInclude } from '../models-sql/Combo.js';
import { Product } from '../models-sql/Product.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import redis from '../config/redis.js';
import { serializeCombo } from '../utils/serializers.js';

const router = express.Router();
const clearCache = () => redis.deleteByPattern('combos_*');
const isId = (v) => /^[0-9a-fA-F]{24}$/.test(v || '');

const includesOrder = [[{ model: ComboInclude, as: 'includes' }, 'sortOrder', 'ASC']];

// ── GET /api/combos  (public)
router.get('/', async (req, res) => {
  try {
    const { featured } = req.query;
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    const cacheKey = `combos_${JSON.stringify(req.query)}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const where = { isActive: true };
    if (featured === 'true') where.isFeatured = true;
    const combos = await Combo.findAll({
      where,
      include: [
        { model: ComboInclude, as: 'includes' },
        { model: Product, as: 'products', attributes: ['id', 'name', 'price', 'slug'], through: { attributes: [] } },
      ],
      order: [['createdAt', 'DESC'], ...includesOrder],
    });
    // 'image' isn't a Product column — the old populate('products','name price image')
    // projection just returned undefined for it too; keep parity by leaving it off.
    const result = combos.map(serializeCombo);
    await redis.setex(cacheKey, 300, JSON.stringify(result));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/combos/all-admin  Admin: all including inactive
router.get('/all-admin', protect, admin, async (req, res) => {
  try {
    const combos = await Combo.findAll({
      include: [
        { model: ComboInclude, as: 'includes' },
        { model: Product, as: 'products', attributes: ['id', 'name', 'price'], through: { attributes: [] } },
      ],
      order: [['createdAt', 'DESC'], ...includesOrder],
    });
    res.json(combos.map(serializeCombo));
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

    const include = [
      { model: ComboInclude, as: 'includes' },
      { model: Product, as: 'products', through: { attributes: [] } },
    ];
    const combo = isId(param)
      ? await Combo.findByPk(param, { include, order: includesOrder })
      : await Combo.findOne({ where: { slug: param }, include, order: includesOrder });
    if (!combo) return res.status(404).json({ message: 'Combo not found' });
    const result = serializeCombo(combo);
    await redis.setex(cacheKey, 300, JSON.stringify(result));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/combos  Admin: create
router.post('/', protect, admin, async (req, res) => {
  try {
    const { includes, products, ...rest } = req.body;
    const combo = await Combo.create(rest);
    if (includes?.length) await ComboInclude.bulkCreate(includes.map((text, i) => ({ comboId: combo.id, text, sortOrder: i })));
    if (products?.length) await combo.setProducts(products);
    await clearCache();
    const created = await Combo.findByPk(combo.id, { include: [{ model: ComboInclude, as: 'includes' }, { model: Product, as: 'products', through: { attributes: [] } }], order: includesOrder });
    res.status(201).json(serializeCombo(created));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── PUT /api/combos/:id  Admin: update
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const { includes, products, ...rest } = req.body;
    const combo = await Combo.findByPk(req.params.id);
    if (!combo) return res.status(404).json({ message: 'Combo not found' });
    await combo.update(rest);
    if (includes !== undefined) {
      await ComboInclude.destroy({ where: { comboId: combo.id } });
      if (includes.length) await ComboInclude.bulkCreate(includes.map((text, i) => ({ comboId: combo.id, text, sortOrder: i })));
    }
    if (products !== undefined) await combo.setProducts(products);
    await clearCache();
    const updated = await Combo.findByPk(combo.id, { include: [{ model: ComboInclude, as: 'includes' }, { model: Product, as: 'products', through: { attributes: [] } }], order: includesOrder });
    res.json(serializeCombo(updated));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── DELETE /api/combos/:id  Admin: delete
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const combo = await Combo.findByPk(req.params.id);
    if (!combo) return res.status(404).json({ message: 'Combo not found' });
    await combo.destroy();
    await clearCache();
    res.json({ message: 'Combo deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/combos/:id/toggle  Admin: toggle active
router.patch('/:id/toggle', protect, admin, async (req, res) => {
  try {
    const combo = await Combo.findByPk(req.params.id);
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
