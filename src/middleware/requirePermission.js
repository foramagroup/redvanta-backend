// backend/src/middleware/requirePermission.js
import prisma from "../config/prisma.js";

/**
 * requirePermission(key)
 * - vérifie qu'un user a une permission spécifique (UserPermission table)
 *
 * Usage:
 * app.get('/admin/x', requireAuth, requirePermission('EXPORT_DESIGNS'), handler)
 */
export function requirePermission(key) {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const userId = req.user.id;
      // admin bypass
      if (String(req.user.role).toUpperCase() === "ADMIN") return next();

      const found = await prisma.userPermission.findFirst({ where: { userId, key } });
      if (!found) return res.status(403).json({ error: "Missing permission" });
      return next();
    } catch (err) {
      console.error("requirePermission:", err);
      return res.status(500).json({ error: "Permission check failed" });
    }
  };
}
