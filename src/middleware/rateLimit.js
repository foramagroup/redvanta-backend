import rateLimit from "express-rate-limit";

/**
 * Global rate limiter (per IP)
 */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" }
});

/**
 * Strict limiter for public /r scans
 */
export const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // max scans per minute per IP
  keyGenerator: (req) => {
    // Use IP + uid combined to limit per resource
    const ip = req.headers['x-forwarded-for'] || req.ip || "";
    const uid = req.query.uid || (req.body && req.body.uid) || "";
    return `${ip}:${uid}`;
  },
  handler: (req, res) => {
    res.status(429).json({ ok: false, error: "Too many scans from your IP for this tag" });
  }
});
