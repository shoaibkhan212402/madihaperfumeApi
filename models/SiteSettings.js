import mongoose from 'mongoose';

// ── SiteSettings: a single document holding all configurable homepage content
// Use findOneAndUpdate({ }, data, { upsert: true }) to always keep a single record
const siteSettingsSchema = new mongoose.Schema({

  // ── Testimonials
  testimonials: [{
    name:     { type: String, required: true },
    city:     { type: String, default: '' },
    stars:    { type: Number, default: 5, min: 1, max: 5 },
    text:     { type: String, required: true },
    initials: { type: String },      // auto-derived if blank
    isActive: { type: Boolean, default: true },
  }],

  // ── Why Choose Us (trust/brand highlights)
  whyUs: [{
    icon:    { type: String, default: '✨' },
    title:   { type: String, required: true },
    desc:    { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  }],

  // ── Instagram feed images (URLs, not local paths)
  instagramImages: [{ type: String }],
  instagramHandle: { type: String, default: '@madihaperfume' },
  instagramLink:   { type: String, default: 'https://instagram.com/madihaperfume' },

  // ── Promo Banner (the "3 for ₹899" dark strip on homepage)
  promoBanner: {
    enabled:     { type: Boolean, default: true },
    badge:       { type: String, default: '🔥 Exclusive Offer' },
    title:       { type: String, default: 'Get 3 Premium Perfumes' },
    price:       { type: Number, default: 899 },
    originalPrice: { type: Number, default: 1799 },
    subtitle:    { type: String, default: 'No code needed · Limited time · Mix & match any 3' },
    ctaLabel:    { type: String, default: 'Claim Offer →' },
    ctaLink:     { type: String, default: '/promo/get-3-perfumes-at-899' },
    image:       { type: String, default: '' },
  },

  // ── Trust Bar (the strip below the hero)
  trustBar: [{
    icon:  { type: String, default: '✓' },
    label: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  }],

  // ── Overall rating badge
  overallRating: { type: Number, default: 4.9 },
  totalReviews:  { type: String, default: '3,200+' },

  // ── Shipping and Order Limits
  deliveryCharge: { type: Number, default: 60 },
  freeDeliveryThreshold: { type: Number, default: 799 },
  minOrderValue: { type: Number, default: 0 },

}, { timestamps: true });

const SiteSettings = mongoose.model('SiteSettings', siteSettingsSchema);
export default SiteSettings;
