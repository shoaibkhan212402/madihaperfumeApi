import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { OAuth2Client } from 'google-auth-library';
import { sendOtp } from '../utils/otpService.js';

const router = express.Router();
const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const client = new OAuth2Client(googleClientId);

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

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

    // 1. Check if ANY user exists with this email OR phone
    const existingUser = await User.findOne({ 
      $or: [{ email: normalizedEmail }, { phone: cleanPhone }] 
    });
    
    // 2. If a verified user exists, block registration
    if (existingUser && existingUser.isVerified) {
      const field = existingUser.email === normalizedEmail ? 'email' : 'mobile number';
      return res.status(400).json({ message: `This ${field} is already registered. Please login instead.` });
    }

    let user;
    if (!existingUser) {
      // Create new unverified user
      user = await User.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        phone: cleanPhone,
        password,
        isVerified: false
      });
    } else {
      // existingUser is NOT verified. Update their info and send a new OTP.
      existingUser.firstName = firstName.trim();
      existingUser.lastName = lastName.trim();
      existingUser.email = normalizedEmail; // In case they changed email but kept phone
      existingUser.phone = cleanPhone;     // In case they changed phone but kept email
      existingUser.password = password;
      user = await existingUser.save();
    }

    // Send OTP
    await sendOtp(user);

    res.status(200).json({
      message: 'OTP sent to your email and phone. Please verify to complete registration.',
      userId: user._id,
      requireOtp: true
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

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.otp !== otp || new Date() > new Date(user.otpExpires)) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.json({
      _id: user._id, firstName: user.firstName, lastName: user.lastName,
      email: user.email, role: user.role, token: generateToken(user._id),
    });
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

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (user && (await user.matchPassword(password))) {
      if (!user.isVerified) {
        await sendOtp(user);
        return res.status(403).json({ 
          message: 'Account not verified. OTP sent to your email/phone.',
          requireOtp: true,
          userId: user._id
        });
      }

      res.json({
        _id: user._id, firstName: user.firstName, lastName: user.lastName,
        email: user.email, role: user.role, token: generateToken(user._id),
      });
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
    const user = await User.findOne({ $or: [{ email: search }, { phone: search }] });
    
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

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.otp !== otp || new Date() > new Date(user.otpExpires)) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.password = newPassword;
    user.otp = undefined;
    user.otpExpires = undefined;
    user.isVerified = true; // Ensure they are verified
    await user.save();

    res.json({
      _id: user._id, firstName: user.firstName, lastName: user.lastName,
      email: user.email, role: user.role, token: generateToken(user._id),
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── POST /api/users/change-password
router.post('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Current and new passwords are required' });
    
    const user = await User.findById(req.user._id);
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

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: googleClientId,
    });

    const { email, given_name, family_name, sub } = ticket.getPayload();

    let user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      // Create user if they don't exist
      user = await User.create({
        firstName: given_name || 'User',
        lastName: family_name || '',
        email: email.toLowerCase().trim(),
        password: Math.random().toString(36).slice(-10), // Random password for OAuth users
        isGoogleUser: true,
        googleId: sub,
      });
    }

    res.json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (err) {
    console.error('Google Auth Error:', err);
    res.status(400).json({ message: 'Google authentication failed' });
  }
});

// ── GET /api/users/profile
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/users/profile
router.put('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.firstName = req.body.firstName || user.firstName;
    user.lastName  = req.body.lastName  || user.lastName;
    user.email     = req.body.email     || user.email;
    if (req.body.password) {
      if (req.body.password.length < 6)
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      user.password = req.body.password;
    }
    const updated = await user.save();
    res.json({
      _id: updated._id, firstName: updated.firstName, lastName: updated.lastName,
      email: updated.email, role: updated.role, token: generateToken(updated._id),
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── PUT /api/users/address
router.put('/address', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const addr = req.body;
    if (addr._id) {
      const existing = user.addresses.id(addr._id);
      if (existing) {
        if (addr.isDefault) user.addresses.forEach(a => a.isDefault = false);
        existing.set(addr);
      }
    } else {
      if (addr.isDefault) user.addresses.forEach((a) => (a.isDefault = false));
      user.addresses.push(addr);
    }
    await user.save();
    res.json(user.addresses);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── DELETE /api/users/address/:id
router.delete('/address/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const addr = user.addresses.id(req.params.id);
    if (!addr) return res.status(404).json({ message: 'Address not found' });
    addr.deleteOne();
    await user.save();
    res.json(user.addresses);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── GET /api/users/cart
router.get('/cart', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json(user.cartItems || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/users/cart
router.put('/cart', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.cartItems = req.body.cartItems;
    await user.save();
    res.json(user.cartItems);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── GET /api/users  Admin: all users
router.get('/', protect, admin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip  = (Number(page) - 1) * Number(limit);
    const total = await User.countDocuments({ role: 'USER' });
    const users = await User.find({ role: 'USER' })
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    res.json({ users, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/users/:id  Admin: delete user
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
