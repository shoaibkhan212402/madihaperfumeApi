import express from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { Op, fn, col, literal } from 'sequelize';
import { sequelize } from '../models-sql/index.js';
import { Order, OrderItem } from '../models-sql/Order.js';
import { User } from '../models-sql/User.js';
import Coupon from '../models-sql/Coupon.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { trackShiprocketShipment, checkShiprocketConnection, createShiprocketOrder } from '../utils/shiprocketService.js';
import { serializeOrder } from '../utils/serializers.js';

const router = express.Router();

// ── Razorpay Instance
const cleanKeyId = (process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '').trim();
const cleanKeySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

const razorpay = new Razorpay({
  key_id: cleanKeyId,
  key_secret: cleanKeySecret,
});

const isId = (v) => /^[0-9a-fA-F]{24}$/.test(v || '');
const withUser = { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] };
const withItems = { model: OrderItem, as: 'orderItems', order: [['sortOrder', 'ASC']] };

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

    const created = await sequelize.transaction(async (t) => {
      const order = await Order.create({
        userId: req.user._id,
        firstName: shippingAddress.firstName,
        lastName: shippingAddress.lastName,
        phone: shippingAddress.phone || '',
        address: shippingAddress.address,
        city: shippingAddress.city,
        state: shippingAddress.state || '',
        postalCode: shippingAddress.postalCode,
        country: shippingAddress.country || 'India',
        paymentMethod,
        itemsPrice, taxPrice, shippingPrice,
        discountAmount: discountAmount || 0,
        totalPrice,
        couponCode: couponCode || null,
      }, { transaction: t });

      await OrderItem.bulkCreate(orderItems.map((x, i) => {
        const realId = isId(x.productId);
        return {
          orderId: order.id, name: x.name, qty: x.qty, image: x.image, price: x.price,
          productId: realId ? x.productId : null, productRef: !realId ? x.productId : null,
          sortOrder: i,
        };
      }), { transaction: t });

      if (couponCode) {
        await Coupon.increment('usedCount', { where: { code: couponCode.toUpperCase() }, transaction: t });
      }

      return order;
    });

    const full = await Order.findByPk(created.id, { include: [withItems] });
    res.status(201).json(serializeOrder(full));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── GET /api/orders/myorders  User's own orders
router.get('/myorders', protect, async (req, res) => {
  try {
    const orders = await Order.findAll({ where: { userId: req.user._id }, include: [withItems], order: [['createdAt', 'DESC']] });
    res.json(orders.map(serializeOrder));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/orders  Admin: all orders with filters  ← MUST come before /:id
router.get('/', protect, admin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.status = status.toUpperCase();
    const offset = (Number(page) - 1) * Number(limit);
    const total = await Order.count({ where });
    const orders = await Order.findAll({
      where, include: [withUser, withItems], order: [['createdAt', 'DESC']], offset, limit: Number(limit),
    });
    res.json({ orders: orders.map(serializeOrder), total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
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

    const order = await Order.findByPk(req.params.id, { include: [withItems] });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.status = status;
    if (status === 'DELIVERED') { order.isDelivered = true; order.deliveredAt = new Date(); }
    if (status === 'CANCELLED') { order.isPaid = false; }

    await order.save();
    res.json(serializeOrder(order));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── PATCH /api/orders/:id/pay  Mark order as paid (after Razorpay signature verification)
router.patch('/:id/pay', protect, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, paymentEmail } = req.body;

    if (razorpay_order_id && razorpay_payment_id && razorpay_signature) {
      const generated = crypto
        .createHmac('sha256', cleanKeySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generated !== razorpay_signature) {
        return res.status(400).json({ message: 'Payment verification failed: invalid signature' });
      }
    }

    const order = await Order.findByPk(req.params.id, { include: [withItems] });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.isPaid = true;
    order.paidAt = new Date();
    order.paymentId = razorpay_payment_id || req.body.paymentId;
    order.paymentStatus = 'COMPLETED';
    order.paymentEmail = paymentEmail;
    order.status = 'PROCESSING';

    await order.save();
    res.json(serializeOrder(order));

    // ── Auto-push to Shiprocket after payment confirmed (fire-and-forget)
    setImmediate(async () => {
      try {
        const sr = await createShiprocketOrder(order);
        await Order.update({
          shiprocketOrderId: sr.shiprocketOrderId,
          shiprocketShipmentId: sr.shiprocketShipmentId,
          awbCode: sr.awbCode || undefined,
          courierName: sr.courierName || undefined,
          status: sr.awbCode ? 'SHIPPED' : 'PROCESSING',
        }, { where: { id: order.id } });
        console.log(`[Shiprocket] Order ${order.id} pushed → SR Order: ${sr.shiprocketOrderId}, AWB: ${sr.awbCode}`);
      } catch (srErr) {
        console.error(`[Shiprocket] Auto-push failed for order ${order.id}:`, srErr.message);
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
      amount: Math.round(amount * 100), // paise
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
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
    const [totalOrders, totalRevenueRow, pendingOrders, deliveredOrders] = await Promise.all([
      Order.count(),
      Order.findOne({ attributes: [[fn('SUM', col('total_price')), 'total']], raw: true }),
      Order.count({ where: { status: { [Op.in]: ['PENDING', 'PROCESSING'] } } }),
      Order.count({ where: { status: 'DELIVERED' } }),
    ]);

    const revenueByDayRows = await Order.findAll({
      attributes: [
        [fn('DATE', col('created_at')), 'day'],
        [fn('SUM', col('total_price')), 'revenue'],
        [fn('COUNT', col('id')), 'count'],
      ],
      where: { createdAt: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      group: [literal('day')],
      order: [[literal('day'), 'ASC']],
      raw: true,
    });
    const revenueByDay = revenueByDayRows.map((r) => ({ _id: r.day, revenue: Number(r.revenue), count: Number(r.count) }));

    res.json({
      totalOrders,
      totalRevenue: Number(totalRevenueRow?.total || 0),
      pendingOrders,
      deliveredOrders,
      revenueByDay,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Builds the synthetic status timeline from internal order fields
function buildFallbackTimeline(order, status) {
  return [
    { label: 'Order confirmed', description: 'Your order has been placed successfully.', date: order.createdAt, done: true },
    { label: 'Processing', description: 'We are preparing your order for dispatch.', date: order.createdAt, done: ['PROCESSING', 'SHIPPED', 'DELIVERED', 'RETURNED'].includes(status) },
    { label: 'Shipped', description: 'Your parcel has been handed over to the courier.', date: order.updatedAt, done: ['SHIPPED', 'DELIVERED', 'RETURNED'].includes(status) },
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

    const order = await Order.findByPk(req.params.id, { include: [withUser, withItems] });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const userEmail = order.user?.email || '';
    if (userEmail.toLowerCase() !== email.toString().toLowerCase()) {
      return res.status(401).json({ message: 'Email does not match this order' });
    }

    const status = order.status?.toUpperCase() || 'PENDING';
    const orderItemsOut = order.orderItems.map((i) => ({ name: i.name, qty: i.qty, image: i.image, price: Number(i.price) }));

    if (order.awbCode || order.shiprocketShipmentId) {
      try {
        const live = await trackShiprocketShipment({ awbCode: order.awbCode, shipmentId: order.shiprocketShipmentId });
        if (live) {
          return res.json({
            _id: order.id,
            status,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            isPaid: order.isPaid,
            isDelivered: order.isDelivered,
            deliveredAt: order.deliveredAt,
            orderItems: orderItemsOut,
            totalPrice: Number(order.totalPrice),
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
      }
    }

    res.json({
      _id: order.id,
      status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      isPaid: order.isPaid,
      isDelivered: order.isDelivered,
      deliveredAt: order.deliveredAt,
      orderItems: orderItemsOut,
      totalPrice: Number(order.totalPrice),
      courier: order.courierName || 'Shiprocket',
      trackingNumber: order.awbCode || order.paymentId || order.id?.slice(-8)?.toUpperCase() || 'Pending',
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
    const order = await Order.findByPk(req.params.id, { include: [withItems] });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (awbCode !== undefined) order.awbCode = awbCode;
    if (courierName !== undefined) order.courierName = courierName;
    if (shiprocketOrderId !== undefined) order.shiprocketOrderId = shiprocketOrderId;
    if (shiprocketShipmentId !== undefined) order.shiprocketShipmentId = shiprocketShipmentId;

    await order.save();
    res.json(serializeOrder(order));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── PATCH /api/orders/:id/return  User: request a return
router.patch('/:id/return', protect, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ message: 'Return reason is required' });

    const order = await Order.findByPk(req.params.id, { include: [withItems] });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.userId !== req.user._id)
      return res.status(401).json({ message: 'Not authorized' });

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
    order.returnReason = reason;
    order.returnStatus = 'PENDING';
    order.returnRequestedAt = new Date();

    await order.save();
    res.json(serializeOrder(order));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── PATCH /api/orders/:id/return-process  Admin: approve/reject return
router.patch('/:id/return-process', protect, admin, async (req, res) => {
  try {
    const { returnStatus } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(returnStatus))
      return res.status(400).json({ message: 'Invalid return status' });

    const order = await Order.findByPk(req.params.id, { include: [withItems] });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.returnStatus = returnStatus;
    if (returnStatus === 'APPROVED') {
      order.status = 'RETURNED';
    }

    await order.save();
    res.json(serializeOrder(order));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── GET /api/orders/:id  Get single order (owner or admin)  ← DYNAMIC — must be LAST GET route
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, { include: [withUser, withItems] });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.user.id !== req.user._id && req.user.role !== 'ADMIN')
      return res.status(401).json({ message: 'Not authorized' });
    res.json(serializeOrder(order));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/orders/delivery/hook  — Shiprocket sends real-time delivery events here
router.post('/delivery/hook', async (req, res) => {
  try {
    const incomingToken = req.headers['x-api-key'] || req.headers['authorization'];
    const expectedToken = process.env.SHIPROCKET_WEBHOOK_TOKEN;
    if (expectedToken && incomingToken !== expectedToken) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    res.status(200).json({ received: true });

    const body = req.body;
    const awb = body?.awb || body?.awb_code;
    const srStatus = (body?.current_status || body?.status || '').toLowerCase();

    if (!awb || !srStatus) return;

    const statusMap = {
      'pickup scheduled': 'PROCESSING',
      'pickup generated': 'PROCESSING',
      'picked up': 'SHIPPED',
      'in transit': 'SHIPPED',
      'out for delivery': 'SHIPPED',
      'delivered': 'DELIVERED',
      'rto initiated': 'PROCESSING',
      'rto delivered': 'CANCELLED',
      'cancelled': 'CANCELLED',
      'lost': 'CANCELLED',
    };

    let newStatus = null;
    for (const [key, val] of Object.entries(statusMap)) {
      if (srStatus.includes(key)) { newStatus = val; break; }
    }

    if (!newStatus) return;

    const order = await Order.findOne({ where: { awbCode: awb } });
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

    await order.update(updates);
    console.log(`[Webhook] Order ${order.id} AWB ${awb} → ${newStatus} ("${srStatus}")`);
  } catch (err) {
    console.error('[Webhook] Delivery hook error:', err.message);
  }
});

export default router;
