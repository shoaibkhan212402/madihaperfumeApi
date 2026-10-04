/**
 * One-off: replaces the homepage testimonials with a new set provided by the
 * store owner. Connects to whichever DB config/env.js resolves (production,
 * since backend/.env.production is present in this checkout).
 *
 * Run with: node scripts/update_testimonials.js
 */

import '../config/env.js';
import { connectMysql } from '../config/mysql.js';
import { SiteSettings, SiteTestimonial } from '../models-sql/SiteSettings.js';
import redis from '../config/redis.js';

const newTestimonials = [
  {
    name: 'Ahmed R.',
    city: 'Telangana',
    stars: 5,
    text: 'Wild Fire ki fragrance bahut premium aur powerful hai. Maine around 10 sprays kiye the aur iski khushboo kapdon par pure 2 din tak feel hoti rahi. Dusre din bhi jab wahi kapde pehne to logon ne fragrance ki tareef ki aur compliment diya. Itni achhi performance honestly expect nahi ki thi. Definitely one of my favourites!',
  },
  {
    name: 'Shafeeq M.',
    city: 'Kerala',
    stars: 5,
    text: 'Oudh Al Hashmi ki khushboo bahut royal aur classy hai. Iski performance bhi zabardast hai — lagbhag 15–16 hours tak fragrance achhi tarah bani rahi. Khaas baat ye hai ki time ke saath iski khushboo aur bhi smooth aur beautiful lagti hai. Premium attar lovers ke liye शानदार choice hai.',
  },
  {
    name: 'Mohammed Z.',
    city: 'Karnataka',
    stars: 5,
    text: 'Mukhallat Rayyan ki fragrance bahut smooth, elegant aur attractive hai. Iski performance around 13–14 hours tak rahi, jo ek attar ke liye kaafi impressive hai. Lagane ke baad kaafi der tak achhi khushboo feel hoti rahi aur compliments bhi mile. Quality se bahut impressed hoon.',
  },
  {
    name: 'Harpreet Singh',
    city: 'Punjab',
    stars: 5,
    text: 'Safwan ki fragrance bahut elegant aur sophisticated hai. Iski performance around 14 hours tak rahi aur kaafi der baad bhi fragrance noticeable thi. Fragrance na bahut strong hai na bahut light — ekdum perfect balance hai. Madiha Perfume ka ye attar mujhe bahut pasand aaya.',
  },
  {
    name: 'Faizan K.',
    city: 'Maharashtra',
    stars: 5,
    text: 'Kaaf ki fragrance bahut fresh, classy aur premium hai. Iski performance ne mujhe sabse zyada impress kiya — around 14 hours tak fragrance bani rahi. Pure din logon se compliments mile aur shaam tak bhi iski khushboo noticeable thi. Daily wear ke liye bhi aur special occasions ke liye bhi zabardast perfume hai.',
  },
];

const run = async () => {
  try {
    await connectMysql();

    const settings = await SiteSettings.findOne();
    if (!settings) {
      throw new Error('No site_settings row found — nothing to update.');
    }

    await SiteTestimonial.destroy({ where: { siteSettingsId: settings.id } });
    await SiteTestimonial.bulkCreate(
      newTestimonials.map((t, i) => ({
        siteSettingsId: settings.id,
        name: t.name,
        city: t.city,
        stars: t.stars,
        text: t.text,
        isActive: true,
        sortOrder: i,
      }))
    );

    await redis.del('site_settings');
    console.log(`✅ Replaced testimonials with ${newTestimonials.length} new entries and cleared cache.`);
  } catch (err) {
    console.error('❌ Error updating testimonials:', err.message);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
};

run();
