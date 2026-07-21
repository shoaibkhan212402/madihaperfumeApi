// ── Keeps the Render free-tier instance awake ──────────────────────────────
// Render's free plan spins the service down after ~15 min of no inbound
// traffic; the next real visitor then eats a 30-60s cold-start boot. Pinging
// our own health-check route on an interval shorter than that window counts
// as traffic and keeps the instance warm.
const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 min — inside Render's ~15 min idle window

export function startSelfPing() {
  const url = process.env.SERVER_URL;
  if (!url || process.env.NODE_ENV !== 'production') return;

  setInterval(() => {
    fetch(url).catch((err) => console.error('Self-ping failed:', err.message));
  }, PING_INTERVAL_MS);
}
