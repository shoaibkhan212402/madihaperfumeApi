import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs-extra';
import path from 'path';
import AdmZip from 'adm-zip';
import WhatsAppSession from '../models/WhatsAppSession.js';

let sock;
export let waStatus = 'INITIALIZING';
export let waQrCode = null;
export let waError = null;

const AUTH_PATH = path.join(process.cwd(), 'baileys_auth_info');

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
    if (err.code === 'EBUSY') {
      console.log('[WhatsApp] DB Sync skipped (files locked by Baileys - normal on Windows).');
    } else {
      console.error('[WhatsApp] Failed to sync session to DB:', err.message);
    }
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
    console.error('[WhatsApp] Failed to load session from DB:', err.message);
    return false;
  }
};

export const initWhatsApp = async () => {
  waStatus = 'INITIALIZING';
  waQrCode = null;
  waError = null;

  try {
    if (!fs.existsSync(AUTH_PATH)) {
      await loadSessionFromDb();
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_PATH);

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }), // Disable noisy logs
      browser: ['Madiha Perfume', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', async () => {
      await saveCreds();
      // Sync to DB when credentials update
      setTimeout(saveSessionToDb, 2000);
    });

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        waQrCode = qr;
        waStatus = 'QR_READY';
        console.log('[WhatsApp] QR Code generated! Please scan from Admin Panel.');
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('[WhatsApp] Connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
        
        waStatus = 'DISCONNECTED';
        waQrCode = null;

        if (shouldReconnect) {
          initWhatsApp();
        } else {
          waStatus = 'AUTH_FAILED'; // Logged out
          fs.removeSync(AUTH_PATH);
          WhatsAppSession.deleteOne({ sessionName: 'madiha_master' }).catch(()=>{});
        }
      } else if (connection === 'open') {
        console.log('[WhatsApp] Authenticated successfully! OTPs can now be sent.');
        waStatus = 'READY';
        waQrCode = null;
        setTimeout(saveSessionToDb, 2000);
      }
    });

  } catch (err) {
    console.error('[WhatsApp] Critical initialization error:', err);
    waStatus = 'ERROR';
    waError = err.message || err.toString();
  }
};

export const resetWhatsApp = async () => {
  console.log('[WhatsApp] Performing full system reset...');
  waStatus = 'RESETTING';
  waQrCode = null;
  waError = null;
  
  if (sock) {
    try {
      sock.logout();
    } catch(err){}
  }

  try {
    if (fs.existsSync(AUTH_PATH)) {
      fs.removeSync(AUTH_PATH);
    }
    await WhatsAppSession.deleteOne({ sessionName: 'madiha_master' });
  } catch (err) {}

  setTimeout(() => {
    initWhatsApp();
  }, 2000);
  
  return true;
};

export const sendWhatsAppOtp = async (phone, otp) => {
  console.log(`[WhatsApp] Sending OTP ${otp} to ${phone}`);
  
  if (waStatus !== 'READY' || !sock) {
    console.log('[WhatsApp] Client not ready. Only simulating send.');
    return;
  }
  
  try {
    let formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.length === 10) formattedPhone = '91' + formattedPhone;
    formattedPhone += '@s.whatsapp.net';
    
    await sock.sendMessage(formattedPhone, { 
      text: `Your Madiha Perfume verification code is: *${otp}*\n\nIt is valid for 10 minutes. Please do not share this code with anyone.` 
    });
    console.log(`[WhatsApp] Successfully sent OTP to ${phone}`);
    return true;
  } catch (error) {
    console.error('[WhatsApp] Failed to send OTP:', error);
    return false;
  }
};
