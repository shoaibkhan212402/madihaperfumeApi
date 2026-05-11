import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Combo from '../models/Combo.js';
import User from '../models/User.js';
import Banner from '../models/Banner.js';

dotenv.config();
connectDB();

const seedData = async () => {
  try {
    // ── Clear existing data
    await Category.deleteMany();
    await Product.deleteMany();
    await Combo.deleteMany();
    await Banner.deleteMany();

    console.log('🗑️  Existing data cleared');

    // ── 1. Create Banners
    await Banner.insertMany([
      {
        eyebrow: "Limited Time Offer",
        title:   { first: "The Art of", second: "Luxury Fragrance" },
        subtitle: "Discover handcrafted attars and premium sprays inspired by the world's finest ingredients.",
        image:   "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&q=80&w=1600",
        ctaLabel: "Shop Now",
        ctaLink:  "/collections/all",
        order:    1,
      },
      {
        eyebrow: "New Collection",
        title:   { first: "Royal Attar", second: "Pure & Timeless" },
        subtitle: "Hand-distilled from saffron, oud and rare musk using centuries-old Arabian techniques.",
        image:   "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&q=80&w=1600",
        ctaLabel: "Shop Attar",
        ctaLink:  "/collections/luxury-oud",
        order:    2,
      }
    ]);
    console.log('🖼️  Banners created');

    // ── 2. Create Categories
    const categories = await Category.insertMany([
      {
        name: 'Luxury Oud',
        slug: 'luxury-oud',
        description: 'Premium agarwood based fragrances for the discerning nose.',
        image: 'https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&q=80&w=1000',
      },
      {
        name: 'Floral Collection',
        slug: 'floral-collection',
        description: 'Fresh and delicate notes inspired by Persian gardens.',
        image: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&q=80&w=1000',
      },
      {
        name: 'Essential Oils',
        slug: 'essential-oils',
        description: 'Pure, concentrated extracts for a long-lasting experience.',
        image: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&q=80&w=1000',
      },
      {
        name: 'Gift Sets',
        slug: 'gift-sets',
        description: 'Carefully curated collections for special occasions.',
        image: 'https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&q=80&w=1000',
      },
    ]);
    console.log('📁 Categories created');

    // ── 3. Create Products
    const products = await Product.insertMany([
      {
        name: 'Madiha Royal Oud',
        slug: 'madiha-royal-oud',
        description: 'A masterpiece of deep, woody agarwood blended with hints of saffron and rose. This scent represents the pinnacle of Arabian luxury.',
        price: 4999,
        originalPrice: 6500,
        category: categories[0]._id,
        images: [{ url: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&q=80&w=1000' }],
        features: [{ text: '12-hour long lasting' }, { text: 'Pure Cambodian Oud' }, { text: 'Premium Gold-plated bottle' }],
        stock: 50,
        badge: 'Bestseller',
      },
      {
        name: 'Midnight Jasmine',
        slug: 'midnight-jasmine',
        description: 'An intoxicating blend of night-blooming jasmine, soft vanilla, and white musk. Perfect for elegant evenings.',
        price: 2499,
        originalPrice: 2999,
        category: categories[1]._id,
        images: [{ url: 'https://images.unsplash.com/photo-1615484477778-ca3b77940c25?auto=format&fit=crop&q=80&w=1000' }],
        features: [{ text: 'Sweet floral notes' }, { text: 'Vegan collection' }, { text: 'Eco-friendly packaging' }],
        stock: 30,
        badge: 'New Arrival',
      },
      {
        name: 'Majestic Amber',
        slug: 'majestic-amber',
        description: 'Warm, spicy amber notes paired with sandalwood and a touch of citrus. A versatile fragrance for all occasions.',
        price: 3200,
        originalPrice: 4000,
        category: categories[0]._id,
        images: [{ url: 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&q=80&w=1000' }],
        features: [{ text: 'Spicy wood notes' }, { text: 'Unisex fragrance' }],
        stock: 25,
      },
      {
        name: 'Pure Sandalwood Oil',
        slug: 'pure-sandalwood-oil',
        description: '100% pure Mysore sandalwood oil. Deeply meditative and calming.',
        price: 1500,
        originalPrice: 1800,
        category: categories[2]._id,
        images: [{ url: 'https://images.unsplash.com/photo-1616949755610-8c9fad0fd98c?auto=format&fit=crop&q=80&w=1000' }],
        features: [{ text: '100% pure' }, { text: 'Non-alcoholic' }],
        stock: 100,
      },
    ]);
    console.log('🧴 Products created');

    // ── 4. Create Combos
    await Combo.insertMany([
      {
        name: 'The Ultimate Oud Experience',
        slug: 'ultimate-oud-experience',
        description: 'A complete set featuring our Royal Oud and Majestic Amber, plus a limited edition scented candle.',
        shortDesc: 'Royal Oud + Majestic Amber + Candle',
        price: 6999,
        originalPrice: 9500,
        image: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&q=80&w=1000',
        badge: 'Value Set',
        includes: [
          { text: 'Madiha Royal Oud (50ml)' },
          { text: 'Majestic Amber (30ml)' },
          { text: 'Gold Scented Candle' }
        ],
        products: [products[0]._id, products[2]._id],
        stock: 15,
        isActive: true,
        isFeatured: true,
      },
      {
        name: 'Floral Dreams Trio',
        slug: 'floral-dreams-trio',
        description: 'Explore our floral collection with this specially curated trio of mini perfumes.',
        shortDesc: '3 x 15ml Floral Fragrances',
        price: 3499,
        originalPrice: 4500,
        image: 'https://images.unsplash.com/photo-1563170351-be82bc888bb4?auto=format&fit=crop&q=80&w=1000',
        products: [products[1]._id],
        stock: 20,
        isActive: true,
      }
    ]);
    console.log('🎁 Combos created');

    console.log('✅ Seeding completed successfully!');
    process.exit();
  } catch (error) {
    console.error(`❌ Error seeding data: ${error.message}`);
    process.exit(1);
  }
};

seedData();
