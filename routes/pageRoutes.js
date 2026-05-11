import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Promo pages — admin can manage these
const PROMO_PAGES = {
  attars: {
    slug: 'attars',
    title: 'Get 3 Attars at ₹899',
    subtitle: 'Mix & Match Your Favorites',
    description: 'Choose any 3 attars from our premium collection and get them all for just ₹899. No code needed — discount applied automatically at checkout.',
    badge: 'Limited Offer',
    ctaText: 'Shop Attars Now',
    ctaLink: '/collections/attar',
    filterCategory: 'attar',
    offer: { minQty: 3, price: 899 },
  },
  perfumes: {
    slug: 'perfumes',
    title: 'Get 3 Perfumes at ₹899',
    subtitle: 'Premium Sprays, Unbeatable Value',
    description: 'Pick any 3 perfume sprays from our bestselling range and pay just ₹899 total. Automatic savings, no coupon required.',
    badge: 'Flash Deal',
    ctaText: 'Shop Sprays Now',
    ctaLink: '/collections/perfume-spray',
    filterCategory: 'perfume-spray',
    offer: { minQty: 3, price: 899 },
  },
};

// ── GET /api/pages/promo/:slug  (public)
router.get('/promo/:slug', (req, res) => {
  const page = PROMO_PAGES[req.params.slug];
  if (!page) return res.status(404).json({ message: 'Promo page not found' });
  res.json(page);
});

// ── GET /api/pages/promo  Admin: list all promos
router.get('/promo', protect, admin, (req, res) => {
  res.json(Object.values(PROMO_PAGES));
});

// Policy pages content
const POLICIES = {
  'privacy-policy': {
    title: 'Privacy Policy',
    lastUpdated: '2026-01-01',
    sections: [
      { heading: '1. Information We Collect', body: 'We collect information you provide when creating an account, placing an order, or contacting us — including your name, email address, phone number, and delivery address. We also collect usage data such as pages visited, browser type, and device information to improve your shopping experience.' },
      { heading: '2. How We Use Your Information', body: 'We use the information collected to: process and fulfill your orders, send order confirmation and shipping updates via email, respond to customer service inquiries, improve our website and product offerings, send promotional emails (with your consent), and comply with legal obligations.' },
      { heading: '3. Data Sharing', body: 'We do not sell or rent your personal information to third parties. We share data only with payment processors (Razorpay) to complete transactions, logistics partners to deliver your orders, and analytics tools to understand website usage — all bound by strict data protection agreements.' },
      { heading: '4. Cookies', body: 'Our website uses essential cookies to maintain your cart session and login state. We also use analytics cookies to understand traffic patterns. You may disable cookies in your browser settings, though this may affect website functionality.' },
      { heading: '5. Data Retention', body: 'We retain your personal data for as long as your account is active or as needed to provide services. Order records are retained for 7 years for tax and legal compliance. You may request deletion of your account data at any time by contacting us.' },
      { heading: '6. Your Rights', body: 'You have the right to access, correct, or delete your personal information at any time. You can opt out of marketing emails using the unsubscribe link in any email. For data-related requests, please contact us at privacy@madihaperfume.com.' },
      { heading: '7. Contact', body: 'For privacy-related concerns or to exercise your rights, contact our Privacy Officer at: privacy@madihaperfume.com or via our contact form at madihaperfume.com/pages/contact-us.' },
    ],
  },
  'refund-policy': {
    title: 'Refund & Return Policy',
    lastUpdated: '2026-01-01',
    sections: [
      { heading: '1. Return Window', body: 'We offer a 7-day hassle-free return window from the date of delivery. Items must be unused, in their original packaging, and accompanied by the order invoice. Opened or used perfumes cannot be returned for hygiene reasons, except in cases of damage or incorrect delivery.' },
      { heading: '2. Eligible Returns', body: 'Returns are accepted for: items damaged during transit, incorrect items delivered, items with manufacturing defects, and items significantly different from their description. We do not accept returns for fragrance preference issues — please read product descriptions carefully before ordering.' },
      { heading: '3. How to Initiate a Return', body: 'Visit our Return Page at madihaperfume.com/return-your-order, enter your Order ID and registered email, and select your reason for return. Our team will respond within 24 hours with further instructions. Do not ship items back without receiving return authorization.' },
      { heading: '4. Refund Process', body: 'Once we receive and inspect the returned item, we will process your refund within 5-7 business days. Refunds are issued to the original payment method. For COD orders, refunds are processed via bank transfer (NEFT/IMPS) — you will need to provide your bank details.' },
      { heading: '5. Non-Returnable Items', body: 'The following items cannot be returned: opened or used fragrances (except in case of defect), items without original packaging, gift cards, and items purchased during clearance sales or with special promotional codes.' },
      { heading: '6. Shipping Costs', body: 'If the return is due to our error (wrong item, damage, defect), we will provide a free return pickup. For other returns, the customer bears the return shipping cost. Original shipping charges are non-refundable.' },
    ],
  },
  'terms-of-service': {
    title: 'Terms of Service',
    lastUpdated: '2026-01-01',
    sections: [
      { heading: '1. Acceptance of Terms', body: 'By accessing and using the Madiha Perfume website (madihaperfume.com), you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our website.' },
      { heading: '2. Account Registration', body: 'To place orders, you may create an account with accurate, current, and complete information. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account. Notify us immediately of any unauthorized use.' },
      { heading: '3. Product Information', body: 'We strive to provide accurate product descriptions and images. However, we do not warrant that product descriptions, prices, or other content on the site is complete, accurate, or error-free. Fragrance perception is subjective and may vary from person to person.' },
      { heading: '4. Pricing & Payment', body: 'All prices are listed in Indian Rupees (INR) and include applicable GST. We reserve the right to modify prices at any time. Payment is due at the time of ordering. We accept all major credit/debit cards, UPI, net banking, and Cash on Delivery (COD) for eligible locations.' },
      { heading: '5. Order Cancellation', body: 'You may cancel your order within 2 hours of placement if it has not been dispatched. To cancel, contact us via WhatsApp at +91 88859 78692 or email us at orders@madihaperfume.com. Orders already dispatched cannot be cancelled and must go through the return process.' },
      { heading: '6. Intellectual Property', body: 'All content on this website — including text, images, logos, product descriptions, and design elements — is the property of Madiha Perfume and is protected by copyright and trademark laws. Unauthorized use, reproduction, or distribution is strictly prohibited.' },
      { heading: '7. Governing Law', body: 'These Terms are governed by the laws of India. Any disputes arising from these terms or your use of our website shall be subject to the exclusive jurisdiction of the courts of Hyderabad, Telangana, India.' },
    ],
  },
  'shipping-policy': {
    title: 'Shipping Policy',
    lastUpdated: '2026-01-01',
    sections: [
      { heading: '1. Delivery Timelines', body: 'Standard delivery takes 4-7 business days across India. Express delivery (available in metro cities) takes 1-3 business days. Delivery times may be longer during peak seasons, holidays, or due to courier operational issues in remote areas.' },
      { heading: '2. Free Shipping', body: 'Enjoy free standard shipping on all orders above ₹799. A flat shipping fee of ₹60 applies to orders below ₹799. All combo sets qualify for free shipping regardless of order value.' },
      { heading: '3. Order Processing', body: 'Orders are processed within 24 hours of placement (excluding weekends and public holidays). You will receive a shipment confirmation email with your tracking number once your order is dispatched from our warehouse.' },
      { heading: '4. Tracking Your Order', body: 'Track your order in real-time by visiting our Track Order page at madihaperfume.com/track-order and entering your Order ID and registered email address. You can also track via the courier partner\'s website using the tracking number provided in your shipment email.' },
      { heading: '5. Failed Delivery', body: 'If a delivery attempt fails (non-availability, incorrect address, etc.), the courier will make 2 additional attempts. After 3 failed attempts, the package is returned to our warehouse and a refund will be processed, minus the return shipping cost.' },
      { heading: '6. International Shipping', body: 'We currently ship only within India. International shipping is not available at this time. We plan to expand to international markets soon — subscribe to our newsletter to be notified.' },
    ],
  },
};

// ── GET /api/pages/policy/:slug  (public)
router.get('/policy/:slug', (req, res) => {
  const policy = POLICIES[req.params.slug];
  if (!policy) return res.status(404).json({ message: 'Policy not found' });
  res.json(policy);
});

// ── GET /api/pages/policies  List all policy slugs
router.get('/policies', (req, res) => {
  res.json(Object.keys(POLICIES).map(slug => ({
    slug,
    title: POLICIES[slug].title,
    lastUpdated: POLICIES[slug].lastUpdated,
  })));
});

export default router;
