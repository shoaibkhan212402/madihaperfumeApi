/**
 * One-time (but safely re-runnable) migration: copies every document from the
 * live MongoDB Atlas database into the new MySQL database, preserving every
 * Mongo _id verbatim as the new primary key (see plan: models-sql/_id.js /
 * the CHAR(24) PK convention). Read-only against Mongo — never mutates it.
 *
 * Run with: node scripts/migrateToMysql.js
 */

import '../config/env.js';
import mongoConnect from '../config/db.js';
import { connectMysql } from '../config/mysql.js';

import MUser from '../models/User.js';
import MCategory from '../models/Category.js';
import MProduct from '../models/Product.js';
import MOrder from '../models/Order.js';
import MCombo from '../models/Combo.js';
import MCoupon from '../models/Coupon.js';
import MNewsletter from '../models/Newsletter.js';
import MPromo from '../models/Promo.js';
import MReel from '../models/Reel.js';
import MReturnRequest from '../models/ReturnRequest.js';
import MBanner from '../models/Banner.js';
import MSiteSettings from '../models/SiteSettings.js';
import MWhatsAppSession from '../models/WhatsAppSession.js';

import {
  sequelize,
  Category, Product, ProductImage, ProductFeature, ProductSize,
  User, UserAddress, UserCartItem,
  Order, OrderItem,
  Combo, ComboInclude, ComboProduct,
  Promo, PromoProduct,
  Coupon, Newsletter, Reel, Banner, ReturnRequest,
  SiteSettings, SiteTestimonial, SiteWhyUs, SiteTrustBar,
  WhatsAppSession,
} from '../models-sql/index.js';

const id = (objectId) => (objectId ? objectId.toString() : null);
const warnings = [];
const warn = (msg) => { warnings.push(msg); console.warn('⚠️ ', msg); };

async function run() {
  await mongoConnect();
  await connectMysql();

  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

  // Truncate in reverse-ish dependency order — safe regardless of exact order
  // since FK checks are off for the whole run.
  const allTables = [
    'product_images', 'product_features', 'product_sizes',
    'combo_includes', 'combo_products',
    'promo_products',
    'order_items',
    'user_addresses', 'user_cart_items',
    'site_testimonials', 'site_why_us', 'site_trust_bar',
    'products', 'categories', 'users', 'combos', 'promos', 'coupons',
    'newsletters', 'reels', 'banners', 'orders', 'return_requests',
    'site_settings', 'whatsapp_sessions',
  ];
  for (const t of allTables) {
    await sequelize.query(`TRUNCATE TABLE \`${t}\``);
  }

  // ── Categories (self-referential FK — insert with null parent first, then patch)
  const mCategories = await MCategory.find({}).lean();
  for (const c of mCategories) {
    await Category.create({
      id: id(c._id), name: c.name, slug: c.slug, description: c.description || null,
      image: c.image || null, parentCategoryId: null,
      seoTitle: c.seoTitle || null, seoDescription: c.seoDescription || null, seoKeywords: c.seoKeywords || null,
      createdAt: c.createdAt, updatedAt: c.updatedAt,
    }, { hooks: false });
  }
  for (const c of mCategories) {
    if (c.parentCategory) {
      await Category.update({ parentCategoryId: id(c.parentCategory) }, { where: { id: id(c._id) }, hooks: false });
    }
  }
  console.log(`✅ categories: ${mCategories.length}`);

  // ── Products (+ images/features/sizes)
  const mProducts = await MProduct.find({}).lean();
  const validProductIds = new Set(mProducts.map(p => id(p._id)));
  for (const p of mProducts) {
    await Product.create({
      id: id(p._id), name: p.name, slug: p.slug, description: p.description,
      price: p.price, originalPrice: p.originalPrice ?? null,
      categoryId: id(p.category), stock: p.stock, badge: p.badge || null,
      isActive: p.isActive, isBestSeller: !!p.isBestSeller,
      seoTitle: p.seoTitle || null, seoDescription: p.seoDescription || null, seoKeywords: p.seoKeywords || null,
      createdAt: p.createdAt, updatedAt: p.updatedAt,
    }, { hooks: false });

    // Child rows get freshly generated ids (not the Mongo subdocument _id) —
    // nothing external ever references an image/feature/size row by its own
    // id, and subdocument _ids are not guaranteed unique across parents.
    let i = 0;
    for (const img of p.images || []) {
      await ProductImage.create({ productId: id(p._id), url: img.url, sortOrder: i++ });
    }
    i = 0;
    for (const f of p.features || []) {
      await ProductFeature.create({ productId: id(p._id), text: f.text, sortOrder: i++ });
    }
    i = 0;
    for (const s of p.sizes || []) {
      await ProductSize.create({ productId: id(p._id), label: s.label, price: s.price, originalPrice: s.originalPrice ?? null, sortOrder: i++ });
    }
  }
  console.log(`✅ products: ${mProducts.length}`);

  // ── Users (+ addresses/cartItems) — hooks:false so the already-bcrypt-hashed
  // password is copied verbatim, never re-hashed.
  const mUsers = await MUser.find({}).lean();
  for (const u of mUsers) {
    await User.create({
      id: id(u._id), firstName: u.firstName, lastName: u.lastName, email: u.email, password: u.password,
      role: u.role || 'USER', googleId: u.googleId || null, isGoogleUser: !!u.isGoogleUser,
      phone: u.phone || null, isVerified: !!u.isVerified, otp: u.otp || null, otpExpires: u.otpExpires || null,
      createdAt: u.createdAt, updatedAt: u.updatedAt,
    }, { hooks: false });

    for (const a of u.addresses || []) {
      await UserAddress.create({
        userId: id(u._id), type: a.type || 'Home', fullName: a.fullName || null,
        phone: a.phone || null, street: a.street || null, landmark: a.landmark || null,
        city: a.city || null, state: a.state || null, country: a.country || 'India',
        zipCode: a.zipCode || null, isDefault: !!a.isDefault,
      });
    }
    for (const ci of u.cartItems || []) {
      await UserCartItem.create({
        userId: id(u._id), productIdText: ci.productId || null, name: ci.name || null,
        price: ci.price ?? null, originalPrice: ci.originalPrice ?? null, image: ci.image || null, qty: ci.qty || 1,
      });
    }
  }
  console.log(`✅ users: ${mUsers.length}`);

  // ── Combos (+ includes/products join)
  const mCombos = await MCombo.find({}).lean();
  for (const c of mCombos) {
    await Combo.create({
      id: id(c._id), name: c.name, slug: c.slug, description: c.description, shortDesc: c.shortDesc || null,
      price: c.price, originalPrice: c.originalPrice ?? null, image: c.image || null, badge: c.badge || null,
      stock: c.stock, isActive: c.isActive, isFeatured: !!c.isFeatured,
      createdAt: c.createdAt, updatedAt: c.updatedAt,
    }, { hooks: false });

    let i = 0;
    for (const inc of c.includes || []) {
      await ComboInclude.create({ comboId: id(c._id), text: inc.text, sortOrder: i++ });
    }
    i = 0;
    for (const pid of c.products || []) {
      if (!validProductIds.has(id(pid))) { warn(`Combo ${c.slug}: dangling product ref ${id(pid)} — skipped`); continue; }
      await ComboProduct.create({ comboId: id(c._id), productId: id(pid), sortOrder: i++ });
    }
  }
  console.log(`✅ combos: ${mCombos.length}`);

  // ── Coupons
  const mCoupons = await MCoupon.find({}).lean();
  for (const c of mCoupons) {
    await Coupon.create({
      id: id(c._id), code: c.code, description: c.description || '', discountType: c.discountType,
      discountValue: c.discountValue, freeShipping: !!c.freeShipping, minOrderAmount: c.minOrderAmount || 0,
      maxUses: c.maxUses || 0, usedCount: c.usedCount || 0, startsAt: c.startsAt, expiresAt: c.expiresAt || null,
      isActive: c.isActive, createdAt: c.createdAt, updatedAt: c.updatedAt,
    }, { hooks: false });
  }
  console.log(`✅ coupons: ${mCoupons.length}`);

  // ── Newsletter
  const mNewsletters = await MNewsletter.find({}).lean();
  for (const n of mNewsletters) {
    await Newsletter.create({
      id: id(n._id), email: n.email, subscribedAt: n.subscribedAt, isActive: n.isActive,
      createdAt: n.createdAt, updatedAt: n.updatedAt,
    }, { hooks: false });
  }
  console.log(`✅ newsletters: ${mNewsletters.length}`);

  // ── Promos (+ products join)
  const mPromos = await MPromo.find({}).lean();
  for (const p of mPromos) {
    await Promo.create({
      id: id(p._id), slug: p.slug, title: p.title, subtitle: p.subtitle, bundleSize: p.bundleSize,
      bundlePrice: p.bundlePrice, categorySlugs: p.categorySlugs || [], accentColor: p.accentColor || '#c8a96e',
      cartLabel: p.cartLabel || 'Bundle', isActive: p.isActive,
      createdAt: p.createdAt, updatedAt: p.updatedAt,
    }, { hooks: false });

    let i = 0;
    for (const pid of p.products || []) {
      if (!validProductIds.has(id(pid))) { warn(`Promo ${p.slug}: dangling product ref ${id(pid)} — skipped`); continue; }
      await PromoProduct.create({ promoId: id(p._id), productId: id(pid), sortOrder: i++ });
    }
  }
  console.log(`✅ promos: ${mPromos.length}`);

  // ── Reels
  const mReels = await MReel.find({}).lean();
  for (const r of mReels) {
    await Reel.create({
      id: id(r._id), videoUrl: r.videoUrl, thumbnail: r.thumbnail || '', caption: r.caption || '',
      instagramLink: r.instagramLink || '', order: r.order || 0, isActive: r.isActive,
      createdAt: r.createdAt, updatedAt: r.updatedAt,
    }, { hooks: false });
  }
  console.log(`✅ reels: ${mReels.length}`);

  // ── Banners
  const mBanners = await MBanner.find({}).lean();
  for (const b of mBanners) {
    await Banner.create({
      id: id(b._id), titleFirst: b.title?.first || '', titleSecond: b.title?.second || '',
      eyebrow: b.eyebrow || '', subtitle: b.subtitle || '', image: b.image,
      mobileImage: b.mobileImage || '', textColor: b.textColor || '#ffffff',
      ctaLabel: b.ctaLabel || '', ctaLink: b.ctaLink || '', cta2Label: b.cta2Label || '', cta2Link: b.cta2Link || '',
      order: b.order || 0, isActive: b.isActive, createdAt: b.createdAt, updatedAt: b.updatedAt,
    }, { hooks: false });
  }
  console.log(`✅ banners: ${mBanners.length}`);

  // ── Users must exist before orders; Products before order_items' product FK
  const validUserIds = new Set(mUsers.map(u => id(u._id)));

  // ── Orders (+ items)
  const mOrders = await MOrder.find({}).lean();
  let skippedOrders = 0;
  for (const o of mOrders) {
    if (!validUserIds.has(id(o.user))) { warn(`Order ${o._id}: user ${id(o.user)} not found — skipped whole order`); skippedOrders++; continue; }
    await Order.create({
      id: id(o._id), userId: id(o.user), firstName: o.firstName, lastName: o.lastName, phone: o.phone || null,
      address: o.address, city: o.city, state: o.state || null, postalCode: o.postalCode, country: o.country,
      paymentMethod: o.paymentMethod, paymentId: o.paymentId || null, paymentStatus: o.paymentStatus || null,
      paymentEmail: o.paymentEmail || null, itemsPrice: o.itemsPrice, taxPrice: o.taxPrice,
      shippingPrice: o.shippingPrice, discountAmount: o.discountAmount || 0, totalPrice: o.totalPrice,
      couponCode: o.couponCode || null, isPaid: o.isPaid, paidAt: o.paidAt || null, isDelivered: o.isDelivered,
      deliveredAt: o.deliveredAt || null, status: o.status, awbCode: o.awbCode || null,
      courierName: o.courierName || null, shiprocketOrderId: o.shiprocketOrderId || null,
      shiprocketShipmentId: o.shiprocketShipmentId || null, isReturnRequested: !!o.isReturnRequested,
      returnReason: o.returnReason || null, returnStatus: o.returnStatus || 'NONE',
      returnRequestedAt: o.returnRequestedAt || null, createdAt: o.createdAt, updatedAt: o.updatedAt,
    }, { hooks: false });

    let i = 0;
    for (const it of o.orderItems || []) {
      const productId = it.product && validProductIds.has(id(it.product)) ? id(it.product) : null;
      if (it.product && !productId) warn(`Order ${o._id} item "${it.name}": product ${id(it.product)} not found — nulled FK, kept snapshot`);
      await OrderItem.create({
        orderId: id(o._id), name: it.name, qty: it.qty, image: it.image, price: it.price,
        productId, productRef: it.productRef || null, sortOrder: i++,
      });
    }
  }
  console.log(`✅ orders: ${mOrders.length - skippedOrders} (${skippedOrders} skipped)`);

  // ── Return requests
  const validOrderIds = new Set(mOrders.map(o => id(o._id)));
  const mReturnRequests = await MReturnRequest.find({}).lean();
  for (const r of mReturnRequests) {
    const orderId = r.order && validOrderIds.has(id(r.order)) ? id(r.order) : null;
    await ReturnRequest.create({
      id: id(r._id), orderId, orderIdText: r.orderIdText || null, orderSource: r.orderSource || 'WEBSITE',
      customerName: r.customerName, phone: r.phone, email: r.email || null, deliveredAt: r.deliveredAt,
      description: r.description, images: r.images || [], status: r.status || 'PENDING',
      resolutionType: r.resolutionType || null, adminNote: r.adminNote || null, processedAt: r.processedAt || null,
      createdAt: r.createdAt, updatedAt: r.updatedAt,
    }, { hooks: false });
  }
  console.log(`✅ return_requests: ${mReturnRequests.length}`);

  // ── SiteSettings (singleton) + child arrays
  const mSettings = await MSiteSettings.findOne({}).lean();
  if (mSettings) {
    const settingsRow = await SiteSettings.create({
      id: id(mSettings._id), instagramHandle: mSettings.instagramHandle, instagramLink: mSettings.instagramLink,
      instagramImages: mSettings.instagramImages || [], instagramReels: mSettings.instagramReels || [],
      promoBannerEnabled: mSettings.promoBanner?.enabled ?? true, promoBannerBadge: mSettings.promoBanner?.badge || '',
      promoBannerTitle: mSettings.promoBanner?.title || '', promoBannerPrice: mSettings.promoBanner?.price || 0,
      promoBannerOriginalPrice: mSettings.promoBanner?.originalPrice || 0, promoBannerSubtitle: mSettings.promoBanner?.subtitle || '',
      promoBannerCtaLabel: mSettings.promoBanner?.ctaLabel || '', promoBannerCtaLink: mSettings.promoBanner?.ctaLink || '',
      promoBannerImage: mSettings.promoBanner?.image || '', overallRating: mSettings.overallRating,
      totalReviews: mSettings.totalReviews, deliveryCharge: mSettings.deliveryCharge,
      freeDeliveryThreshold: mSettings.freeDeliveryThreshold, minOrderValue: mSettings.minOrderValue,
      seoTitle: mSettings.seoTitle, seoDescription: mSettings.seoDescription, seoKeywords: mSettings.seoKeywords,
      seoImage: mSettings.seoImage, createdAt: mSettings.createdAt, updatedAt: mSettings.updatedAt,
    }, { hooks: false });

    let i = 0;
    for (const t of mSettings.testimonials || []) {
      await SiteTestimonial.create({ siteSettingsId: settingsRow.id, name: t.name, city: t.city || '', stars: t.stars || 5, text: t.text, initials: t.initials || null, isActive: t.isActive !== false, sortOrder: i++ });
    }
    i = 0;
    for (const w of mSettings.whyUs || []) {
      await SiteWhyUs.create({ siteSettingsId: settingsRow.id, icon: w.icon || '✨', title: w.title, desc: w.desc || '', isActive: w.isActive !== false, sortOrder: i++ });
    }
    i = 0;
    for (const t of mSettings.trustBar || []) {
      await SiteTrustBar.create({ siteSettingsId: settingsRow.id, icon: t.icon || '✓', label: t.label, isActive: t.isActive !== false, sortOrder: i++ });
    }
    console.log('✅ site_settings: 1 row +', (mSettings.testimonials?.length || 0), 'testimonials,', (mSettings.whyUs?.length || 0), 'whyUs,', (mSettings.trustBar?.length || 0), 'trustBar');
  } else {
    console.log('ℹ️  no SiteSettings document found in Mongo — leaving MySQL site_settings empty');
  }

  // ── WhatsApp session
  const mSessions = await MWhatsAppSession.find({}).lean();
  for (const s of mSessions) {
    await WhatsAppSession.create({
      id: id(s._id), sessionName: s.sessionName || 'madiha_master', sessionData: s.sessionData || null,
      status: s.status || 'INITIALIZING', qrCode: s.qrCode || null, error: s.error || null,
      lastConnectedAt: s.lastConnectedAt || null, connectionUpSince: s.connectionUpSince || null,
      lastUpdated: s.lastUpdated || new Date(), createdAt: s.createdAt, updatedAt: s.updatedAt,
    }, { hooks: false });
  }
  console.log(`✅ whatsapp_sessions: ${mSessions.length}`);

  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

  console.log('\n──────── Migration complete ────────');
  if (warnings.length) {
    console.log(`${warnings.length} warning(s):`);
    warnings.forEach(w => console.log(' -', w));
  } else {
    console.log('No warnings.');
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => { console.error('❌ Migration failed:', err); process.exit(1); });
