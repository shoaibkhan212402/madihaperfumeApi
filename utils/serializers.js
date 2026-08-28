// Converts Sequelize instances/plain rows back into the exact JSON shapes the
// React frontend already consumes (built when the backend spoke Mongoose):
// `_id` (not `id`), embedded objects for populated associations, and
// array-of-object shapes for child tables (`images:[{url}]`, not `[url]`).
// Each route decides what to `include`/`attributes` — these just re-shape
// whatever came back, so a field simply doesn't appear if it wasn't fetched.

const plain = (row) => (row?.toJSON ? row.toJSON() : row);

// A route can restrict `attributes` (mirroring the old Mongoose `.select()`
// projections). A field that wasn't fetched must stay absent from the JSON —
// coercing it with `!!x`/`Number(x)` would silently turn "not fetched" into
// a wrong `false`/`NaN` instead of the field simply being missing.
const b = (v) => (v === undefined ? undefined : !!v);
const n = (v) => (v === undefined ? undefined : v === null ? null : Number(v));

export function serializeCategory(row) {
  if (!row) return row;
  const c = plain(row);
  return {
    _id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    image: c.image,
    parentCategory: c.parentCategoryId,
    seoTitle: c.seoTitle,
    seoDescription: c.seoDescription,
    seoKeywords: c.seoKeywords,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export function serializeProduct(row) {
  if (!row) return row;
  const p = plain(row);
  const out = {
    _id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    price: n(p.price),
    originalPrice: n(p.originalPrice),
    stock: p.stock,
    badge: p.badge,
    isActive: b(p.isActive),
    isBestSeller: b(p.isBestSeller),
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    seoKeywords: p.seoKeywords,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
  if (p.category !== undefined) {
    out.category = p.category ? { _id: p.category.id, name: p.category.name, slug: p.category.slug } : null;
  } else if (p.categoryId) {
    out.category = p.categoryId;
  }
  if (p.images) out.images = p.images.map((i) => ({ url: i.url }));
  if (p.features) out.features = p.features.map((f) => ({ text: f.text }));
  if (p.sizes) out.sizes = p.sizes.map((s) => ({ label: s.label, price: n(s.price), originalPrice: n(s.originalPrice) }));
  return out;
}

export function serializeCombo(row) {
  if (!row) return row;
  const c = plain(row);
  const out = {
    _id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    shortDesc: c.shortDesc,
    price: n(c.price),
    originalPrice: n(c.originalPrice),
    image: c.image,
    badge: c.badge,
    stock: c.stock,
    isActive: b(c.isActive),
    isFeatured: b(c.isFeatured),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
  if (c.includes) out.includes = c.includes.map((i) => ({ text: i.text }));
  if (c.products) out.products = c.products.map((p) => serializeProduct(p));
  return out;
}

export function serializePromo(row) {
  if (!row) return row;
  const p = plain(row);
  return {
    _id: p.id,
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle,
    bundleSize: p.bundleSize,
    bundlePrice: n(p.bundlePrice),
    categorySlugs: p.categorySlugs || [],
    products: p.products ? p.products.map((pr) => serializeProduct(pr)) : undefined,
    accentColor: p.accentColor,
    cartLabel: p.cartLabel,
    isActive: b(p.isActive),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export function serializeCoupon(row) {
  if (!row) return row;
  const c = plain(row);
  const isValid = c.isActive !== undefined && row.isCouponValid ? row.isCouponValid() : undefined;
  return {
    _id: c.id,
    code: c.code,
    description: c.description,
    discountType: c.discountType,
    discountValue: n(c.discountValue),
    freeShipping: b(c.freeShipping),
    minOrderAmount: n(c.minOrderAmount),
    maxUses: c.maxUses,
    usedCount: c.usedCount,
    startsAt: c.startsAt,
    expiresAt: c.expiresAt,
    isActive: b(c.isActive),
    isValid,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export function serializeNewsletter(row) {
  if (!row) return row;
  const x = plain(row);
  return { _id: x.id, email: x.email, subscribedAt: x.subscribedAt, isActive: b(x.isActive), createdAt: x.createdAt, updatedAt: x.updatedAt };
}

export function serializeReel(row) {
  if (!row) return row;
  const r = plain(row);
  return {
    _id: r.id, videoUrl: r.videoUrl, thumbnail: r.thumbnail, caption: r.caption,
    instagramLink: r.instagramLink, order: r.order, isActive: b(r.isActive),
    createdAt: r.createdAt, updatedAt: r.updatedAt,
  };
}

export function serializeBanner(row) {
  if (!row) return row;
  const x = plain(row);
  return {
    _id: x.id,
    title: { first: x.titleFirst, second: x.titleSecond },
    eyebrow: x.eyebrow, subtitle: x.subtitle, image: x.image, mobileImage: x.mobileImage,
    textColor: x.textColor, ctaLabel: x.ctaLabel, ctaLink: x.ctaLink, cta2Label: x.cta2Label, cta2Link: x.cta2Link,
    order: x.order, isActive: b(x.isActive), createdAt: x.createdAt, updatedAt: x.updatedAt,
  };
}

export function serializeUser(row) {
  if (!row) return row;
  const u = plain(row);
  const out = {
    _id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, role: u.role,
    googleId: u.googleId, isGoogleUser: b(u.isGoogleUser), phone: u.phone, isVerified: b(u.isVerified),
    createdAt: u.createdAt, updatedAt: u.updatedAt,
  };
  if (u.addresses) out.addresses = u.addresses.map(serializeAddress);
  if (u.cartItems) out.cartItems = u.cartItems.map(serializeCartItem);
  return out;
}

export function serializeAddress(row) {
  if (!row) return row;
  const a = plain(row);
  return {
    _id: a.id, type: a.type, fullName: a.fullName, phone: a.phone, street: a.street,
    landmark: a.landmark, city: a.city, state: a.state, country: a.country, zipCode: a.zipCode,
    isDefault: b(a.isDefault),
  };
}

export function serializeCartItem(row) {
  if (!row) return row;
  const c = plain(row);
  return {
    _id: c.id, productId: c.productIdText, name: c.name,
    price: n(c.price),
    originalPrice: n(c.originalPrice),
    image: c.image, qty: c.qty,
  };
}

export function serializeOrderItem(row) {
  if (!row) return row;
  const i = plain(row);
  return {
    _id: i.id, name: i.name, qty: i.qty, image: i.image, price: n(i.price),
    product: i.productId, productRef: i.productRef,
  };
}

export function serializeOrder(row) {
  if (!row) return row;
  const o = plain(row);
  const out = {
    _id: o.id,
    user: o.user ? { _id: o.user.id, firstName: o.user.firstName, lastName: o.user.lastName, email: o.user.email } : o.userId,
    orderItems: o.orderItems ? o.orderItems.map(serializeOrderItem) : [],
    firstName: o.firstName, lastName: o.lastName, phone: o.phone, address: o.address, city: o.city,
    state: o.state, postalCode: o.postalCode, country: o.country,
    paymentMethod: o.paymentMethod, paymentId: o.paymentId, paymentStatus: o.paymentStatus, paymentEmail: o.paymentEmail,
    itemsPrice: n(o.itemsPrice), taxPrice: n(o.taxPrice), shippingPrice: n(o.shippingPrice),
    discountAmount: n(o.discountAmount), totalPrice: n(o.totalPrice), couponCode: o.couponCode,
    isPaid: b(o.isPaid), paidAt: o.paidAt, isDelivered: b(o.isDelivered), deliveredAt: o.deliveredAt,
    status: o.status, awbCode: o.awbCode, courierName: o.courierName,
    shiprocketOrderId: o.shiprocketOrderId, shiprocketShipmentId: o.shiprocketShipmentId,
    isReturnRequested: b(o.isReturnRequested), returnReason: o.returnReason, returnStatus: o.returnStatus,
    returnRequestedAt: o.returnRequestedAt,
    createdAt: o.createdAt, updatedAt: o.updatedAt,
  };
  return out;
}

export function serializeReturnRequest(row) {
  if (!row) return row;
  const r = plain(row);
  return {
    _id: r.id, order: r.orderId, orderIdText: r.orderIdText, orderSource: r.orderSource,
    customerName: r.customerName, phone: r.phone, email: r.email, deliveredAt: r.deliveredAt,
    description: r.description, images: r.images || [], status: r.status, resolutionType: r.resolutionType,
    adminNote: r.adminNote, processedAt: r.processedAt, createdAt: r.createdAt, updatedAt: r.updatedAt,
  };
}

export function serializeSiteSettings(row) {
  if (!row) return row;
  const s = plain(row);
  return {
    _id: s.id,
    testimonials: (s.testimonials || []).map((t) => ({ _id: t.id, name: t.name, city: t.city, stars: t.stars, text: t.text, initials: t.initials, isActive: b(t.isActive) })),
    whyUs: (s.whyUs || []).map((w) => ({ _id: w.id, icon: w.icon, title: w.title, desc: w.desc, isActive: b(w.isActive) })),
    instagramImages: s.instagramImages || [],
    instagramReels: s.instagramReels || [],
    instagramHandle: s.instagramHandle,
    instagramLink: s.instagramLink,
    promoBanner: {
      enabled: b(s.promoBannerEnabled), badge: s.promoBannerBadge, title: s.promoBannerTitle,
      price: n(s.promoBannerPrice), originalPrice: n(s.promoBannerOriginalPrice),
      subtitle: s.promoBannerSubtitle, ctaLabel: s.promoBannerCtaLabel, ctaLink: s.promoBannerCtaLink,
      image: s.promoBannerImage,
    },
    trustBar: (s.trustBar || []).map((t) => ({ _id: t.id, icon: t.icon, label: t.label, isActive: b(t.isActive) })),
    overallRating: n(s.overallRating),
    totalReviews: s.totalReviews,
    deliveryCharge: n(s.deliveryCharge),
    freeDeliveryThreshold: n(s.freeDeliveryThreshold),
    minOrderValue: n(s.minOrderValue),
    seoTitle: s.seoTitle, seoDescription: s.seoDescription, seoKeywords: s.seoKeywords, seoImage: s.seoImage,
    createdAt: s.createdAt, updatedAt: s.updatedAt,
  };
}
