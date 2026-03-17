/**
 * abuseGuard: simple memory-based per-ip counters with TTL
 * For production use Redis.
 */

const map = new Map(); // key -> { count, ts }

export function abuseGuard(options = {}) {
  const { max = 100, windowMs = 60_000 } = options;
  return (req, res, next) => {
    try {
      const ip = (req.headers['x-forwarded-for'] || req.ip || "").toString().split(",")[0].trim();
      const now = Date.now();
      const key = `${ip}:${req.path}`;
      const rec = map.get(key) || { count: 0, ts: now };
      if (now - rec.ts > windowMs) {
        rec.count = 1;
        rec.ts = now;
      } else {
        rec.count++;
      }
      map.set(key, rec);
      if (rec.count > max) {
        return res.status(429).json({ ok: false, error: "Too many requests (abuse detected)" });
      }
      next();
    } catch (err) {
      console.warn("abuseGuard error", err.message);
      next();
    }
  };
}
