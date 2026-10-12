import express from 'express';
import { SiteSettings, SiteTestimonial, SiteWhyUs, SiteTrustBar } from '../models-sql/SiteSettings.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { getWhatsAppStatus, resetWhatsApp } from '../utils/whatsappService.js';
import redis from '../config/redis.js';
import { serializeSiteSettings } from '../utils/serializers.js';

const router = express.Router();
const CACHE_KEY = 'site_settings';
const clearCache = () => redis.del(CACHE_KEY);

const withChildren = [
  { model: SiteTestimonial, as: 'testimonials' },
  { model: SiteWhyUs, as: 'whyUs' },
  { model: SiteTrustBar, as: 'trustBar' },
];
const childOrder = [
  [{ model: SiteTestimonial, as: 'testimonials' }, 'sortOrder', 'ASC'],
  [{ model: SiteWhyUs, as: 'whyUs' }, 'sortOrder', 'ASC'],
  [{ model: SiteTrustBar, as: 'trustBar' }, 'sortOrder', 'ASC'],
];

// Mirrors the old Mongo singleton pattern — always operates on "whichever one
// row exists", seeding sensible defaults the first time the site is used.
const getOrDefault = async () => {
  let settings = await SiteSettings.findOne({ include: withChildren, order: childOrder });
  if (!settings) {
    settings = await SiteSettings.create({
      instagramImages: ['/images/attar.png', '/images/offers.png', '/images/perfume_spray.png', '/images/hero.png', '/images/combo.jpeg', '/images/theme_hero.png'],
      instagramReels: [],
    });
    await SiteTestimonial.bulkCreate([

      { siteSettingsId: settings.id, name: 'Ahmed R.', city: 'Telangana', stars: 5, text: 'Wild Fire ki fragrance bahut premium aur powerful hai. Maine around 10 sprays kiye the aur iski khushboo kapdon par pure 2 din tak feel hoti rahi. Dusre din bhi jab wahi kapde pehne to logon ne fragrance ki tareef ki aur compliment diya. Itni achhi performance honestly expect nahi ki thi. Definitely one of my favourites!', sortOrder: 0 },
      { siteSettingsId: settings.id, name: 'Shafeeq M.', city: 'Kerala', stars: 5, text: 'Oudh Al Hashmi ki khushboo bahut royal aur classy hai. Iski performance bhi zabardast hai — lagbhag 15–16 hours tak fragrance achhi tarah bani rahi. Khaas baat ye hai ki time ke saath iski khushboo aur bhi smooth aur beautiful lagti hai. Premium attar lovers ke liye शानदार choice hai.', sortOrder: 1 },
      { siteSettingsId: settings.id, name: 'Mohammed Z.', city: 'Karnataka', stars: 5, text: 'Mukhallat Rayyan ki fragrance bahut smooth, elegant aur attractive hai. Iski performance around 13–14 hours tak rahi, jo ek attar ke liye kaafi impressive hai. Lagane ke baad kaafi der tak achhi khushboo feel hoti rahi aur compliments bhi mile. Quality se bahut impressed hoon.', sortOrder: 2 },
      { siteSettingsId: settings.id, name: 'Harpreet Singh', city: 'Punjab', stars: 5, text: 'Safwan ki fragrance bahut elegant aur sophisticated hai. Iski performance around 14 hours tak rahi aur kaafi der baad bhi fragrance noticeable thi. Fragrance na bahut strong hai na bahut light — ekdum perfect balance hai. Madiha Perfume ka ye attar mujhe bahut pasand aaya.', sortOrder: 3 },
      { siteSettingsId: settings.id, name: 'Faizan K.', city: 'Maharashtra', stars: 5, text: 'Kaaf ki fragrance bahut fresh, classy aur premium hai. Iski performance ne mujhe sabse zyada impress kiya — around 14 hours tak fragrance bani rahi. Pure din logon se compliments mile aur shaam tak bhi iski khushboo noticeable thi. Daily wear ke liye bhi aur special occasions ke liye bhi zabardast perfume hai.', sortOrder: 4 },

      { siteSettingsId: settings.id, name: 'Aisha Rahman', city: 'Hyderabad', stars: 5, text: 'The Royal Oud attar is absolutely divine. It lasts the entire day and I receive so many compliments. Madiha Perfume never disappoints!', initials: 'AR', sortOrder: 0 },
      { siteSettingsId: settings.id, name: 'Mohammed Iqbal', city: 'Mumbai', stars: 5, text: "Ordered the 3-attar combo for my wedding. My guests couldn't stop asking where I got the fragrance from. Premium quality at an unbeatable price.", initials: 'MI', sortOrder: 1 },
      { siteSettingsId: settings.id, name: 'Priya Nair', city: 'Bangalore', stars: 5, text: 'I was skeptical ordering online but the packaging was luxury-level and the scent is long-lasting. Will definitely order again!', initials: 'PN', sortOrder: 2 },
      { siteSettingsId: settings.id, name: 'Zainab Sheikh', city: 'Delhi', stars: 5, text: 'The French Attar collection is simply breathtaking. Very close to designer fragrances but at a fraction of the price. Highly recommend!', initials: 'ZS', sortOrder: 3 },

    ]);
    await SiteWhyUs.bulkCreate([
      { siteSettingsId: settings.id, icon: '🌹', title: '100% Pure Ingredients', desc: "No synthetic fillers. Only the finest oud, saffron, musk and rose extracts from the world's best sources.", sortOrder: 0 },
      { siteSettingsId: settings.id, icon: '🏆', title: 'Master Perfumers', desc: 'Blended by craftsmen with over 20 years of experience in authentic Arabian perfumery traditions.', sortOrder: 1 },
      { siteSettingsId: settings.id, icon: '📦', title: 'Luxury Packaging', desc: 'Every order arrives in premium gift-ready packaging at no extra cost — perfect for gifting.', sortOrder: 2 },
      { siteSettingsId: settings.id, icon: '✈️', title: 'Pan-India Delivery', desc: 'Fast, reliable shipping to all 28 states and UTs across India, delivered in 2–5 business days.', sortOrder: 3 },
      { siteSettingsId: settings.id, icon: '💛', title: '50,000+ Happy Customers', desc: 'Trusted by fragrance lovers across India and abroad since 2019. Our reviews speak for themselves.', sortOrder: 4 },
      { siteSettingsId: settings.id, icon: '💬', title: 'WhatsApp Support', desc: 'Need assistance with your order? Our support team is here to help you 24/7.', sortOrder: 5 },
    ]);
    await SiteTrustBar.bulkCreate([
      { siteSettingsId: settings.id, icon: '🚚', label: 'Free Shipping on Prepaid', sortOrder: 0 },
      { siteSettingsId: settings.id, icon: '🛡️', label: '100% Authentic Fragrances', sortOrder: 1 },
      { siteSettingsId: settings.id, icon: '💬', label: 'WhatsApp Support', sortOrder: 2 },
    ]);
    settings = await SiteSettings.findByPk(settings.id, { include: withChildren, order: childOrder });
  }
  return settings;
};

// ── GET /api/settings (Public)
router.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    const cached = await redis.get(CACHE_KEY);
    if (cached) return res.json(JSON.parse(cached));

    const settings = await getOrDefault();
    const result = serializeSiteSettings(settings);
    await redis.setex(CACHE_KEY, 300, JSON.stringify(result));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/settings (Admin)
router.put('/', protect, admin, async (req, res) => {
  try {
    const settings = await getOrDefault();
    const b = req.body;

    await settings.update({
      instagramHandle: b.instagramHandle ?? settings.instagramHandle,
      instagramLink: b.instagramLink ?? settings.instagramLink,
      instagramImages: b.instagramImages ?? settings.instagramImages,
      instagramReels: b.instagramReels ?? settings.instagramReels,
      promoBannerEnabled: b.promoBanner?.enabled ?? settings.promoBannerEnabled,
      promoBannerBadge: b.promoBanner?.badge ?? settings.promoBannerBadge,
      promoBannerTitle: b.promoBanner?.title ?? settings.promoBannerTitle,
      promoBannerPrice: b.promoBanner?.price ?? settings.promoBannerPrice,
      promoBannerOriginalPrice: b.promoBanner?.originalPrice ?? settings.promoBannerOriginalPrice,
      promoBannerSubtitle: b.promoBanner?.subtitle ?? settings.promoBannerSubtitle,
      promoBannerCtaLabel: b.promoBanner?.ctaLabel ?? settings.promoBannerCtaLabel,
      promoBannerCtaLink: b.promoBanner?.ctaLink ?? settings.promoBannerCtaLink,
      promoBannerImage: b.promoBanner?.image ?? settings.promoBannerImage,
      overallRating: b.overallRating ?? settings.overallRating,
      totalReviews: b.totalReviews ?? settings.totalReviews,
      deliveryCharge: b.deliveryCharge ?? settings.deliveryCharge,
      freeDeliveryThreshold: b.freeDeliveryThreshold ?? settings.freeDeliveryThreshold,
      minOrderValue: b.minOrderValue ?? settings.minOrderValue,
      seoTitle: b.seoTitle ?? settings.seoTitle,
      seoDescription: b.seoDescription ?? settings.seoDescription,
      seoKeywords: b.seoKeywords ?? settings.seoKeywords,
      seoImage: b.seoImage ?? settings.seoImage,
    });

    if (b.testimonials !== undefined) {
      await SiteTestimonial.destroy({ where: { siteSettingsId: settings.id } });
      if (b.testimonials.length) await SiteTestimonial.bulkCreate(b.testimonials.map((t, i) => ({ siteSettingsId: settings.id, name: t.name, city: t.city, stars: t.stars, text: t.text, initials: t.initials, isActive: t.isActive !== false, sortOrder: i })));
    }
    if (b.whyUs !== undefined) {
      await SiteWhyUs.destroy({ where: { siteSettingsId: settings.id } });
      if (b.whyUs.length) await SiteWhyUs.bulkCreate(b.whyUs.map((w, i) => ({ siteSettingsId: settings.id, icon: w.icon, title: w.title, desc: w.desc, isActive: w.isActive !== false, sortOrder: i })));
    }
    if (b.trustBar !== undefined) {
      await SiteTrustBar.destroy({ where: { siteSettingsId: settings.id } });
      if (b.trustBar.length) await SiteTrustBar.bulkCreate(b.trustBar.map((t, i) => ({ siteSettingsId: settings.id, icon: t.icon, label: t.label, isActive: t.isActive !== false, sortOrder: i })));
    }

    await clearCache();
    const updated = await SiteSettings.findByPk(settings.id, { include: withChildren, order: childOrder });
    res.json(serializeSiteSettings(updated));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── GET /api/settings/whatsapp/status (Admin)
router.get('/whatsapp/status', protect, admin, async (req, res) => {
  try {
    const statusInfo = await getWhatsAppStatus();
    res.json(statusInfo);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/settings/whatsapp/health (Monitoring — no auth required)
router.get('/whatsapp/health', async (req, res) => {
  try {
    const statusInfo = await getWhatsAppStatus();
    const isHealthy = statusInfo.status === 'READY';
    res.status(isHealthy ? 200 : 503).json({
      healthy: isHealthy,
      status: statusInfo.status,
      uptimeSeconds: statusInfo.uptimeSeconds,
      lastConnectedAt: statusInfo.lastConnectedAt,
    });
  } catch (err) {
    res.status(500).json({ healthy: false, status: 'ERROR', error: err.message });
  }
});

// ── POST /api/settings/whatsapp/reset (Admin)
router.post('/whatsapp/reset', protect, admin, async (req, res) => {
  try {
    await resetWhatsApp();
    res.json({ message: 'WhatsApp resetting. Please wait ~15 seconds to fetch the new status.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
