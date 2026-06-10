import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs-extra';
import path from 'path';
import AdmZip from 'adm-zip';
import WhatsAppSession from '../models/WhatsAppSession.js';

// ─── Constants ──────────────────────────────────────────────────────────────────
const AUTH_PATH        = path.join(process.cwd(), 'baileys_auth_info');
const IS_PRODUCTION    = process.env.NODE_ENV === 'production';
const SESSION_NAME     = 'madiha_master';

// Reconnect policy
const MAX_RECONNECT_ATTEMPTS  = 60;        // Give up after 60 consecutive failures
const MAX_RECONNECT_DELAY_MS  = 180_000;   // Cap at 3 minutes
const BASE_RECONNECT_DELAY_MS = 2_000;     // Start at 2 s

// Watchdog
const WATCHDOG_INTERVAL_MS       = 60_000;    // Check every 60 s
const WATCHDOG_STALE_THRESHOLD_MS = 240_000;  // 4 minutes silence = stale

// Status flap guard
const STATUS_FLAP_DELAY_MS = 5_000;

// DB sync debounce
const DEBOUNCE_DB_SYNC_MS = 8_000;

// ─── Exported State ─────────────────────────────────────────────────────────────
let sock = null;
export let waStatus         = 'INITIALIZING';
export let waQrCode         = null;
export let waError          = null;
export let lastConnectedAt  = null;
export let connectionUpSince = null;

// ─── Internal State ──────────────────────────────────────────────────────────────
let reconnectAttempts    = 0;
let isReconnecting       = false;
let reconnectTimer       = null;
let dbSyncTimer          = null;
let watchdogTimer        = null;
let statusFlapTimer      = null;
let lastConnectionEventAt = Date.now();

// ─── Helpers ────────────────────────────────────────────────────────────────────

const resetReconnectAttempts = () => { reconnectAttempts = 0; };

const getReconnectDelay = () => {
  // Exponential backoff with ±500 ms jitter
  const base = BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts);
  const jitter = (Math.random() - 0.5) * 1000;
  reconnectAttempts++;
  return Math.min(base + jitter, MAX_RECONNECT_DELAY_MS);
};

// ─── Status Helper ───────────────────────────────────────────────────────────────
const setStatus = (newStatus) => {
  if (newStatus === 'DISCONNECTED') {
    if (statusFlapTimer) return; // already pending
    statusFlapTimer = setTimeout(() => {
      statusFlapTimer = null;
      if (waStatus !== 'READY') waStatus = 'DISCONNECTED';
    }, STATUS_FLAP_DELAY_MS);
    return;
  }
  if (statusFlapTimer) { clearTimeout(statusFlapTimer); statusFlapTimer = null; }
  waStatus = newStatus;
};

// ─── Socket Teardown ─────────────────────────────────────────────────────────────
const cleanupSocket = () => {
  if (!sock) return;
  try { sock.ev.removeAllListeners('connection.update'); } catch (_) {}
  try { sock.ev.removeAllListeners('creds.update');      } catch (_) {}
  try { sock.ev.removeAllListeners('messages.upsert');   } catch (_) {}
  try { sock.end(); }                                      catch (_) {}
  try { if (sock.ws?.close) sock.ws.close(); }             catch (_) {}
  sock = null;
};

// ─── Watchdog ────────────────────────────────────────────────────────────────────
const stopWatchdog = () => {
  if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = null; }
};

const startWatchdog = () => {
  stopWatchdog();
  watchdogTimer = setInterval(() => {
    if (waStatus !== 'READY') return;
    const elapsed = Date.now() - lastConnectionEventAt;
    if (elapsed > WATCHDOG_STALE_THRESHOLD_MS) {
      console.log(`[WhatsApp] 🐕 Watchdog: No activity for ${Math.round(elapsed / 1000)}s — forcing reconnect (NO session wipe).`);
      scheduleReconnect(false);
    }
  }, WATCHDOG_INTERVAL_MS);
};

// ─── DB Session Sync ─────────────────────────────────────────────────────────────

const saveSessionToDb = async () => {
  try {
    if (!fs.existsSync(AUTH_PATH)) return;
    const files = fs.readdirSync(AUTH_PATH);
    if (files.length === 0) return;

    const zip = new AdmZip();
    zip.addLocalFolder(AUTH_PATH);
    const base64 = zip.toBuffer().toString('base64');

    await WhatsAppSession.findOneAndUpdate(
      { sessionName: SESSION_NAME },
      { sessionData: base64, lastUpdated: new Date() },
      { upsert: true, new: true }
    );
    console.log('[WhatsApp] ✅ Session synced to MongoDB.');
  } catch (err) {
    if (err.code === 'EBUSY') {
      console.log('[WhatsApp] DB sync skipped — files locked by Baileys (normal on Windows).');
    } else {
      console.error('[WhatsApp] ❌ DB sync failed:', err.message);
    }
  }
};

const debouncedSaveSessionToDb = () => {
  if (dbSyncTimer) clearTimeout(dbSyncTimer);
  dbSyncTimer = setTimeout(async () => {
    dbSyncTimer = null;
    await saveSessionToDb();
  }, DEBOUNCE_DB_SYNC_MS);
};

const loadSessionFromDb = async () => {
  try {
    const session = await WhatsAppSession.findOne({ sessionName: SESSION_NAME });
    if (!session) {
      console.log('[WhatsApp] No saved session in DB. Will generate new QR.');
      return false;
    }
    console.log('[WhatsApp] 🔄 Restoring session from MongoDB...');
    if (fs.existsSync(AUTH_PATH)) fs.removeSync(AUTH_PATH);
    const zip = new AdmZip(Buffer.from(session.sessionData, 'base64'));
    zip.extractAllTo(AUTH_PATH, true);
    console.log('[WhatsApp] ✅ Session restored from DB.');
    return true;
  } catch (err) {
    console.error('[WhatsApp] ❌ DB restore failed:', err.message);
    return false;
  }
};

// ─── Disconnect Reason Logic ──────────────────────────────────────────────────────
//
//  VERIFIED codes from @whiskeysockets/baileys (as of 2025):
//
//  401 loggedOut          → user explicitly logged out from phone  ← FATAL
//  403 forbidden          → account banned / blocked               ← FATAL
//  408 timedOut/connLost  → network timeout                        ← RETRY
//  411 multideviceMismatch→ device pairing mismatch                ← FATAL
//  428 connectionClosed   → server closed connection               ← RETRY
//  440 connectionReplaced → another WA Web session opened          ← RETRY (don't wipe!)
//  500 badSession         → session file corrupted                 ← FATAL
//  503 unavailableService → WA servers temporarily unavailable     ← RETRY
//  515 restartRequired    → protocol version restart needed        ← RETRY (NOT logout!)
//
const FATAL_CODES = new Set([
  DisconnectReason.loggedOut,          // 401
  DisconnectReason.forbidden,          // 403
  DisconnectReason.badSession,         // 500
  DisconnectReason.multideviceMismatch,// 411
]);

const getDisconnectLabel = (code) => {
  const map = {
    [DisconnectReason.loggedOut]:           'Logged Out (user action from phone)',
    [DisconnectReason.forbidden]:           'Forbidden (account banned)',
    [DisconnectReason.timedOut]:            'Timed Out (network)',
    [DisconnectReason.connectionLost]:      'Connection Lost (network)',
    [DisconnectReason.connectionClosed]:    'Connection Closed (server)',
    [DisconnectReason.connectionReplaced]:  'Connection Replaced (another WA Web opened)',
    [DisconnectReason.badSession]:          'Bad Session (corrupted files)',
    [DisconnectReason.unavailableService]:  'WhatsApp Service Unavailable',
    [DisconnectReason.restartRequired]:     'Restart Required (protocol update)',
    [DisconnectReason.multideviceMismatch]: 'Multi-Device Mismatch',
  };
  return map[code] ?? `Unknown (code=${code})`;
};

// ─── Reconnect Scheduler ─────────────────────────────────────────────────────────
const scheduleReconnect = (wipeSession = false) => {
  // Cancel existing timer
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

  if (!wipeSession && reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(`[WhatsApp] ❌ Gave up after ${MAX_RECONNECT_ATTEMPTS} reconnect attempts. Use Admin Panel to reset.`);
    waStatus = 'ERROR';
    waError  = `Too many reconnect failures. Please use the Admin Panel to reset WhatsApp.`;
    return;
  }

  if (wipeSession) {
    console.log('[WhatsApp] 🗑️  Wiping session (fatal auth error) — you must scan a new QR code.');
    cleanupSocket();
    try { fs.removeSync(AUTH_PATH); } catch (_) {}
    WhatsAppSession.deleteOne({ sessionName: SESSION_NAME }).catch(() => {});
    resetReconnectAttempts();
    reconnectTimer = setTimeout(() => { reconnectTimer = null; initWhatsApp(); }, 3_000);
  } else {
    const delay = getReconnectDelay();
    console.log(`[WhatsApp] 🔁 Reconnecting in ${Math.round(delay / 1000)}s… (attempt #${reconnectAttempts})`);
    cleanupSocket();
    reconnectTimer = setTimeout(() => { reconnectTimer = null; initWhatsApp(); }, delay);
  }
};

// ─── Main Init ────────────────────────────────────────────────────────────────────
export const initWhatsApp = async () => {
  if (isReconnecting) {
    console.log('[WhatsApp] ⏳ Init already in progress — skipping duplicate call.');
    return;
  }
  isReconnecting = true;

  waQrCode = null;
  waError  = null;
  setStatus('INITIALIZING');
  stopWatchdog();
  cleanupSocket();

  try {
    // Production: Render filesystem is ephemeral — always restore from DB.
    // Development: Only restore from DB when local folder is missing/empty.
    const hasLocalAuth = fs.existsSync(AUTH_PATH) && fs.readdirSync(AUTH_PATH).length > 0;
    if (IS_PRODUCTION || !hasLocalAuth) {
      await loadSessionFromDb();
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_PATH);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`[WhatsApp] 🌐 WA Web v${version.join('.')} (isLatest: ${isLatest})`);

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: Browsers.ubuntu('Desktop'),

      // ── Connection stability ──
      connectTimeoutMs:       60_000,
      keepAliveIntervalMs:    20_000,   // Heartbeat every 20 s
      retryRequestDelayMs:    3_000,
      defaultQueryTimeoutMs:  60_000,
      emitOwnEvents:          false,
      markOnlineOnConnect:    true,

      // ── Retry logic inside Baileys itself ──
      maxMsgRetryCount:       5,

      // ── Ignore broadcast lists to reduce noise ──
      shouldIgnoreJid: (jid) => jid?.endsWith('@broadcast'),
    });

    // Save credentials whenever they change (key rotation, etc.)
    sock.ev.on('creds.update', async () => {
      await saveCreds();
      lastConnectionEventAt = Date.now();
      debouncedSaveSessionToDb();
    });

    // Main connection state handler
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      lastConnectionEventAt = Date.now();

      // ── QR ready ──
      if (qr) {
        waQrCode = qr;
        setStatus('QR_READY');
        console.log('[WhatsApp] 📱 QR Code ready — scan from Admin Panel (/admin/whatsapp).');
        return;
      }

      // ── Disconnected ──
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode
          ?? lastDisconnect?.error?.output?.payload?.statusCode
          ?? lastDisconnect?.error?.output?.data?.statusCode;

        const reason  = getDisconnectLabel(statusCode);
        const isFatal = FATAL_CODES.has(statusCode);

        console.log(`[WhatsApp] ⚡ Disconnected | Code: ${statusCode} | Reason: ${reason} | Fatal: ${isFatal}`);

        waQrCode         = null;
        connectionUpSince = null;

        if (isFatal) {
          waStatus = 'AUTH_FAILED';
          waError  = `Session terminated: ${reason}. Please scan a new QR code.`;
          console.warn('[WhatsApp] ⚠️  Fatal disconnect — wiping session.');
          scheduleReconnect(true);  // wipe = true
        } else {
          // ── Temporary disconnect — keep session, just reconnect ──
          setStatus('DISCONNECTED');
          waError = null;
          console.log('[WhatsApp] 🔄 Temporary disconnect — reconnecting with session intact…');
          scheduleReconnect(false); // wipe = false ← NEVER wipe for network errors
        }
      }

      // ── Connected ──
      if (connection === 'open') {
        const now = new Date();
        console.log(`[WhatsApp] ✅ Connected at ${now.toLocaleTimeString()}!`);

        setStatus('READY');
        waQrCode          = null;
        waError           = null;
        lastConnectedAt   = now;
        connectionUpSince = now;
        resetReconnectAttempts(); // ← reset backoff on success

        // Persist session to DB
        debouncedSaveSessionToDb();

        // Start watchdog
        startWatchdog();
      }

      // ── Connecting (useful for UI feedback) ──
      if (connection === 'connecting') {
        console.log('[WhatsApp] 🔌 Connecting to WhatsApp servers…');
      }
    });

    // Track inbound messages for watchdog liveness
    sock.ev.on('messages.upsert', () => {
      lastConnectionEventAt = Date.now();
    });

    isReconnecting = false;

  } catch (err) {
    isReconnecting = false;
    console.error('[WhatsApp] ❌ Initialization error:', err.message || err);
    waStatus = 'ERROR';
    waError  = err.message || err.toString();
    scheduleReconnect(false);
  }
};

// ─── Send OTP ──────────────────────────────────────────────────────────────────
export const sendWhatsAppOtp = async (phone, otp) => {
  console.log(`[WhatsApp] Sending OTP to ${phone} | Status: ${waStatus}`);

  if (waStatus !== 'READY' || !sock) {
    console.warn(`[WhatsApp] Not ready (status=${waStatus}). Skipping WhatsApp delivery.`);
    return false;
  }

  try {
    let formattedPhone = phone.replace(/\D/g, '');
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
      '_— Team Madiha Perfume_ 🌹',
    ].join('\n');

    await sock.sendMessage(jid, { text: message });
    console.log(`[WhatsApp] ✅ OTP sent to ${phone}`);
    lastConnectionEventAt = Date.now();
    return true;

  } catch (error) {
    console.error(`[WhatsApp] ❌ Failed to send OTP to ${phone}:`, error.message || error);

    // Network-level send failure → reconnect without wiping
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('connection') || msg.includes('not open') || msg.includes('timed out') || msg.includes('socket')) {
      console.log('[WhatsApp] 🔄 Send failure suggests broken connection — reconnecting (NO session wipe).');
      setStatus('DISCONNECTED');
      scheduleReconnect(false);
    }

    return false;
  }
};

// ─── Admin Reset ─────────────────────────────────────────────────────────────────
export const resetWhatsApp = async () => {
  console.log('[WhatsApp] 🔄 Admin-triggered full reset…');
  waStatus          = 'RESETTING';
  waQrCode          = null;
  waError           = null;
  lastConnectedAt   = null;
  connectionUpSince = null;
  isReconnecting    = false;

  resetReconnectAttempts();
  stopWatchdog();

  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (dbSyncTimer)    { clearTimeout(dbSyncTimer);    dbSyncTimer    = null; }
  if (statusFlapTimer){ clearTimeout(statusFlapTimer); statusFlapTimer = null; }

  cleanupSocket();

  try { if (fs.existsSync(AUTH_PATH)) fs.removeSync(AUTH_PATH); } catch (_) {}
  try { await WhatsAppSession.deleteOne({ sessionName: SESSION_NAME }); } catch (_) {}

  setTimeout(() => initWhatsApp(), 3_000);
  return true;
};

// ─── Uptime Helper ────────────────────────────────────────────────────────────────
export const getUptimeSeconds = () => {
  if (!connectionUpSince || waStatus !== 'READY') return 0;
  return Math.floor((Date.now() - connectionUpSince.getTime()) / 1000);
};

// ─── Graceful Shutdown ────────────────────────────────────────────────────────────
const gracefulShutdown = async (signal) => {
  console.log(`[WhatsApp] 🛑 ${signal} — saving session before exit…`);
  stopWatchdog();

  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (dbSyncTimer)    { clearTimeout(dbSyncTimer);    dbSyncTimer    = null; }

  try {
    await saveSessionToDb();
    console.log('[WhatsApp] ✅ Session saved to DB before shutdown.');
  } catch (err) {
    console.error('[WhatsApp] ❌ Failed to save session on shutdown:', err.message);
  }

  cleanupSocket();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM').then(() => process.exit(0)));
process.on('SIGINT',  () => gracefulShutdown('SIGINT').then(() => process.exit(0)));
process.on('uncaughtException', (err) => {
  console.error('[WhatsApp] 💥 Uncaught exception — attempting graceful save:', err.message);
  gracefulShutdown('uncaughtException').catch(() => {}).finally(() => process.exit(1));
});
