import express from 'express';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import redis from '../config/redis.js';

const router = express.Router();

// Helper: clear ALL product-related cache keys (pattern-based)
const clearCache = async () => {
  try {
    const keys = await redis.keys('products_*');
    if (keys.length > 0) {
      for (const key of keys) await redis.del(key);
    }
  } catch { /* Redis unavailable — no-op */ }
};

// ── GET /api/products  (public, supports ?category=&search=&sort=&page=&limit=)
router.get('/', async (req, res) => {
  try {
    const { category, search, sort, page = 1, limit = 20 } = req.query;

    const cacheKey = `products_${JSON.stringify(req.query)}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const filter = { isActive: true };
    
    if (category) {
      // If category is a list of slugs or IDs
      const slugs = category.split(',');
      const foundCats = await Category.find({ 
        $or: [
          { slug: { $in: slugs } },
          { _id: { $in: slugs.filter(s => s.match(/^[0-9a-fA-F]{24}$/)) } }
        ]
      });
      filter.category = { $in: foundCats.map(c => c._id) };
    }

    if (search) filter.name = { $regex: search, $options: 'i' };

    const sortOptions = {
      newest:    { createdAt: -1 },
      price_asc: { price: 1 },
      price_desc:{ price: -1 },
      featured:  { createdAt: -1 },
    };
    const sortBy = sortOptions[sort] || sortOptions.newest;

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .populate('category', 'name slug')
      .sort(sortBy)
      .skip(skip)
      .limit(Number(limit));

    const result = { products, total, page: Number(page), pages: Math.ceil(total / Number(limit)) };
    await redis.setex(cacheKey, 300, JSON.stringify(result));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/products/all-admin  Admin: get all including inactive
router.get('/all-admin', protect, admin, async (req, res) => {
  try {
    const products = await Product.find({}).populate('category', 'name slug').sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/products/meta/bestsellers  Public: get bestsellers
router.get('/meta/bestsellers', async (req, res) => {
  try {
    const products = await Product.find({ isActive: true, isBestSeller: true })
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })
      .limit(12);
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/products/:idOrSlug
router.get('/:idOrSlug', async (req, res) => {
  try {
    const param = req.params.idOrSlug;
    let product = param.match(/^[0-9a-fA-F]{24}$/)
      ? await Product.findById(param).populate('category', 'name slug')
      : await Product.findOne({ slug: param }).populate('category', 'name slug');
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/products  Admin: create
router.post('/', protect, admin, async (req, res) => {
  try {
    const { images, features, ...rest } = req.body;
    const product = new Product({
      ...rest,
      images:   images?.map((url) => ({ url })) || [],
      features: features?.map((text) => ({ text })) || [],
    });
    const created = await product.save();
    await clearCache();
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── PUT /api/products/:id  Admin: update
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const { images, features, ...rest } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    Object.assign(product, rest);
    if (images)   product.images   = images.map((url) => ({ url }));
    if (features) product.features = features.map((text) => ({ text }));

    const updated = await product.save();
    await clearCache();
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── DELETE /api/products/:id  Admin: delete
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    await clearCache();
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/products/:id/toggle  Admin: toggle active
router.patch('/:id/toggle', protect, admin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
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
    const product = await Product.findById(req.params.id);
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
