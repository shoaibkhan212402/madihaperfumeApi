import { DataTypes } from 'sequelize';
import { getSequelize } from '../config/mysql.js';
import { genId } from './_id.js';

const sequelize = getSequelize();

// Single-row table — mirrors the old Mongo singleton pattern (`findOne({})` /
// `findOneAndUpdate({}, data, {upsert:true})`): the app always operates on
// "whichever one row exists" rather than a hardcoded id, so the id column
// stays a normal generated 24-hex-char value like every other table.
const SiteSettings = sequelize.define('SiteSettings', {
  id: { type: DataTypes.CHAR(24), primaryKey: true, defaultValue: genId },
  instagramHandle: { type: DataTypes.STRING, allowNull: false, defaultValue: '@madihaperfume', field: 'instagram_handle' },
  instagramLink: { type: DataTypes.STRING(1024), allowNull: false, defaultValue: 'https://instagram.com/madihaperfume', field: 'instagram_link' },
  instagramImages: { type: DataTypes.JSON, allowNull: true, field: 'instagram_images' },
  instagramReels: { type: DataTypes.JSON, allowNull: true, field: 'instagram_reels' },
  promoBannerEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'promo_banner_enabled' },
  promoBannerBadge: { type: DataTypes.STRING, allowNull: false, defaultValue: '🔥 Exclusive Offer', field: 'promo_banner_badge' },
  promoBannerTitle: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Get 3 Premium Perfumes', field: 'promo_banner_title' },
  promoBannerPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 899, field: 'promo_banner_price' },
  promoBannerOriginalPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 1799, field: 'promo_banner_original_price' },
  promoBannerSubtitle: { type: DataTypes.STRING(1024), allowNull: false, defaultValue: 'No code needed · Limited time · Mix & match any 3', field: 'promo_banner_subtitle' },
  promoBannerCtaLabel: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Claim Offer →', field: 'promo_banner_cta_label' },
  promoBannerCtaLink: { type: DataTypes.STRING(1024), allowNull: false, defaultValue: '/promo/get-3-perfumes-at-899', field: 'promo_banner_cta_link' },
  promoBannerImage: { type: DataTypes.STRING(1024), allowNull: false, defaultValue: '', field: 'promo_banner_image' },
  overallRating: { type: DataTypes.DECIMAL(3, 1), allowNull: false, defaultValue: 4.9, field: 'overall_rating' },
  totalReviews: { type: DataTypes.STRING(50), allowNull: false, defaultValue: '3,200+', field: 'total_reviews' },
  deliveryCharge: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 60, field: 'delivery_charge' },
  freeDeliveryThreshold: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 799, field: 'free_delivery_threshold' },
  minOrderValue: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'min_order_value' },
  seoTitle: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Madiha Perfume | Luxury Indian & Arabic Fragrances', field: 'seo_title' },
  seoDescription: { type: DataTypes.TEXT, allowNull: true, field: 'seo_description' },
  seoKeywords: { type: DataTypes.STRING(1024), allowNull: true, field: 'seo_keywords' },
  seoImage: { type: DataTypes.STRING(1024), allowNull: false, defaultValue: '/og-image.png', field: 'seo_image' },
}, { tableName: 'site_settings' });

const SiteTestimonial = sequelize.define('SiteTestimonial', {
  id: { type: DataTypes.CHAR(24), primaryKey: true, defaultValue: genId },
  siteSettingsId: { type: DataTypes.CHAR(24), allowNull: false, field: 'site_settings_id' },
  name: { type: DataTypes.STRING, allowNull: false },
  city: { type: DataTypes.STRING, allowNull: false, defaultValue: '' },
  stars: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 5 },
  text: { type: DataTypes.TEXT, allowNull: false },
  initials: { type: DataTypes.STRING(10), allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: 'site_testimonials', timestamps: false });

const SiteWhyUs = sequelize.define('SiteWhyUs', {
  id: { type: DataTypes.CHAR(24), primaryKey: true, defaultValue: genId },
  siteSettingsId: { type: DataTypes.CHAR(24), allowNull: false, field: 'site_settings_id' },
  icon: { type: DataTypes.STRING(20), allowNull: false, defaultValue: '✨' },
  title: { type: DataTypes.STRING, allowNull: false },
  desc: { type: DataTypes.STRING(1024), allowNull: false, defaultValue: '', field: 'description' },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: 'site_why_us', timestamps: false });

const SiteTrustBar = sequelize.define('SiteTrustBar', {
  id: { type: DataTypes.CHAR(24), primaryKey: true, defaultValue: genId },
  siteSettingsId: { type: DataTypes.CHAR(24), allowNull: false, field: 'site_settings_id' },
  icon: { type: DataTypes.STRING(20), allowNull: false, defaultValue: '✓' },
  label: { type: DataTypes.STRING, allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: 'site_trust_bar', timestamps: false });

SiteSettings.hasMany(SiteTestimonial, { as: 'testimonials', foreignKey: 'siteSettingsId' });
SiteTestimonial.belongsTo(SiteSettings, { foreignKey: 'siteSettingsId' });

SiteSettings.hasMany(SiteWhyUs, { as: 'whyUs', foreignKey: 'siteSettingsId' });
SiteWhyUs.belongsTo(SiteSettings, { foreignKey: 'siteSettingsId' });

SiteSettings.hasMany(SiteTrustBar, { as: 'trustBar', foreignKey: 'siteSettingsId' });
SiteTrustBar.belongsTo(SiteSettings, { foreignKey: 'siteSettingsId' });

export { SiteSettings, SiteTestimonial, SiteWhyUs, SiteTrustBar };
export default SiteSettings;
