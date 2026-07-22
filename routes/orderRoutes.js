import express from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import Order from '../models/Order.js';
import Coupon from '../models/Coupon.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { trackShiprocketShipment, checkShiprocketConnection, createShiprocketOrder } from '../utils/shiprocketService.js';

const router = express.Router();

// ── Razorpay Instance
const cleanKeyId = (process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '').trim();
const cleanKeySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

const razorpay = new Razorpay({
  key_id:     cleanKeyId,
  key_secret: cleanKeySecret,
});

// ── POST /api/orders  Create order (authenticated)
router.post('/', protect, async (req, res) => {
  try {
    const {
      orderItems, shippingAddress, paymentMethod,
      itemsPrice, taxPrice, shippingPrice, totalPrice,
      couponCode, discountAmount,
    } = req.body;

    if (!orderItems || orderItems.length === 0)
      return res.status(400).json({ message: 'No order items' });

    const order = new Order({
      orderItems: orderItems.map((x) => {
        const isRealId = /^[0-9a-fA-F]{24}$/.test(x.productId || '');
        return {
          name:       x.name,
          qty:        x.qty,
          image:      x.image,
          price:      x.price,
          product:    isRealId ? x.productId : undefined,
          productRef: !isRealId ? x.productId : undefined,
        };
      }),
      user: req.user._id,
      firstName:     shippingAddress.firstName,
      lastName:      shippingAddress.lastName,
      phone:         shippingAddress.phone || '',
      address:       shippingAddress.address,
      city:          shippingAddress.city,
      state:         shippingAddress.state || '',
      postalCode:    shippingAddress.postalCode,
      country:       shippingAddress.country || 'India',
      paymentMethod,
      itemsPrice,
      taxPrice,
      shippingPrice,
      discountAmount: discountAmount || 0,
      totalPrice,
      couponCode:    couponCode || null,
    });

    const created = await order.save();

    // Increment coupon usedCount if a coupon was applied
    if (couponCode) {
      await Coupon.findOneAndUpdate(
        { code: couponCode.toUpperCase() },
        { $inc: { usedCount: 1 } }
      );
    }

    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});


// ── GET /api/orders/myorders  User's own orders
router.get('/myorders', protect, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/orders  Admin: all orders with filters  ← MUST come before /:id
router.get('/', protect, admin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status.toUpperCase();
    const skip   = (Number(page) - 1) * Number(limit);
    const total  = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    res.json({ orders, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/orders/:id/status  Admin: update status
router.patch('/:id/status', protect, admin, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status))
      return res.status(400).json({ message: 'Invalid status' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.status = status;
    if (status === 'DELIVERED') { order.isDelivered = true; order.deliveredAt = new Date(); }
    if (status === 'CANCELLED') { order.isPaid = false; }

    const updated = await order.save();
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── PATCH /api/orders/:id/pay  Mark order as paid (after Razorpay signature verification)
router.patch('/:id/pay', protect, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, paymentEmail } = req.body;

    // ── Verify Razorpay HMAC signature
    if (razorpay_order_id && razorpay_payment_id && razorpay_signature) {
      const generated = crypto
        .createHmac('sha256', cleanKeySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generated !== razorpay_signature) {
        return res.status(400).json({ message: 'Payment verification failed: invalid signature' });
      }
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.isPaid        = true;
    order.paidAt        = new Date();
    order.paymentId     = razorpay_payment_id || req.body.paymentId;
    order.paymentStatus = 'COMPLETED';
    order.paymentEmail  = paymentEmail;
    order.status        = 'PROCESSING';

    const updated = await order.save();
    res.json(updated);

    // ── Auto-push to Shiprocket after payment confirmed (fire-and-forget)
    // This runs AFTER the response is sent so customer is never delayed.
    setImmediate(async () => {
      try {
        const sr = await createShiprocketOrder(updated);
        await Order.findByIdAndUpdate(updated._id, {
          shiprocketOrderId:    sr.shiprocketOrderId,
          shiprocketShipmentId: sr.shiprocketShipmentId,
          awbCode:              sr.awbCode || undefined,
          courierName:          sr.courierName || undefined,
          status:               sr.awbCode ? 'SHIPPED' : 'PROCESSING',
        });
        console.log(`[Shiprocket] Order ${updated._id} pushed → SR Order: ${sr.shiprocketOrderId}, AWB: ${sr.awbCode}`);
      } catch (srErr) {
        console.error(`[Shiprocket] Auto-push failed for order ${updated._id}:`, srErr.message);
        // Non-critical — order is paid and saved. Admin can push manually from dashboard.
      }
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});


// ── POST /api/orders/razorpay  Create Razorpay payment order  ← MUST be before /:id
router.post('/razorpay', protect, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
    const options = {
      amount:   Math.round(amount * 100), // paise
      currency: 'INR',
      receipt:  `rcpt_${Date.now()}`,
    };
    const order = await razorpay.orders.create(options);
    res.json({
      ...order,
      key: process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('Razorpay Error:', err);
    const errorMsg = err.error?.description || err.message || 'Razorpay order creation failed';
    res.status(500).json({ message: errorMsg, details: err.error || err });
  }
});

// ── GET /api/orders/admin/stats  Admin: dashboard stats  ← static, must come BEFORE /:id
router.get('/admin/stats', protect, admin, async (req, res) => {
  try {
    const [totalOrders, totalRevenue, pendingOrders, deliveredOrders] = await Promise.all([
      Order.countDocuments(),
      Order.aggregate([{ $group: { _id: null, total: { $sum: '$totalPrice' } } }]),
      Order.countDocuments({ status: { $in: ['PENDING', 'PROCESSING'] } }),
      Order.countDocuments({ status: 'DELIVERED' }),
    ]);

    const revenueByDay = await Order.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$totalPrice' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      totalOrders,
      totalRevenue:     totalRevenue[0]?.total || 0,
      pendingOrders,
      deliveredOrders,
      revenueByDay,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Builds the synthetic status timeline from internal order fields — used
// whenever there's no Shiprocket AWB yet, or the live Shiprocket call fails.
function buildFallbackTimeline(order, status) {
  return [
    { label: 'Order confirmed', description: 'Your order has been placed successfully.', date: order.createdAt, done: true },
    { label: 'Processing', description: 'We are preparing your order for dispatch.', date: order.createdAt, done: ['PROCESSING','SHIPPED','DELIVERED','RETURNED'].includes(status) },
    { label: 'Shipped', description: 'Your parcel has been handed over to the courier.', date: order.updatedAt, done: ['SHIPPED','DELIVERED','RETURNED'].includes(status) },
    { label: 'Out for delivery', description: 'The courier is on the way to your delivery address.', date: order.deliveredAt || order.updatedAt, done: status === 'DELIVERED' || status === 'RETURNED' },
    { label: 'Delivered', description: 'Your order has been delivered.', date: order.deliveredAt, done: status === 'DELIVERED' },
  ];
}

// ── GET /api/orders/shiprocket/status  Admin: verify SHIPROCKET_EMAIL/PASSWORD work  ← static, before /:id
router.get('/shiprocket/status', protect, admin, async (req, res) => {
  const result = await checkShiprocketConnection();
  res.json(result);
});

// ── GET /api/orders/track/:id  Public: track order by ID + email  ← static prefix, before /:id
router.get('/track/:id', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const order = await Order.findById(req.params.id).populate('user', 'email');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const userEmail = order.user?.email || '';
    if (userEmail.toLowerCase() !== email.toString().toLowerCase()) {
       return res.status(401).json({ message: 'Email does not match this order' });
    }

    const status = order.status?.toUpperCase() || 'PENDING';

    // If we have a real Shiprocket shipment reference, prefer live tracking data
    if (order.awbCode || order.shiprocketShipmentId) {
      try {
        const live = await trackShiprocketShipment({ awbCode: order.awbCode, shipmentId: order.shiprocketShipmentId });
        if (live) {
          return res.json({
            _id: order._id,
            status,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            isPaid: order.isPaid,
            isDelivered: order.isDelivered,
            deliveredAt: order.deliveredAt,
            orderItems: order.orderItems,
            totalPrice: order.totalPrice,
            courier: live.courier || order.courierName || 'Shiprocket',
            trackingNumber: order.awbCode || live.trackingNumber || 'Pending',
            estimatedDelivery: live.estimatedDelivery || order.deliveredAt || order.updatedAt,
            trackingUrl: live.trackingUrl || null,
            timeline: live.timeline?.length ? live.timeline : buildFallbackTimeline(order, status),
            source: 'shiprocket',
          });
        }
      } catch (shipErr) {
        console.error('Shiprocket tracking error:', shipErr.message);
        // fall through to the synthetic timeline below so the page never breaks
      }
    }

    res.json({
      _id: order._id,
      status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      isPaid: order.isPaid,
      isDelivered: order.isDelivered,
      deliveredAt: order.deliveredAt,
      orderItems: order.orderItems,
      totalPrice: order.totalPrice,
      courier: order.courierName || 'Shiprocket',
      trackingNumber: order.awbCode || order.paymentId || order._id?.toString?.()?.slice(-8)?.toUpperCase?.() || 'Pending',
      estimatedDelivery: order.deliveredAt || order.updatedAt,
      timeline: buildFallbackTimeline(order, status),
      source: 'internal',
    });
  } catch (err) {
    res.status(500).json({ message: 'Invalid Order ID' });
  }
});

// ── PATCH /api/orders/:id/shipping  Admin: attach Shiprocket AWB/courier once a shipment is created
router.patch('/:id/shipping', protect, admin, async (req, res) => {
  try {
    const { awbCode, courierName, shiprocketOrderId, shiprocketShipmentId } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (awbCode !== undefined) order.awbCode = awbCode;
    if (courierName !== undefined) order.courierName = courierName;
    if (shiprocketOrderId !== undefined) order.shiprocketOrderId = shiprocketOrderId;
    if (shiprocketShipmentId !== undefined) order.shiprocketShipmentId = shiprocketShipmentId;

    const updated = await order.save();
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── PATCH /api/orders/:id/return  User: request a return
router.patch('/:id/return', protect, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ message: 'Return reason is required' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Verify ownership
    if (order.user.toString() !== req.user._id.toString())
      return res.status(401).json({ message: 'Not authorized' });

    // Verify eligibility (within 7 days of delivery)
    if (!order.isDelivered || !order.deliveredAt)
      return res.status(400).json({ message: 'Only delivered orders can be returned' });

    const deliveredDate = new Date(order.deliveredAt);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    if (deliveredDate < oneWeekAgo)
      return res.status(400).json({ message: 'Return window (7 days) has expired' });

    if (order.isReturnRequested)
      return res.status(400).json({ message: 'Return already requested' });

    order.isReturnRequested = true;
    order.returnReason      = reason;
    order.returnStatus      = 'PENDING';
    order.returnRequestedAt = new Date();

    const updated = await order.save();
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── PATCH /api/orders/:id/return-process  Admin: approve/reject return
router.patch('/:id/return-process', protect, admin, async (req, res) => {
  try {
    const { returnStatus } = req.body; // 'APPROVED' or 'REJECTED'
    if (!['APPROVED', 'REJECTED'].includes(returnStatus))
      return res.status(400).json({ message: 'Invalid return status' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.returnStatus = returnStatus;
    if (returnStatus === 'APPROVED') {
       order.status = 'RETURNED';
    }

    const updated = await order.save();
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── GET /api/orders/:id  Get single order (owner or admin)  ← DYNAMIC — must be LAST GET route
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'firstName lastName email');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN')
      return res.status(401).json({ message: 'Not authorized' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/orders/delivery/hook  — Shiprocket sends real-time delivery events here
// ⚠️  URL must NOT contain 'shiprocket','kartrocket','sr','kr' (Shiprocket restriction)
// Setup: Shiprocket Dashboard → Settings → API → Webhooks:
//   URL:   https://api.madihaperfume.com/api/orders/delivery/hook
//   Token: value of SHIPROCKET_WEBHOOK_TOKEN in .env
// This is PUBLIC POST endpoint — Shiprocket calls it from their servers automatically.
router.post('/delivery/hook', async (req, res) => {
  try {
    // ── Verify the x-api-key token matches our secret
    const incomingToken = req.headers['x-api-key'] || req.headers['authorization'];
    const expectedToken = process.env.SHIPROCKET_WEBHOOK_TOKEN;
    if (expectedToken && incomingToken !== expectedToken) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Always respond 200 immediately so Shiprocket doesn't retry
    res.status(200).json({ received: true });

    const body = req.body;
    const awb  = body?.awb || body?.awb_code;
    const srStatus = (body?.current_status || body?.status || '').toLowerCase();

    if (!awb || !srStatus) return;

    // Map Shiprocket status strings → our internal status
    const statusMap = {
      'pickup scheduled':   'PROCESSING',
      'pickup generated':   'PROCESSING',
      'picked up':          'SHIPPED',
      'in transit':         'SHIPPED',
      'out for delivery':   'SHIPPED',
      'delivered':          'DELIVERED',
      'rto initiated':      'PROCESSING',
      'rto delivered':      'CANCELLED',
      'cancelled':          'CANCELLED',
      'lost':               'CANCELLED',
    };

    let newStatus = null;
    for (const [key, val] of Object.entries(statusMap)) {
      if (srStatus.includes(key)) { newStatus = val; break; }
    }

    if (!newStatus) return;

    const order = await Order.findOne({ awbCode: awb });
    if (!order) {
      console.warn(`[Webhook] No order found for AWB: ${awb}`);
      return;
    }

    const updates = { status: newStatus };
    if (newStatus === 'DELIVERED') {
      updates.isDelivered = true;
      updates.deliveredAt = new Date();
    }
    if (body?.courier_name && !order.courierName) {
      updates.courierName = body.courier_name;
    }

    await Order.findByIdAndUpdate(order._id, updates);
    console.log(`[Webhook] Order ${order._id} AWB ${awb} → ${newStatus} ("${srStatus}")`);

  } catch (err) {
    console.error('[Webhook] Delivery hook error:', err.message);
  }
});

export default router;

