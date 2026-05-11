/**
 * Admin User Creation Script
 * Run with: node scripts/createAdmin.js
 * Usage: node scripts/createAdmin.js --email admin@madihaperfume.com --password YourPassword123
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import user from '../models/User.js';

dotenv.config();
connectDB();

// Parse command line args --key value style
const args = process.argv.slice(2);
const getArg = (key) => {
  const idx = args.indexOf(key);
  return idx !== -1 ? args[idx + 1] : null;
};

const email = getArg('--email') || 'admin@madihaperfume.com';
const password = getArg('--password') || 'Admin@1234';
const first = getArg('--first') || 'Madiha';
const last = getArg('--last') || 'Admin';

const createAdmin = async () => {
  try {
    const exists = await User.findOne({ email });

    if (exists) {
      if (exists.role !== 'ADMIN') {
        exists.role = 'ADMIN';
        await exists.save();
        console.log(`✅ User "${email}" upgraded to ADMIN role.`);
      } else {
        console.log(`ℹ️  Admin user "${email}" already exists.`);
      }
    } else {
      const admin = await User.create({
        firstName: first,
        lastName: last,
        email,
        password,
        role: 'ADMIN',
      });
      console.log(`✅ Admin user created successfully!`);
      console.log(`   Email:    ${admin.email}`);
      console.log(`   Password: ${password}`);
      console.log(`   Role:     ${admin.role}`);
    }

    console.log('\n🔐 Login at: http://localhost:3000/admin');
    process.exit(0);
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    process.exit(1);
  }
};

createAdmin();
