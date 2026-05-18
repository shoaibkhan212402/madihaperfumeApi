import { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs-extra';
import path from 'path';
import AdmZip from 'adm-zip';
import WhatsAppSession from '../models/WhatsAppSession.js';

// ─── State ─────────────────────────────────────────────────────────────────────
let sock = null;
export let waStatus = 'INITIALIZING';
export let waQrCode = null;
export let waError = null;

const AUTH_PATH = path.join(process.cwd(), 'baileys_auth_info');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ─── Reconnect Backoff ─────────────────────────────────────────────────────────
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY_MS = 60_000; // cap at 60s

const getReconnectDelay = () => {
  // Exponential backoff: 3s, 6s, 12s, 24s, 48s, 60s max
  const delay = Math.min(3000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY_MS);
  reconnectAttempts++;
  return delay;
};

const resetReconnectAttempts = () => { reconnectAttempts = 0; };

// ─── DB Session Helpers ────────────────────────────────────────────────────────
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
    console.log('[WhatsApp] ✅ Session synced to MongoDB.');
  } catch (err) {
    if (err.code === 'EBUSY') {
      console.log('[WhatsApp] DB sync skipped — files locked by Baileys (normal on Windows).');
    } else {
      console.error('[WhatsApp] ❌ Failed to sync session to DB:', err.message);
    }
  }
};

const loadSessionFromDb = async () => {
  try {
    const session = await WhatsAppSession.findOne({ sessionName: 'madiha_master' });
    if (!session) {
      console.log('[WhatsApp] No saved session found in DB. A new QR will be generated.');
      return false;
    }

    console.log('[WhatsApp] 🔄 Restoring session from MongoDB...');

    // Always wipe local folder before extracting to avoid stale file conflicts
    if (fs.existsSync(AUTH_PATH)) {
      fs.removeSync(AUTH_PATH);
    }

    const zip = new AdmZip(Buffer.from(session.sessionData, 'base64'));
    zip.extractAllTo(AUTH_PATH, true);
    console.log('[WhatsApp] ✅ Session restored from DB successfully.');
    return true;
  } catch (err) {
    console.error('[WhatsApp] ❌ Failed to restore session from DB:', err.message);
    return false;
  }
};

// ─── Main Init ─────────────────────────────────────────────────────────────────
export const initWhatsApp = async () => {
  waStatus = 'INITIALIZING';
  waQrCode = null;
  waError = null;

  if (sock) {
    try { sock.end(undefined); } catch (_) {}
    sock = null;
  }

  try {
    // On production (Render): ALWAYS try DB first — filesystem is ephemeral.
    // On development: only restore from DB if local folder is missing.
    const shouldRestoreFromDb = IS_PRODUCTION || !fs.existsSync(AUTH_PATH);

    if (shouldRestoreFromDb) {
      await loadSessionFromDb();
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_PATH);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`[WhatsApp] 🌐 Connecting to WA Web version v${version.join('.')} (isLatest: ${isLatest})`);

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: Browsers.ubuntu('Desktop'),
      // Recommended Baileys settings for cloud hosting
      connectTimeoutMs: 60_000,
      keepAliveIntervalMs: 25_000,
      retryRequestDelayMs: 2000,
    });

    // ── Save creds whenever they update
    sock.ev.on('creds.update', async () => {
      await saveCreds();
      // Debounce DB sync so rapid credential updates don't hammer MongoDB
      setTimeout(saveSessionToDb, 3000);
    });

    // ── Connection state handler
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        waQrCode = qr;
        waStatus = 'QR_READY';
        console.log('[WhatsApp] 📱 QR Code ready — scan from Admin Panel (/admin/whatsapp).');
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const isBadSession = statusCode === DisconnectReason.badSession;
        const isInvalidSession = statusCode === 405 || statusCode === 401 || statusCode === 403 || statusCode === 500;

        console.log(`[WhatsApp] Connection closed. Code: ${statusCode} | LoggedOut: ${isLoggedOut}`);

        waStatus = 'DISCONNECTED';
        waQrCode = null;

        if (isLoggedOut || isBadSession || isInvalidSession) {
          // Session is invalid — wipe it and wait for a new QR scan
          waStatus = 'AUTH_FAILED';
          waError = 'Session invalid or expired (Code ' + statusCode + '). Please reset and re-scan the QR code.';

          console.log('[WhatsApp] ⚠️ Session invalid — clearing local and DB session.');
          try { fs.removeSync(AUTH_PATH); } catch (_) {}
          WhatsAppSession.deleteOne({ sessionName: 'madiha_master' }).catch(() => {});

          // Reinitialize after a short delay to show fresh QR
          setTimeout(() => initWhatsApp(), 5000);
        } else {
          // Network/temporary disconnect — reconnect with exponential backoff
          const delay = getReconnectDelay();
          console.log(`[WhatsApp] 🔁 Reconnecting in ${Math.round(delay / 1000)}s... (attempt #${reconnectAttempts})`);
          setTimeout(() => initWhatsApp(), delay);
        }
      }

      if (connection === 'open') {
        console.log('[WhatsApp] ✅ Connected! OTPs will now be delivered via WhatsApp.');
        waStatus = 'READY';
        waQrCode = null;
        waError = null;
        resetReconnectAttempts(); // Reset backoff counter on successful connection

        // Save the fresh session to DB
        setTimeout(saveSessionToDb, 3000);
      }
    });

  } catch (err) {
    console.error('[WhatsApp] ❌ Critical initialization error:', err);
    waStatus = 'ERROR';
    waError = err.message || err.toString();

    // Retry after backoff — don't let a startup error permanently kill WhatsApp
    const delay = getReconnectDelay();
    console.log(`[WhatsApp] Retrying initialization in ${Math.round(delay / 1000)}s...`);
    setTimeout(() => initWhatsApp(), delay);
  }
};

// ─── Reset (Admin Panel) ────────────────────────────────────────────────────────
export const resetWhatsApp = async () => {
  console.log('[WhatsApp] 🔄 Performing full system reset...');
  waStatus = 'RESETTING';
  waQrCode = null;
  waError = null;
  resetReconnectAttempts();

  // Gracefully close existing socket
  if (sock) {
    try { sock.end(undefined); } catch (_) {}
    sock = null;
  }

  // Wipe local auth folder
  try {
    if (fs.existsSync(AUTH_PATH)) fs.removeSync(AUTH_PATH);
  } catch (_) {}

  // Wipe DB session
  try {
    await WhatsAppSession.deleteOne({ sessionName: 'madiha_master' });
  } catch (_) {}

  // Fresh start after 3 seconds
  setTimeout(() => initWhatsApp(), 3000);
  return true;
};

// ─── Send OTP ──────────────────────────────────────────────────────────────────
export const sendWhatsAppOtp = async (phone, otp) => {
  console.log(`[WhatsApp] Attempting to send OTP to ${phone} | Status: ${waStatus}`);

  if (waStatus !== 'READY' || !sock) {
    console.warn(`[WhatsApp] Client not ready (status=${waStatus}). Skipping WhatsApp delivery.`);
    return false;
  }

  try {
    let formattedPhone = phone.replace(/\D/g, '');
    // Add India country code if 10-digit number
    if (formattedPhone.length === 10) formattedPhone = '91' + formattedPhone;
    const jid = formattedPhone + '@s.whatsapp.net';

    const message = [
      '🔔 *Madiha Perfume – Verification Code*',
      '',
      'Your one-time password (OTP) is:',
      '',
      `*${otp}*`,
      '',
      '⏱ Valid for *10 minutes* only.',
      '🔒 Do NOT share this code with anyone.',
      '',
      '_— Team Madiha Perfume_ 🌹'
    ].join('\n');

    await sock.sendMessage(jid, { text: message });
    console.log(`[WhatsApp] ✅ OTP successfully sent to ${phone}`);
    return true;
  } catch (error) {
    console.error(`[WhatsApp] ❌ Failed to send OTP to ${phone}:`, error.message || error);
    return false;
  }
};
