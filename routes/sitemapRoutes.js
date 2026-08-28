import express from 'express';
import { Product } from '../models-sql/Product.js';
import Category from '../models-sql/Category.js';
import { POLICIES } from './pageRoutes.js';

const router = express.Router();

function formatDate(dateInput) {
  if (!dateInput) return new Date().toISOString().split('T')[0];
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
    return d.toISOString().split('T')[0];
  } catch (e) {
    return new Date().toISOString().split('T')[0];
  }
}

router.get('/', async (req, res) => {
  try {
    const baseUrl = 'https://madihaperfume.com';
    const urls = [];
    const currentDate = new Date().toISOString().split('T')[0];

    // 1. Static Pages (Public)
    urls.push({ loc: `${baseUrl}/`, lastmod: currentDate, changefreq: 'daily', priority: '1.0' });
    urls.push({ loc: `${baseUrl}/cart`, lastmod: currentDate, changefreq: 'monthly', priority: '0.3' });
    urls.push({ loc: `${baseUrl}/store-locator`, lastmod: currentDate, changefreq: 'monthly', priority: '0.5' });
    urls.push({ loc: `${baseUrl}/combos`, lastmod: currentDate, changefreq: 'weekly', priority: '0.8' });
    urls.push({ loc: `${baseUrl}/collections`, lastmod: currentDate, changefreq: 'daily', priority: '0.8' });
    urls.push({ loc: `${baseUrl}/pages/contact-us`, lastmod: currentDate, changefreq: 'monthly', priority: '0.5' });
    urls.push({ loc: `${baseUrl}/pages/about-us`, lastmod: currentDate, changefreq: 'monthly', priority: '0.5' });

    // 2. Promos (Public)
    urls.push({ loc: `${baseUrl}/promo/attars`, lastmod: currentDate, changefreq: 'weekly', priority: '0.7' });
    urls.push({ loc: `${baseUrl}/promo/perfumes`, lastmod: currentDate, changefreq: 'weekly', priority: '0.7' });

    // 3. Dynamic Policies
    if (POLICIES) {
      Object.keys(POLICIES).forEach(slug => {
        const p = POLICIES[slug];
        urls.push({ 
          loc: `${baseUrl}/policies/${slug}`, 
          lastmod: formatDate(p.lastUpdated), 
          changefreq: 'monthly', 
          priority: '0.3' 
        });
      });
    }

    // 4. Dynamic Categories / Collections
    const categories = await Category.findAll();
    categories.forEach(cat => {
      const slug = cat.slug || cat.id;
      if (slug) {
        urls.push({
          loc: `${baseUrl}/collections/${slug}`,
          lastmod: formatDate(cat.updatedAt || cat.createdAt),
          changefreq: 'daily',
          priority: '0.8'
        });
      }
    });

    // 5. Dynamic Products
    const products = await Product.findAll({ where: { isActive: true } });
    products.forEach(prod => {
      const slugOrId = prod.slug || prod.id;
      if (slugOrId) {
        urls.push({ 
          loc: `${baseUrl}/products/${slugOrId}`, 
          lastmod: formatDate(prod.updatedAt || prod.createdAt), 
          changefreq: 'daily', 
          priority: '0.9' 
        });
      }
    });

    // Build XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">\n`;
    urls.forEach(u => {
      xml += `  <url>\n`;
      xml += `    <loc>${u.loc}</loc>\n`;
      xml += `    <lastmod>${u.lastmod}</lastmod>\n`;
      xml += `    <changefreq>${u.changefreq}</changefreq>\n`;
      xml += `    <priority>${u.priority}</priority>\n`;
      xml += `  </url>\n`;
    });
    xml += `</urlset>\n`;

    res.header('Content-Type', 'application/xml');
    res.status(200).send(xml);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
