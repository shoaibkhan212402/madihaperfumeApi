import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import fs from 'fs';
import path from 'path';

let client;
export let waStatus = 'INITIALIZING';
export let waQrCode = null;

export const initWhatsApp = () => {
  waStatus = 'INITIALIZING';
  waQrCode = null;

  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
  });

  client.on('qr', (qr) => {
    console.log('[WhatsApp] QR Code generated! Please scan from Admin Panel.');
    waQrCode = qr;
    waStatus = 'QR_READY';
  });

  client.on('ready', () => {
    console.log('[WhatsApp] Client is ready! OTPs can now be sent via WhatsApp.');
    waStatus = 'READY';
    waQrCode = null;
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

  // Delete the LocalAuth directory to force a new QR code
  const authPath = path.join(process.cwd(), '.wwebjs_auth');
  if (fs.existsSync(authPath)) {
    fs.rmSync(authPath, { recursive: true, force: true });
    console.log('[WhatsApp] Wiped previous session data.');
  }

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
