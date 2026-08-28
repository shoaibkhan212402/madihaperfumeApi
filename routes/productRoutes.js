import express from 'express';
import { Op } from 'sequelize';
import { Product, ProductImage, ProductFeature, ProductSize } from '../models-sql/Product.js';
import Category from '../models-sql/Category.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import redis from '../config/redis.js';
import { serializeProduct } from '../utils/serializers.js';

const router = express.Router();

const clearCache = () => redis.deleteByPattern('products_*');
const isId = (v) => /^[0-9a-fA-F]{24}$/.test(v || '');

const withAssociations = [
  { model: Category, as: 'category' },
  { model: ProductImage, as: 'images' },
  { model: ProductFeature, as: 'features' },
  { model: ProductSize, as: 'sizes' },
];
const childOrder = [
  [{ model: ProductImage, as: 'images' }, 'sortOrder', 'ASC'],
  [{ model: ProductFeature, as: 'features' }, 'sortOrder', 'ASC'],
  [{ model: ProductSize, as: 'sizes' }, 'sortOrder', 'ASC'],
];

// ── GET /api/products  (public, supports ?category=&search=&sort=&page=&limit=)
router.get('/', async (req, res) => {
  try {
    const { category, search, sort, page = 1, limit = 20 } = req.query;
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');

    const cacheKey = `products_${JSON.stringify(req.query)}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const where = { isActive: true };

    if (category) {
      const slugs = category.split(',');
      const ids = slugs.filter(isId);
      const foundCats = await Category.findAll({
        where: { [Op.or]: [{ slug: { [Op.in]: slugs } }, ...(ids.length ? [{ id: { [Op.in]: ids } }] : [])] },
        attributes: ['id'],
      });
      where.categoryId = { [Op.in]: foundCats.map((c) => c.id) };
    }

    if (search) where.name = { [Op.like]: `%${search}%` };

    const sortOptions = {
      newest: [['createdAt', 'DESC']],
      price_asc: [['price', 'ASC']],
      price_desc: [['price', 'DESC']],
      featured: [['createdAt', 'DESC']],
    };
    const order = sortOptions[sort] || sortOptions.newest;

    const offset = (Number(page) - 1) * Number(limit);
    const [total, products] = await Promise.all([
      Product.count({ where }),
      Product.findAll({
        where, include: withAssociations, order: [...order, ...childOrder],
        offset, limit: Number(limit), distinct: true,
      }),
    ]);

    const result = { products: products.map(serializeProduct), total, page: Number(page), pages: Math.ceil(total / Number(limit)) };
    await redis.setex(cacheKey, 300, JSON.stringify(result));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/products/all-admin  Admin: get all including inactive
router.get('/all-admin', protect, admin, async (req, res) => {
  try {
    const products = await Product.findAll({ include: withAssociations, order: [['createdAt', 'DESC'], ...childOrder] });
    res.json(products.map(serializeProduct));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/products/meta/bestsellers  Public: get bestsellers
router.get('/meta/bestsellers', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    const cacheKey = 'products_bestsellers';
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const products = await Product.findAll({
      where: { isActive: true, isBestSeller: true },
      include: withAssociations, order: [['createdAt', 'DESC'], ...childOrder], limit: 12,
    });
    const result = products.map(serializeProduct);
    await redis.setex(cacheKey, 300, JSON.stringify(result));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/products/:idOrSlug
router.get('/:idOrSlug', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    const param = req.params.idOrSlug;
    const cacheKey = `products_item_${param}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const product = isId(param)
      ? await Product.findByPk(param, { include: withAssociations, order: childOrder })
      : await Product.findOne({ where: { slug: param }, include: withAssociations, order: childOrder });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const result = serializeProduct(product);
    await redis.setex(cacheKey, 300, JSON.stringify(result));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/products  Admin: create
router.post('/', protect, admin, async (req, res) => {
  try {
    const { images, features, sizes, category, ...rest } = req.body;
    const product = await Product.create({ ...rest, categoryId: category });

    if (images?.length) await ProductImage.bulkCreate(images.map((url, i) => ({ productId: product.id, url, sortOrder: i })));
    if (features?.length) await ProductFeature.bulkCreate(features.map((text, i) => ({ productId: product.id, text, sortOrder: i })));
    if (sizes?.length) await ProductSize.bulkCreate(sizes.map((s, i) => ({ productId: product.id, label: s.label, price: s.price, originalPrice: s.originalPrice, sortOrder: i })));

    await clearCache();
    const created = await Product.findByPk(product.id, { include: withAssociations, order: childOrder });
    res.status(201).json(serializeProduct(created));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── PUT /api/products/:id  Admin: update
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const { images, features, sizes, category, ...rest } = req.body;
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    await product.update({ ...rest, categoryId: category !== undefined ? category : product.categoryId });

    if (images !== undefined) {
      await ProductImage.destroy({ where: { productId: product.id } });
      if (images.length) await ProductImage.bulkCreate(images.map((url, i) => ({ productId: product.id, url, sortOrder: i })));
    }
    if (features !== undefined) {
      await ProductFeature.destroy({ where: { productId: product.id } });
      if (features.length) await ProductFeature.bulkCreate(features.map((text, i) => ({ productId: product.id, text, sortOrder: i })));
    }
    if (sizes !== undefined) {
      await ProductSize.destroy({ where: { productId: product.id } });
      if (sizes.length) await ProductSize.bulkCreate(sizes.map((s, i) => ({ productId: product.id, label: s.label, price: s.price, originalPrice: s.originalPrice, sortOrder: i })));
    }

    await clearCache();
    const updated = await Product.findByPk(product.id, { include: withAssociations, order: childOrder });
    res.json(serializeProduct(updated));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── DELETE /api/products/:id  Admin: delete
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    await product.destroy();
    await clearCache();
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/products/:id/toggle  Admin: toggle active
router.patch('/:id/toggle', protect, admin, async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    product.isActive = !product.isActive;
    await product.save();
    await clearCache();
    res.json({ isActive: product.isActive });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/products/:id/toggle-bestseller  Admin: toggle bestseller
router.patch('/:id/toggle-bestseller', protect, admin, async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    product.isBestSeller = !product.isBestSeller;
    await product.save();
    await clearCache();
    res.json({ isBestSeller: product.isBestSeller });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
