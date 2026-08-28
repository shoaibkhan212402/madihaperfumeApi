/**
 * Reels Seeder — replaces whatever is in the Reels collection with the
 * given list. Run with: node scripts/seedReels.js
 */

import '../config/env.js';
import connectDB from '../config/db.js';
import Reel from '../models/Reel.js';

await connectDB();

const REELS = [
  {
    videoUrl: 'https://res.cloudinary.com/dmswkczme/video/upload/v1787851103/madiha-perfume/reels/esbbnlup5mbca6t5odmg.mp4',
    caption: 'Smell expensive, pay less — Madiha Perfume at ₹699',
    instagramLink: 'https://www.instagram.com/reel/DTuzR4ej_gu/',
    order: 0,
  },
  {
    videoUrl: 'https://res.cloudinary.com/dmswkczme/video/upload/v1787851113/madiha-perfume/reels/bwn4zurtq06pfnofn2dq.mp4',
    caption: 'Our brand journey — from customer to founder',
    instagramLink: 'https://www.instagram.com/reel/DcSn8AdvuXl/',
    order: 1,
  },
  {
    videoUrl: 'https://res.cloudinary.com/dmswkczme/video/upload/v1787851132/madiha-perfume/reels/dtoa2hbnpzlwrinupcc2.mp4',
    caption: 'Madiha Perfume — Premium Display Shelf',
    instagramLink: 'https://www.instagram.com/reel/DcJEBF4y3aC/',
    order: 2,
  },
];

try {
  await Reel.deleteMany({});
  const created = await Reel.insertMany(REELS);
  console.log(`✅ Reels collection replaced — ${created.length} reels now live.`);
} catch (err) {
  console.error('❌ Error seeding reels:', err.message);
} finally {
  process.exit(0);
}
