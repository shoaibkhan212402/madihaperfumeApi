import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Category from '../models/Category.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    console.log("Connected to DB...");

    const updates = [
      { oldSlot: "Attar",          newName: "Strong Arabic",    newSlug: "strong-arabic" },
      { oldSlot: "Perfume Spray",  newName: "Modern Arabic",    newSlug: "modern-arabic" },
      { oldSlot: "Body Spray",     newName: "French Style",     newSlug: "french-style" },
      { oldSlot: "Bakhoor",        newName: "Signature Sprays", newSlug: "signature-sprays" },
      { oldSlot: "Gift Combos",    newName: "Luxury Blends",    newSlug: "luxury-blends" },
    ];

    for (const item of updates) {
      // Find by partial match of name to catch existing ones
      const cat = await Category.findOne({ name: { $regex: item.oldSlot, $options: 'i' } });
      if (cat) {
        console.log(`Renaming ${cat.name} -> ${item.newName}`);
        cat.name = item.newName;
        cat.slug = item.newSlug;
        await cat.save();
      } else {
        // Try creating if it doesn't exist
        const check = await Category.findOne({ name: item.newName });
        if (!check) {
          console.log(`Creating ${item.newName}`);
          await Category.create({ name: item.newName, slug: item.newSlug });
        }
      }
    }

    console.log("Renaming complete!");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
