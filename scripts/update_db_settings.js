import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const updateSettings = async () => {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is missing from .env');
    }
    
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.DATABASE_URL);
    
    const db = mongoose.connection.db;
    
    const whyUs = [
      { icon: "🌹", title: "100% Pure Ingredients", desc: "No synthetic fillers. Only the finest oud, saffron, musk and rose extracts from the world's best sources.", isActive: true },
      { icon: "🏆", title: "Master Perfumers", desc: "Blended by craftsmen with over 20 years of experience in authentic Arabian perfumery traditions.", isActive: true },
      { icon: "📦", title: "Luxury Packaging", desc: "Every order arrives in premium gift-ready packaging at no extra cost — perfect for gifting.", isActive: true },
      { icon: "✈️", title: "Pan-India Delivery", desc: "Fast, reliable shipping to all 28 states and UTs across India, delivered in 2–5 business days.", isActive: true },
      { icon: "💛", title: "50,000+ Happy Customers", desc: "Trusted by fragrance lovers across India and abroad since 2019. Our reviews speak for themselves.", isActive: true },
      { icon: "💬", title: "WhatsApp Support", desc: "Need assistance with your order? Our support team is here to help you 24/7.", isActive: true },
    ];

    const trustBar = [
      { icon: "🚚", label: "Free Shipping on Prepaid", isActive: true },
      { icon: "🛡️", label: "100% Authentic Fragrances", isActive: true },
      { icon: "💬", label: "WhatsApp Support", isActive: true },
    ];

    console.log('📝 Updating SiteSettings document...');
    const result = await db.collection('sitesettings').updateOne({}, {
      $set: {
        whyUs: whyUs,
        trustBar: trustBar
      }
    });

    if (result.matchedCount === 0) {
      console.log('⚠️ No existing SiteSettings document found to update.');
    } else {
      console.log('✅ SiteSettings document updated successfully!');
    }
  } catch (err) {
    console.error('❌ Error during update:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from DB.');
    process.exit(0);
  }
};

updateSettings();
