import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import connectDB from './config/db.js';
import productRoutes from './routes/productRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import userRoutes from './routes/userRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import comboRoutes from './routes/comboRoutes.js';
import bannerRoutes from './routes/bannerRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import pageRoutes from './routes/pageRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import promoRoutes from './routes/promoRoutes.js';
import siteSettingsRoutes from './routes/siteSettingsRoutes.js';
import { initWhatsApp } from './utils/whatsappService.js';

import { existsSync } from 'fs';

// Auto-detect correct .env file — avoids chicken-and-egg problem
// On Hostinger: .env.production exists → loads it (with all production credentials)
// On local dev: only .env exists → loads it
const envFile = existsSync('.env.production') ? '.env.production' : '.env';
dotenv.config({ path: envFile });
console.log(`✅ Loaded env from: ${envFile}`);
connectDB();
initWhatsApp();

const app = express();

// ── Trust proxy (required for rate-limiter behind load balancers / Render)
app.set('trust proxy', 1);

// ── Security Headers (Helmet)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow Cloudinary images
}));

// ── CORS — Robust configuration to allow absolutely any origin and custom headers
const corsOptions = {
  origin: (origin, callback) => {
    // Dynamically echo the requesting origin back to support credentials.
    // If no origin is provided (e.g. server-to-server or curl), fallback to '*'
    callback(null, origin || '*');
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  // Omit allowedHeaders to dynamically reflect and allow any request headers sent by the client,
  // preventing preflight CORS failures from new or custom headers (e.g., X-Customer-Token).
};

app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Global rate limiter (200 req / 15 min per IP)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

// ── Routes
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/combos', comboRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/pages', pageRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/promos', promoRoutes);
app.use('/api/settings', siteSettingsRoutes);

// ── Health check
app.get('/', (req, res) => res.json({
  status: 'ok',
  message: 'Madiha Perfume API running',
  env: process.env.NODE_ENV,
}));

// ── 404 fallback
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// ── Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(status).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);

  // ── Render Keep-Alive (Self-ping every 14 minutes)
  const SERVER_URL = process.env.SERVER_URL;
  if (SERVER_URL) {
    console.log(`🚀 Keep-alive initialized for: ${SERVER_URL}`);
    setInterval(async () => {
      try {
        const https = await import('https');
        https.get(SERVER_URL, (res) => {
          console.log(`📡 Self-ping [${new Date().toLocaleTimeString()}]: ${res.statusCode}`);
        }).on('error', (err) => {
          console.error(`❌ Self-ping failed: ${err.message}`);
        });
      } catch (err) {
        console.error('❌ Could not import https for self-ping');
      }
    }, 14 * 60 * 1000); // 14 mins
  }
});
