import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// ── Safe Redis wrapper: if Redis is unavailable, all ops become no-ops ─────
// This prevents the server from crashing due to Redis connection failures.
let redis;

try {
  redis = new Redis(process.env.REDIS_URL, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    retryStrategy: (times) => {
      if (times > 3) return null; // Stop retrying after 3 attempts
      return Math.min(times * 200, 2000);
    },
  });

  redis.on('connect', () => console.log('✅ Redis connected'));
  redis.on('error', (err) => {
    // Log but don't crash — cache miss is acceptable
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️  Redis error (cache disabled):', err.message);
    }
  });
} catch (e) {
  console.warn('⚠️  Redis init failed — running without cache');
}

// ── Safe wrappers that never throw ────────────────────────────────────────
const safeRedis = {
  get: async (key) => {
    try { return redis ? await redis.get(key) : null; }
    catch { return null; }
  },
  setex: async (key, seconds, value) => {
    try { if (redis) await redis.setex(key, seconds, value); }
    catch { /* ignore */ }
  },
  del: async (key) => {
    try { if (redis) await redis.del(key); }
    catch { /* ignore */ }
  },
  keys: async (pattern) => {
    try { return redis ? await redis.keys(pattern) : []; }
    catch { return []; }
  },
};

export default safeRedis;
