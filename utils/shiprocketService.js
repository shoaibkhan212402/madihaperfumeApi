// ── Shiprocket API integration (https://apiv2.shiprocket.in) ──────────────
// Auth is email/password based — Shiprocket has no static API key. We log in
// once, cache the bearer token in memory, and re-authenticate on expiry/401.

const BASE_URL = 'https://apiv2.shiprocket.in/v1/external';
const TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000; // Shiprocket tokens last ~10 days; refresh a day early

let cachedToken = null;
let tokenExpiresAt = 0;

async function authenticate() {
  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;
  if (!email || !password) {
    throw new Error('Shiprocket credentials are not configured (SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD)');
  }

  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();

  if (!res.ok || !data.token) {
    throw new Error(data.message || 'Shiprocket authentication failed');
  }

  cachedToken = data.token;
  tokenExpiresAt = Date.now() + TOKEN_TTL_MS;
  return cachedToken;
}

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  return authenticate();
}

async function shiprocketGet(path, retryOn401 = true) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401 && retryOn401) {
    cachedToken = null; // force a fresh login and retry exactly once
    return shiprocketGet(path, false);
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `Shiprocket API error (${res.status})`);
  }
  return data;
}

function normalizeTracking(raw) {
  const trackingData = raw?.tracking_data;
  if (!trackingData) return null;

  const shipment = Array.isArray(trackingData.shipment_track) ? trackingData.shipment_track[0] : null;
  const activities = trackingData.shipment_track_activities || [];

  const timeline = activities
    .map((a) => ({
      label: a.status || a.activity || 'Update',
      description: a.activity || a.status || '',
      date: a.date ? new Date(a.date.replace(' ', 'T')) : null,
      location: a.location || '',
      done: true,
    }))
    .filter((step) => step.date)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    courier: shipment?.courier_name || null,
    trackingNumber: shipment?.awb_code || null,
    currentStatus: shipment?.current_status || null,
    estimatedDelivery: shipment?.edd || trackingData.etd || null,
    trackingUrl: trackingData.track_url || null,
    timeline,
  };
}

// ── Track a shipment by AWB code (preferred) or Shiprocket shipment ID
export async function trackShiprocketShipment({ awbCode, shipmentId }) {
  if (!awbCode && !shipmentId) return null;

  const raw = awbCode
    ? await shiprocketGet(`/courier/track/awb/${encodeURIComponent(awbCode)}`)
    : await shiprocketGet(`/courier/track/shipment/${encodeURIComponent(shipmentId)}`);

  return normalizeTracking(raw);
}

// ── Verify SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD actually authenticate
export async function checkShiprocketConnection() {
  try {
    cachedToken = null; // force a real login attempt, not a cached token
    await authenticate();
    return { connected: true };
  } catch (err) {
    return { connected: false, message: err.message };
  }
}
