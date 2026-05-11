import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import Order from '../models/Order.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function seed() {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    console.log("Connected to DB... Wiping data...");

    // 1. Wipe everything except admin
    await Category.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    await User.deleteMany({ role: { $ne: 'ADMIN' } });
    console.log("Wiped categories, products, orders, and non-admin users.");

    // 2. Create Categories
    const categories = [
      { name: "Premium French Attars", slug: "premium-french-attars", description: "Fresh and elegant French style attars (6ml)", image: "/images/attar.png" },
      { name: "Premium Arabic Attars", slug: "premium-arabic-attars", description: "Rich and traditional Arabic style attars (6ml)", image: "/images/attar.png" },
      { name: "Strong Arabic Perfumes", slug: "strong-arabic-perfumes", description: "Long-lasting traditional oud perfumes (50ml)", image: "/images/theme_hero.png" },
      { name: "Modern Arabic Perfumes", slug: "modern-arabic-perfumes", description: "Contemporary Arabic blends (50ml)", image: "/images/theme_hero.png" },
      { name: "French / Designer Perfumes", slug: "french-designer-perfumes", description: "Mass-pleasing designer style perfumes (50ml)", image: "/images/hero.png" },
      { name: "Luxury Gift Sets", slug: "luxury-gift-sets", description: "Premium gift and discovery sets", image: "/images/combo.jpeg" },
      { name: "Travel Size Perfumes", slug: "travel-size-perfumes", description: "Convenient 20ml perfumes", image: "/images/hero.png" }
    ];

    const createdCats = {};
    for (const c of categories) {
      const doc = await Category.create(c);
      createdCats[c.name] = doc._id;
      console.log(`Created Category: ${c.name}`);
    }

    // 3. Create Products
    const products = [
      // Premium French Attars (6ml)
      { name: "Oudh Al Hashmi", size: "6ml", price: 399, originalPrice: 599, cat: "Premium French Attars" },
      { name: "White Oudh", size: "6ml", price: 399, originalPrice: 599, cat: "Premium French Attars" },
      { name: "Shanaya", size: "6ml", price: 399, originalPrice: 599, cat: "Premium French Attars" },
      { name: "Safwan", size: "6ml", price: 399, originalPrice: 599, cat: "Premium French Attars" },

      // Premium Arabic Attars (6ml)
      { name: "Bin Shaikh", size: "6ml", price: 449, originalPrice: 599, cat: "Premium Arabic Attars" },
      { name: "Sultan Al Oud Hind", size: "6ml", price: 449, originalPrice: 599, cat: "Premium Arabic Attars" },
      { name: "Dehnal Oud", size: "6ml", price: 449, originalPrice: 599, cat: "Premium Arabic Attars" },
      { name: "Mukhallat Rayyan", size: "6ml", price: 449, originalPrice: 599, cat: "Premium Arabic Attars" },
      { name: "Musk Abiyad", size: "6ml", price: 449, originalPrice: 599, cat: "Premium Arabic Attars" },
      { name: "Hawas Fire", size: "6ml", price: 449, originalPrice: 599, cat: "Premium Arabic Attars" },

      // Strong Arabic Perfume (50ml)
      { name: "Bin Shaikh Perfume", size: "50ml", price: 799, originalPrice: 1499, cat: "Strong Arabic Perfumes" },

      // Modern Arabic Perfumes (50ml)
      { name: "Hawas Fire Perfume", size: "50ml", price: 799, originalPrice: 1499, cat: "Modern Arabic Perfumes" },
      { name: "Wild Fire", size: "50ml", price: 799, originalPrice: 1499, cat: "Modern Arabic Perfumes" },
      { name: "Marj", size: "50ml", price: 799, originalPrice: 1499, cat: "Modern Arabic Perfumes" },

      // French / Designer Perfumes (50ml)
      { name: "The Most Wanted", size: "50ml", price: 799, originalPrice: 1499, cat: "French / Designer Perfumes" },
      { name: "Kaaf", size: "50ml", price: 799, originalPrice: 1499, cat: "French / Designer Perfumes" },

      // Luxury Gift Sets
      { name: "Madiha Prestige Box", size: "3x4ml", price: 799, originalPrice: 1999, cat: "Luxury Gift Sets" },
      { name: "Perfume Discovery set", size: "8x6ml", price: 799, originalPrice: 1499, cat: "Luxury Gift Sets" },

      // All Perfumes each (20ml) - The 19th product
      { name: "All Perfumes each", size: "20ml", price: 399, originalPrice: 699, cat: "Travel Size Perfumes" },
    ];

    for (const p of products) {
      const catId = createdCats[p.cat];
      await Product.create({
        name: p.name,
        shortDescription: `${p.name} - ${p.size}`,
        description: `Experience the luxurious ${p.name} in ${p.size} size. Perfect for any occasion.`,
        price: p.price,
        originalPrice: p.originalPrice,
        category: catId,
        size: p.size,
        images: [{ url: categories.find(c => c.name === p.cat)?.image || "/images/attar.png" }],
        stock: 100,
        slug: (p.name + "-" + p.size).toLowerCase().replace(/ /g, '-').replace(/[()]/g, ''),
        isFeatured: true
      });
      console.log(`Created Product: ${p.name}`);
    }

    console.log("Seeding complete! Highly detailed structure applied.");
    process.exit(0);
  } catch (err) {
    console.error("Critical Seed Error:", err);
    process.exit(1);
  }
}

seed();
