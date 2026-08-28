import jwt from 'jsonwebtoken';
import { User } from '../models-sql/User.js';

// ── protect: verify JWT and attach req.user ────────────────────────────────
const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id, { attributes: { exclude: ['password'] } });
    if (!user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }
    // Keep req.user._id (not .id) — read everywhere downstream the same way
    // it was when the app spoke Mongoose.
    req.user = user;
    req.user._id = user.id;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

// ── admin: ensure req.user is ADMIN ───────────────────────────────────────
const admin = (req, res, next) => {
  if (req.user && req.user.role === 'ADMIN') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};

export { protect, admin };
