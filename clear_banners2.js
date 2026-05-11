import dotenv from 'dotenv';
dotenv.config();
import connectDB from './config/db.js';
import Banner from './models/Banner.js';

const run = async () => {
  await connectDB();
  await Banner.updateMany({}, { 
    $set: { 
      eyebrow: '', 
      subtitle: '', 
      title: { first: '', second: '' },
      cta2Label: '',
      cta2Link: ''
    } 
  });
  console.log('✅ Cleared CTA2 and remaining text from all banners in DB');
  process.exit(0);
};

run();
