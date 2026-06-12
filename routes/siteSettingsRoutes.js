import express from 'express';
import SiteSettings from '../models/SiteSettings.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { getWhatsAppStatus, resetWhatsApp } from '../utils/whatsappService.js';

const router = express.Router();

// Helper to seed initial settings if empty
const getOrDefault = async () => {
  let settings = await SiteSettings.findOne({});
  if (!settings) {
    settings = await SiteSettings.create({
      testimonials: [
        { name: "Aisha Rahman", city: "Hyderabad", stars: 5, text: "The Royal Oud attar is absolutely divine. It lasts the entire day and I receive so many compliments. Madiha Perfume never disappoints!", initials: "AR" },
        { name: "Mohammed Iqbal", city: "Mumbai", stars: 5, text: "Ordered the 3-attar combo for my wedding. My guests couldn't stop asking where I got the fragrance from. Premium quality at an unbeatable price.", initials: "MI" },
        { name: "Priya Nair", city: "Bangalore", stars: 5, text: "I was skeptical ordering online but the packaging was luxury-level and the scent is long-lasting. Will definitely order again!", initials: "PN" },
        { name: "Zainab Sheikh", city: "Delhi", stars: 5, text: "The French Attar collection is simply breathtaking. Very close to designer fragrances but at a fraction of the price. Highly recommend!", initials: "ZS" },
      ],
      whyUs: [
        { icon: "🌹", title: "100% Pure Ingredients", desc: "No synthetic fillers. Only the finest oud, saffron, musk and rose extracts from the world's best sources." },
        { icon: "🏆", title: "Master Perfumers", desc: "Blended by craftsmen with over 20 years of experience in authentic Arabian perfumery traditions." },
        { icon: "📦", title: "Luxury Packaging", desc: "Every order arrives in premium gift-ready packaging at no extra cost — perfect for gifting." },
        { icon: "✈️", title: "Pan-India Delivery", desc: "Fast, reliable shipping to all 28 states and UTs across India, delivered in 2–5 business days." },
        { icon: "💛", title: "50,000+ Happy Customers", desc: "Trusted by fragrance lovers across India and abroad since 2019. Our reviews speak for themselves." },
        { icon: "💬", title: "WhatsApp Support", desc: "Need assistance with your order? Our support team is here to help you 24/7." },
      ],
      instagramImages: [
        "/images/attar.png", "/images/offers.png", "/images/perfume_spray.png", "/images/hero.png", "/images/combo.jpeg", "/images/theme_hero.png"
      ],
      trustBar: [
        { icon: "🚚", label: "Free Shipping on Prepaid" },
        { icon: "🛡️", label: "100% Authentic Fragrances" },
        { icon: "💬", label: "WhatsApp Support" },
      ]
    });
  }
  return settings;
};

// ── GET /api/settings (Public)
router.get('/', async (req, res) => {
  try {
    const settings = await getOrDefault();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/settings (Admin)
router.put('/', protect, admin, async (req, res) => {
  try {
    let settings = await SiteSettings.findOne({});
    if (!settings) {
      settings = await SiteSettings.create(req.body);
    } else {
      settings = await SiteSettings.findOneAndUpdate({}, req.body, { new: true });
    }
    res.json(settings);
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
