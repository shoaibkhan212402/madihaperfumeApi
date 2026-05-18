import mongoose from 'mongoose';
import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const wipeSession = async () => {
  console.log('🔄 Starting WhatsApp session reset...');
  
  // 1. Wipe local folder
  const authPath = path.join(process.cwd(), 'baileys_auth_info');
  if (fs.existsSync(authPath)) {
    console.log(`🗑️ Deleting local folder: ${authPath}`);
    fs.removeSync(authPath);
  } else {
    console.log('✅ Local auth folder already clean.');
  }

  // 2. Wipe MongoDB Session
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is missing from .env');
    }
    
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.DATABASE_URL);
    
    console.log('🗑️ Dropping WhatsAppSession from DB...');
    await mongoose.connection.db.collection('whatsappsessions').deleteMany({});
    
    console.log('✅ MongoDB session fully wiped.');
  } catch (err) {
    console.error('❌ MongoDB error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from DB.');
  }
  
  console.log('\n🎉 Reset Complete! Please restart your backend server.');
  process.exit(0);
};

wipeSession();
