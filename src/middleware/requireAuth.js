// backend/src/middleware/requireAuth.js
import jwt from "jsonwebtoken";

/**
 * requireAuth
 * - vérifie la présence d'un Bearer token
 * - decode le token et attache req.user = { id, role, email }
 * - si token invalide -> 401
 */
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || req.headers.Authorization;
    if (!header || typeof header !== "string") {
      return res.status(401).json({ error: "Missing Authorization header" });
    }

    const token = header.replace(/^Bearer\s+/i, "").trim();
    if (!token) return res.status(401).json({ error: "Missing token" });

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET not configured");

    const payload = jwt.verify(token, secret);
    // payload should contain { id, role, email } (server must sign token like that)
    req.user = {
      id: payload.id,
      role: payload.role || "USER",
      email: payload.email || null
    };
    return next();
  } catch (err) {
    console.error("requireAuth:", err.message || err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
