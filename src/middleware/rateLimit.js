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

export const authSignupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Trop de tentatives d'inscription. Reessayez plus tard." },
});

export const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, error: "Trop de tentatives de connexion. Reessayez plus tard." },
});

export const authVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Trop de tentatives de verification. Reessayez plus tard." },
});

export const authResendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Trop de demandes de renvoi. Reessayez plus tard." },
});
