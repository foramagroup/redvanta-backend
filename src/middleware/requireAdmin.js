// backend/src/middleware/requireAdmin.js
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden: admin only" });
  }
  next();
}