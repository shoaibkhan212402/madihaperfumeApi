import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import fs from 'fs-extra';
import path from 'path';
import AdmZip from 'adm-zip';
import WhatsAppSession from '../models/WhatsAppSession.js';

let client;
export let waStatus = 'INITIALIZING';
export let waQrCode = null;

const AUTH_PATH = path.join(process.cwd(), '.wwebjs_auth');

const saveSessionToDb = async () => {
  try {
    if (!fs.existsSync(AUTH_PATH)) return;
    const zip = new AdmZip();
    zip.addLocalFolder(AUTH_PATH);
    const base64 = zip.toBuffer().toString('base64');
    
    await WhatsAppSession.findOneAndUpdate(
      { sessionName: 'madiha_master' },
      { sessionData: base64, lastUpdated: new Date() },
      { upsert: true }
    );
    console.log('[WhatsApp] Session synced to Database ✅');
  } catch (err) {
    console.error('[WhatsApp] Failed to sync session to DB:', err);
  }
};

const loadSessionFromDb = async () => {
  try {
    const session = await WhatsAppSession.findOne({ sessionName: 'madiha_master' });
    if (!session) return false;
    
    console.log('[WhatsApp] Restoring session from Database...');
    const zip = new AdmZip(Buffer.from(session.sessionData, 'base64'));
    
    if (fs.existsSync(AUTH_PATH)) {
      fs.removeSync(AUTH_PATH);
    }
    
    zip.extractAllTo(AUTH_PATH, true);
    console.log('[WhatsApp] Session restored successfully ✅');
    return true;
  } catch (err) {
    console.error('[WhatsApp] Failed to load session from DB:', err);
    return false;
  }
};

export const initWhatsApp = async () => {
  waStatus = 'INITIALIZING';
  waQrCode = null;

  // Try to restore from DB if local auth is missing
  if (!fs.existsSync(AUTH_PATH)) {
    await loadSessionFromDb();
  }

  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      // Use local Chrome on Windows, or standard path on Linux/Hosting
      executablePath: process.platform === 'win32' 
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' 
        : undefined, // Let Puppeteer find it or use environment-specific path
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    }
  });

  client.on('qr', (qr) => {
    console.log('[WhatsApp] QR Code generated! Please scan from Admin Panel.');
    waQrCode = qr;
    waStatus = 'QR_READY';
  });

  client.on('ready', async () => {
    console.log('[WhatsApp] Client is ready! OTPs can now be sent via WhatsApp.');
    waStatus = 'READY';
    waQrCode = null;
    
    // Save to DB after a short delay to ensure files are written
    setTimeout(saveSessionToDb, 10000);
  });

  client.on('authenticated', () => {
    console.log('[WhatsApp] Authenticated successfully!');
    waStatus = 'AUTHENTICATED';
  });

  client.on('auth_failure', msg => {
    console.error('[WhatsApp] Authentication failed:', msg);
    waStatus = 'AUTH_FAILED';
  });

  client.on('disconnected', (reason) => {
    console.log('[WhatsApp] Client disconnected:', reason);
    waStatus = 'DISCONNECTED';
    waQrCode = null;
  });

  client.initialize().catch(err => {
    console.error('[WhatsApp] Failed to initialize client:', err);
    waStatus = 'ERROR';
  });
};

export const resetWhatsApp = async () => {
  console.log('[WhatsApp] Performing full system reset...');
  waStatus = 'RESETTING';
  waQrCode = null;
  
  try {
    if (client) {
      await client.destroy();
    }
  } catch (err) {
    console.error('[WhatsApp] Error destroying client:', err);
  }

  // Delete the LocalAuth directory and DB record to force a new QR code
  if (fs.existsSync(AUTH_PATH)) {
    fs.removeSync(AUTH_PATH);
    console.log('[WhatsApp] Wiped local session data.');
  }
  await WhatsAppSession.deleteOne({ sessionName: 'madiha_master' });
  console.log('[WhatsApp] Wiped database session data.');

  // Re-initialize
  setTimeout(() => {
    initWhatsApp();
  }, 2000);
  
  return true;
};

export const sendWhatsAppOtp = async (phone, otp) => {
  console.log(`[WhatsApp] Simulated sending OTP ${otp} to ${phone}`);
  
  if (waStatus !== 'READY' || !client) {
    console.log('[WhatsApp] Client not ready. Only simulating send.');
    return;
  }
  
  try {
    // Format phone number: remove non-digits
    let formattedPhone = phone.replace(/\D/g, '');
    
    // Auto-add India country code if length is 10
    if (formattedPhone.length === 10) {
      formattedPhone = '91' + formattedPhone;
    }
    
    formattedPhone += '@c.us';
    
    await client.sendMessage(formattedPhone, `Your Madiha Perfume verification code is: *${otp}*\n\nIt is valid for 10 minutes. Please do not share this code with anyone.`);
    console.log(`[WhatsApp] Successfully sent OTP to ${phone}`);
    return true;
  } catch (error) {
    console.error('[WhatsApp] Failed to send OTP:', error);
    return false;
  }
};
