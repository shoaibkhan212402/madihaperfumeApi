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
export let lastConnectedAt = null;   // Track when connection was established
export let connectionUpSince = null; // Track continuous uptime start

const AUTH_PATH = path.join(process.cwd(), 'baileys_auth_info');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ─── Reconnect Backoff ─────────────────────────────────────────────────────────
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY_MS = 120_000; // cap at 2 minutes
const MAX_RECONNECT_ATTEMPTS = 50;      // safety cap (will reset on success)

const getReconnectDelay = () => {
  // Exponential backoff: 2s, 4s, 8s, 16s, 32s, 64s, 120s max
  const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
  const delay = Math.min(2000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY_MS) + jitter;
  reconnectAttempts++;
  return delay;
};

const resetReconnectAttempts = () => { reconnectAttempts = 0; };

// ─── Debounced DB Sync ─────────────────────────────────────────────────────────
let dbSyncTimer = null;
const DEBOUNCE_DB_SYNC_MS = 5000; // Wait 5s after last creds change before syncing

const debouncedSaveSessionToDb = () => {
  if (dbSyncTimer) clearTimeout(dbSyncTimer);
  dbSyncTimer = setTimeout(async () => {
    dbSyncTimer = null;
    await saveSessionToDb();
  }, DEBOUNCE_DB_SYNC_MS);
};

// ─── Connection Watchdog ────────────────────────────────────────────────────────
let watchdogTimer = null;
let lastConnectionEventAt = Date.now();
const WATCHDOG_INTERVAL_MS = 90_000;      // Check every 90 seconds
const WATCHDOG_STALE_THRESHOLD_MS = 300_000; // 5 minutes without any event = stale

const startWatchdog = () => {
  stopWatchdog();
  watchdogTimer = setInterval(() => {
    if (waStatus !== 'READY') return; // Only check when we think we're connected

    const elapsed = Date.now() - lastConnectionEventAt;
    if (elapsed > WATCHDOG_STALE_THRESHOLD_MS) {
      console.log(`[WhatsApp] 🐕 Watchdog: No activity for ${Math.round(elapsed / 1000)}s — connection may be dead. Forcing reconnect.`);
      scheduleReconnect(false); // Don't wipe session
    }
  }, WATCHDOG_INTERVAL_MS);
};

const stopWatchdog = () => {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
};

// ─── Status Flap Prevention ────────────────────────────────────────────────────
let statusFlapTimer = null;
const STATUS_FLAP_DELAY_MS = 4000; // Don't show DISCONNECTED if we reconnect within 4s

const setStatusWithFlapGuard = (newStatus) => {
  // For DISCONNECTED status, delay the update to prevent flapping
  if (newStatus === 'DISCONNECTED') {
    if (statusFlapTimer) return; // Already pending
    statusFlapTimer = setTimeout(() => {
      statusFlapTimer = null;
      // Only set to DISCONNECTED if we haven't reconnected in the meantime
      if (waStatus !== 'READY') {
        waStatus = 'DISCONNECTED';
      }
    }, STATUS_FLAP_DELAY_MS);
    return;
  }

  // For all other statuses, cancel any pending DISCONNECTED and apply immediately
  if (statusFlapTimer) {
    clearTimeout(statusFlapTimer);
    statusFlapTimer = null;
  }
  waStatus = newStatus;
};

// ─── Reconnect Scheduler (prevents duplicate reconnects) ────────────────────────
let reconnectTimer = null;
let isReconnecting = false;

const scheduleReconnect = (wipeSession = false) => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(`[WhatsApp] ❌ Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up. Use Admin Panel to reset.`);
    waStatus = 'ERROR';
    waError = `Max reconnect attempts reached. Please perform a manual reset from the Admin Panel.`;
    return;
  }

  if (wipeSession) {
    // Wipe auth and restart with fresh QR
    console.log('[WhatsApp] 🗑️  Wiping session — will require new QR scan.');
    cleanupSocket();
    try { fs.removeSync(AUTH_PATH); } catch (_) {}
    WhatsAppSession.deleteOne({ sessionName: 'madiha_master' }).catch(() => {});
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      initWhatsApp();
    }, 3000);
  } else {
    // Just reconnect — keep session intact
    const delay = getReconnectDelay();
    console.log(`[WhatsApp] 🔁 Reconnecting in ${Math.round(delay / 1000)}s... (attempt #${reconnectAttempts})`);
    cleanupSocket();
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      initWhatsApp();
    }, delay);
  }
};

// ─── Clean Socket Teardown ──────────────────────────────────────────────────────
const cleanupSocket = () => {
  if (!sock) return;
  try {
    // Remove all listeners to prevent ghost events
    sock.ev.removeAllListeners('connection.update');
    sock.ev.removeAllListeners('creds.update');
    sock.ev.removeAllListeners('messages.upsert');
  } catch (_) {}
  try {
    sock.end();
  } catch (_) {}
  try {
    // Force-close the underlying WebSocket if still open
    if (sock.ws && sock.ws.close) sock.ws.close();
  } catch (_) {}
  sock = null;
};

// ─── DB Session Helpers ────────────────────────────────────────────────────────
const saveSessionToDb = async () => {
  try {
    if (!fs.existsSync(AUTH_PATH)) return;

    // Check if folder has any actual files
    const files = fs.readdirSync(AUTH_PATH);
    if (files.length === 0) return;

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

// ─── Disconnect Reason Classifier ──────────────────────────────────────────────
const shouldWipeSession = (statusCode) => {
  // ONLY wipe session for genuinely fatal auth errors
  // These are the ONLY codes that mean "your session is permanently invalid"
  const FATAL_CODES = [
    DisconnectReason.loggedOut,    // 515 — user logged out from phone
    DisconnectReason.badSession,   // 500 — session file is corrupted
    DisconnectReason.multideviceMismatch, // 411 — device mismatch
  ];
  return FATAL_CODES.includes(statusCode);
};

const getDisconnectLabel = (statusCode) => {
  const labels = {
    [DisconnectReason.badSession]: 'Bad Session (corrupted)',
    [DisconnectReason.connectionClosed]: 'Connection Closed (server)',
    [DisconnectReason.connectionLost]: 'Connection Lost (network)',
    [DisconnectReason.connectionReplaced]: 'Connection Replaced (another device)',
    [DisconnectReason.loggedOut]: 'Logged Out (from phone)',
    [DisconnectReason.restartRequired]: 'Restart Required',
    [DisconnectReason.timedOut]: 'Timed Out',
    [DisconnectReason.multideviceMismatch]: 'Multi-Device Mismatch',
  };
  return labels[statusCode] || `Unknown (${statusCode})`;
};

// ─── Main Init ─────────────────────────────────────────────────────────────────
export const initWhatsApp = async () => {
  if (isReconnecting) {
    console.log('[WhatsApp] ⏳ Init already in progress, skipping duplicate call.');
    return;
  }
  isReconnecting = true;

  waQrCode = null;
  waError = null;
  setStatusWithFlapGuard('INITIALIZING');
  stopWatchdog();
  cleanupSocket();

  try {
    // On production (Render): ALWAYS try DB first — filesystem is ephemeral.
    // On development: only restore from DB if local folder is missing.
    const hasLocalAuth = fs.existsSync(AUTH_PATH) && fs.readdirSync(AUTH_PATH).length > 0;
    const shouldRestoreFromDb = IS_PRODUCTION || !hasLocalAuth;

    if (shouldRestoreFromDb) {
      await loadSessionFromDb();
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_PATH);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`[WhatsApp] 🌐 Connecting to WA Web v${version.join('.')} (isLatest: ${isLatest})`);

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: Browsers.ubuntu('Desktop'),
      // ── Connection stability settings ──
      connectTimeoutMs: 60_000,
      keepAliveIntervalMs: 25_000,    // Ping WA servers every 25s
      retryRequestDelayMs: 2000,
      defaultQueryTimeoutMs: 60_000,  // Don't timeout queries too fast
      emitOwnEvents: false,           // Reduce unnecessary event noise
      markOnlineOnConnect: true,       // Mark as online to keep session alive
    });

    // ── Save creds with proper debouncing ──────────────────────────────────
    sock.ev.on('creds.update', async () => {
      await saveCreds();
      lastConnectionEventAt = Date.now(); // Track activity
      debouncedSaveSessionToDb(); // Properly debounced — no overlapping writes
    });

    // ── Connection state handler ───────────────────────────────────────────
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      lastConnectionEventAt = Date.now(); // Track activity for watchdog

      // ── QR Code ready ──
      if (qr) {
        waQrCode = qr;
        setStatusWithFlapGuard('QR_READY');
        console.log('[WhatsApp] 📱 QR Code ready — scan from Admin Panel (/admin/whatsapp).');
      }

      // ── Connection closed ──
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = getDisconnectLabel(statusCode);
        const isFatal = shouldWipeSession(statusCode);

        console.log(`[WhatsApp] ⚡ Connection closed | Reason: ${reason} | Fatal: ${isFatal}`);

        waQrCode = null;
        connectionUpSince = null;

        if (isFatal) {
          // Session is genuinely dead — wipe and show new QR
          waStatus = 'AUTH_FAILED';
          waError = `Session expired: ${reason}. Please scan a new QR code.`;
          console.log('[WhatsApp] ⚠️ Fatal disconnect — wiping session.');
          resetReconnectAttempts(); // Reset backoff for fresh start
          scheduleReconnect(true); // wipe = true
        } else {
          // Temporary disconnect — reconnect WITHOUT wiping session
          setStatusWithFlapGuard('DISCONNECTED');
          waError = null; // Don't show error for temporary disconnects
          console.log('[WhatsApp] 🔄 Temporary disconnect — will reconnect with session intact.');
          scheduleReconnect(false); // wipe = false — KEEP the session!
        }
      }

      // ── Connection open ──
      if (connection === 'open') {
        const now = new Date();
        console.log(`[WhatsApp] ✅ Connected successfully at ${now.toLocaleTimeString()}! OTPs will be delivered via WhatsApp.`);

        setStatusWithFlapGuard('READY');
        waQrCode = null;
        waError = null;
        lastConnectedAt = now;
        connectionUpSince = now;
        resetReconnectAttempts(); // Reset backoff on successful connection

        // Save session to DB (debounced)
        debouncedSaveSessionToDb();

        // Start watchdog to detect silent deaths
        startWatchdog();
      }
    });

    // ── Track message activity for watchdog ────────────────────────────────
    sock.ev.on('messages.upsert', () => {
      lastConnectionEventAt = Date.now();
    });

    isReconnecting = false;

  } catch (err) {
    isReconnecting = false;
    console.error('[WhatsApp] ❌ Critical initialization error:', err.message || err);
    waStatus = 'ERROR';
    waError = err.message || err.toString();

    // Retry with backoff — don't let a startup error permanently kill WhatsApp
    scheduleReconnect(false);
  }
};

// ─── Reset (Admin Panel) ────────────────────────────────────────────────────────
export const resetWhatsApp = async () => {
  console.log('[WhatsApp] 🔄 Performing full system reset...');
  waStatus = 'RESETTING';
  waQrCode = null;
  waError = null;
  lastConnectedAt = null;
  connectionUpSince = null;
  resetReconnectAttempts();
  stopWatchdog();

  // Cancel any pending reconnect
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (dbSyncTimer) {
    clearTimeout(dbSyncTimer);
    dbSyncTimer = null;
  }
  isReconnecting = false;

  // Gracefully close existing socket
  cleanupSocket();

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
    lastConnectionEventAt = Date.now(); // Track activity
    return true;
  } catch (error) {
    console.error(`[WhatsApp] ❌ Failed to send OTP to ${phone}:`, error.message || error);

    // If sending failed with a connection error, trigger reconnect
    const errMsg = (error.message || '').toLowerCase();
    if (errMsg.includes('connection') || errMsg.includes('not open') || errMsg.includes('timed out')) {
      console.log('[WhatsApp] 🔄 Send failure suggests broken connection — triggering reconnect.');
      setStatusWithFlapGuard('DISCONNECTED');
      scheduleReconnect(false);
    }

    return false;
  }
};

// ─── Uptime Helper (exported for route) ─────────────────────────────────────────
export const getUptimeSeconds = () => {
  if (!connectionUpSince || waStatus !== 'READY') return 0;
  return Math.floor((Date.now() - connectionUpSince.getTime()) / 1000);
};

// ─── Graceful Shutdown ──────────────────────────────────────────────────────────
const gracefulShutdown = async (signal) => {
  console.log(`[WhatsApp] 🛑 ${signal} received — saving session before exit...`);
  stopWatchdog();

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  // Force an immediate DB sync (bypass debounce)
  if (dbSyncTimer) {
    clearTimeout(dbSyncTimer);
    dbSyncTimer = null;
  }

  try {
    await saveSessionToDb();
    console.log('[WhatsApp] ✅ Session saved to DB before shutdown.');
  } catch (err) {
    console.error('[WhatsApp] ❌ Failed to save session on shutdown:', err.message);
  }

  cleanupSocket();
};

// Register shutdown hooks — save session before process dies
process.on('SIGTERM', () => gracefulShutdown('SIGTERM').then(() => process.exit(0)));
process.on('SIGINT', () => gracefulShutdown('SIGINT').then(() => process.exit(0)));
