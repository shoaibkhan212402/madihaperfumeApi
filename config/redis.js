import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// ── Safe Redis wrapper: if Redis is unavailable, all ops become no-ops ─────
// This prevents the server from crashing due to Redis connection failures.
let redis;

if (process.env.REDIS_URL) {
  try {
    // No lazyConnect — the connection is opened immediately at boot instead of
    // on the first cache call. With enableOfflineQueue false, a lazy connection
    // meant the first command after every restart (and any concurrent requests
    // that arrive during the handshake) failed outright instead of waiting.
    redis = new Redis(process.env.REDIS_URL, {
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
} else {
  console.warn('⚠️  REDIS_URL not set — running without cache');
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
  // Deletes every key matching a glob pattern (e.g. "products_*") without the
  // blocking KEYS command — SCAN walks the keyspace in cursor'd batches so it
  // never stalls the Redis event loop, even as the keyspace grows.
  deleteByPattern: async (pattern) => {
    if (!redis) return;
    try {
      const stream = redis.scanStream({ match: pattern, count: 100 });
      const pipeline = redis.pipeline();
      let queued = false;
      for await (const keys of stream) {
        if (keys.length) {
          queued = true;
          keys.forEach((key) => pipeline.del(key));
        }
      }
      if (queued) await pipeline.exec();
    } catch { /* ignore */ }
  },
};

export default safeRedis;
