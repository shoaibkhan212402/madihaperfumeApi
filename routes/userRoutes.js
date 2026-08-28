import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { Op } from 'sequelize';
import { OAuth2Client } from 'google-auth-library';
import { sequelize } from '../models-sql/index.js';
import { User, UserAddress, UserCartItem } from '../models-sql/User.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { sendOtp } from '../utils/otpService.js';
import { serializeUser, serializeAddress, serializeCartItem } from '../utils/serializers.js';

const router = express.Router();
const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const client = new OAuth2Client(googleClientId);

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

const authResponse = (user) => ({
  _id: user.id, firstName: user.firstName, lastName: user.lastName,
  email: user.email, role: user.role, token: generateToken(user.id),
});

// ── Strict limiter for auth routes (10 requests / 15 min per IP)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
  skipSuccessfulRequests: true,
});

// ── POST /api/users/register
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;

    if (!firstName || !lastName || !email || !password || !phone)
      return res.status(400).json({ message: 'All fields (including phone) are required' });
    if (password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const normalizedEmail = email.toLowerCase().trim();
    const cleanPhone = phone.trim();

    const existingUser = await User.findOne({ where: { [Op.or]: [{ email: normalizedEmail }, { phone: cleanPhone }] } });

    if (existingUser && existingUser.isVerified) {
      const field = existingUser.email === normalizedEmail ? 'email' : 'mobile number';
      return res.status(400).json({ message: `This ${field} is already registered. Please login instead.` });
    }

    let user;
    if (!existingUser) {
      user = await User.create({
        firstName: firstName.trim(), lastName: lastName.trim(), email: normalizedEmail,
        phone: cleanPhone, password, isVerified: false,
      });
    } else {
      existingUser.firstName = firstName.trim();
      existingUser.lastName = lastName.trim();
      existingUser.email = normalizedEmail;
      existingUser.phone = cleanPhone;
      existingUser.password = password;
      user = await existingUser.save();
    }

    await sendOtp(user);

    res.status(200).json({
      message: 'OTP sent to your email and phone. Please verify to complete registration.',
      userId: user.id,
      requireOtp: true,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── POST /api/users/verify-otp
router.post('/verify-otp', authLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });

    const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.otp !== otp || new Date() > new Date(user.otpExpires)) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    res.json(authResponse(user));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── POST /api/users/whatsapp-login
router.post('/whatsapp-login', authLimiter, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone number is required' });

    const cleanPhone = phone.trim();
    let user = await User.findOne({ where: { phone: cleanPhone } });

    if (!user) {
      user = await User.create({
        firstName: 'User', lastName: cleanPhone.slice(-4),
        email: `${cleanPhone}@madihaperfume.com`, phone: cleanPhone,
        password: Math.random().toString(36).slice(-10), isVerified: false,
      });
    }

    await sendOtp(user);
    res.json({ message: 'Verification code sent to your WhatsApp.', email: user.email });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── POST /api/users/login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required' });

    const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (user && (await user.matchPassword(password))) {
      if (!user.isVerified) {
        await sendOtp(user);
        return res.status(403).json({
          message: 'Account not verified. OTP sent to your email/phone.',
          requireOtp: true,
          userId: user.id,
        });
      }
      res.json(authResponse(user));
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── POST /api/users/forgot-password
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { emailOrPhone } = req.body;
    if (!emailOrPhone) return res.status(400).json({ message: 'Email or phone number is required' });

    const search = emailOrPhone.toLowerCase().trim();
    const user = await User.findOne({ where: { [Op.or]: [{ email: search }, { phone: search }] } });

    if (!user) return res.status(404).json({ message: 'No account found with that email/phone' });

    await sendOtp(user);
    res.json({ message: 'OTP sent successfully to your registered email and phone.', email: user.email });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── POST /api/users/reset-password
router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ message: 'Email, OTP, and new password are required' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.otp !== otp || new Date() > new Date(user.otpExpires)) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.password = newPassword;
    user.otp = null;
    user.otpExpires = null;
    user.isVerified = true;
    await user.save();

    res.json(authResponse(user));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── POST /api/users/change-password
router.post('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Current and new passwords are required' });

    const user = await User.findByPk(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!(await user.matchPassword(currentPassword))) {
      return res.status(401).json({ message: 'Incorrect current password' });
    }

    if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── POST /api/users/google-login
router.post('/google-login', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Google token is required' });

    const ticket = await client.verifyIdToken({ idToken: token, audience: googleClientId });
    const { email, given_name, family_name, sub } = ticket.getPayload();

    let user = await User.findOne({ where: { email: email.toLowerCase().trim() } });

    if (!user) {
      user = await User.create({
        firstName: given_name || 'User', lastName: family_name || '',
        email: email.toLowerCase().trim(), password: Math.random().toString(36).slice(-10),
        isGoogleUser: true, googleId: sub, isVerified: true,
      });
    } else if (!user.isVerified || !user.isGoogleUser) {
      user.isVerified = true;
      user.isGoogleUser = true;
      if (!user.googleId) user.googleId = sub;
      await user.save();
    }

    res.json(authResponse(user));
  } catch (err) {
    console.error('Google Auth Error:', err);
    res.status(400).json({ message: 'Google authentication failed' });
  }
});

// ── GET /api/users/profile
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findByPk(req.user._id, { attributes: { exclude: ['password'] } });
    res.json(serializeUser(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/users/profile
router.put('/profile', protect, async (req, res) => {
  try {
    const user = await User.findByPk(req.user._id);
    user.firstName = req.body.firstName || user.firstName;
    user.lastName = req.body.lastName || user.lastName;
    user.email = req.body.email || user.email;
    if (req.body.password) {
      if (req.body.password.length < 6)
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      user.password = req.body.password;
    }
    await user.save();
    res.json(authResponse(user));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── PUT /api/users/address
router.put('/address', protect, async (req, res) => {
  try {
    const addr = req.body;
    const addresses = await sequelize.transaction(async (t) => {
      if (addr._id) {
        const existing = await UserAddress.findOne({ where: { id: addr._id, userId: req.user._id }, transaction: t });
        if (existing) {
          if (addr.isDefault) await UserAddress.update({ isDefault: false }, { where: { userId: req.user._id }, transaction: t });
          await existing.update({
            type: addr.type ?? existing.type, fullName: addr.fullName ?? existing.fullName, phone: addr.phone ?? existing.phone,
            street: addr.street ?? existing.street, landmark: addr.landmark ?? existing.landmark, city: addr.city ?? existing.city,
            state: addr.state ?? existing.state, country: addr.country ?? existing.country, zipCode: addr.zipCode ?? existing.zipCode,
            isDefault: addr.isDefault ?? existing.isDefault,
          }, { transaction: t });
        }
      } else {
        if (addr.isDefault) await UserAddress.update({ isDefault: false }, { where: { userId: req.user._id }, transaction: t });
        await UserAddress.create({ ...addr, userId: req.user._id }, { transaction: t });
      }
      return UserAddress.findAll({ where: { userId: req.user._id }, transaction: t });
    });
    res.json(addresses.map(serializeAddress));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── DELETE /api/users/address/:id
router.delete('/address/:id', protect, async (req, res) => {
  try {
    // Explicit ownership guard — a flat table has no structural protection
    // like Mongoose subdocuments did, so this AND must stay.
    const addr = await UserAddress.findOne({ where: { id: req.params.id, userId: req.user._id } });
    if (!addr) return res.status(404).json({ message: 'Address not found' });
    await addr.destroy();
    const addresses = await UserAddress.findAll({ where: { userId: req.user._id } });
    res.json(addresses.map(serializeAddress));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── GET /api/users/cart
router.get('/cart', protect, async (req, res) => {
  try {
    const items = await UserCartItem.findAll({ where: { userId: req.user._id } });
    res.json(items.map(serializeCartItem));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/users/cart
router.put('/cart', protect, async (req, res) => {
  try {
    const items = await sequelize.transaction(async (t) => {
      await UserCartItem.destroy({ where: { userId: req.user._id }, transaction: t });
      const cartItems = req.body.cartItems || [];
      if (cartItems.length) {
        await UserCartItem.bulkCreate(cartItems.map((ci) => ({
          userId: req.user._id, productIdText: ci.productId, name: ci.name,
          price: ci.price, originalPrice: ci.originalPrice, image: ci.image, qty: ci.qty,
        })), { transaction: t });
      }
      return UserCartItem.findAll({ where: { userId: req.user._id }, transaction: t });
    });
    res.json(items.map(serializeCartItem));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── GET /api/users  Admin: all users
router.get('/', protect, admin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const total = await User.count({ where: { role: 'USER' } });
    const users = await User.findAll({
      where: { role: 'USER' }, attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']], offset, limit: Number(limit),
    });
    res.json({ users: users.map(serializeUser), total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/users/:id  Admin: delete user
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (user) await user.destroy();
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
