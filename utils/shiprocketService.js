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

async function shiprocketPost(path, body, retryOn401 = true) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.status === 401 && retryOn401) {
    cachedToken = null;
    return shiprocketPost(path, body, false);
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

// ── Automatically create a Shiprocket order + assign courier when payment is confirmed.
// Returns { shiprocketOrderId, shiprocketShipmentId, awbCode, courierName } on success.
export async function createShiprocketOrder(order) {
  // ── 1. Create Order in Shiprocket
  const orderDate = new Date(order.createdAt).toISOString().replace('T', ' ').slice(0, 19);
  const pickupLocation = process.env.SHIPROCKET_PICKUP_LOCATION || 'Primary';

  const srOrderPayload = {
    order_id:    order._id.toString(),
    order_date:  orderDate,
    pickup_location: pickupLocation,

    // Billing = Shipping (same address for direct-to-customer e-commerce)
    billing_customer_name: order.firstName,
    billing_last_name:     order.lastName || '',
    billing_address:       order.address,
    billing_city:          order.city,
    billing_pincode:       order.postalCode,
    billing_state:         order.state || '',
    billing_country:       order.country || 'India',
    billing_email:         order.paymentEmail || 'customer@madihaperfume.com',
    billing_phone:         order.phone || '9999999999',
    billing_alternate_phone: order.phone || '',

    shipping_is_billing: true,

    order_items: order.orderItems.map((item) => ({
      name:          item.name,
      selling_price: item.price,
      units:         item.qty,
      sku:           item.product?.toString() || item.productRef || `SKU-${Date.now()}`,
      hsn:           '33030090', // HSN code for perfumes/attars in India
    })),

    payment_method: order.paymentMethod === 'COD' ? 'COD' : 'Prepaid',
    sub_total:      order.totalPrice,
    length:         15,   // cm — default box size for perfume packages
    breadth:        10,
    height:         10,
    weight:         0.5,  // kg — default weight
  };

  const srOrder = await shiprocketPost('/orders/create/adhoc', srOrderPayload);

  const shiprocketOrderId    = srOrder.order_id?.toString()    || srOrder.payload?.order_id?.toString();
  const shiprocketShipmentId = srOrder.shipment_id?.toString() || srOrder.payload?.shipment_id?.toString();

  if (!shiprocketOrderId) {
    throw new Error(`Shiprocket order creation failed: ${JSON.stringify(srOrder)}`);
  }

  // ── 2. Auto-assign best courier & generate AWB
  const assignPayload = {
    shipment_id: [Number(shiprocketShipmentId)],
  };

  let awbCode = null;
  let courierName = null;

  try {
    const assignRes = await shiprocketPost('/courier/assign/awb', assignPayload);
    awbCode     = assignRes?.response?.data?.awb_code || assignRes?.awb_code || null;
    courierName = assignRes?.response?.data?.courier_name || assignRes?.courier_name || null;
  } catch (assignErr) {
    // AWB assignment may fail if courier serviceability hasn't been configured yet.
    // Order is still created in Shiprocket — admin can assign courier from dashboard.
    console.warn('[Shiprocket] AWB auto-assign failed (order created):', assignErr.message);
  }

  return { shiprocketOrderId, shiprocketShipmentId, awbCode, courierName };
}
