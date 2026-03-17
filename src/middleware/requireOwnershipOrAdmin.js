// backend/src/middleware/requireOwnershipOrAdmin.js
import prisma from "../config/prisma.js";

/**
 * requireOwnershipOrAdmin
 * - usage: requireOwnershipOrAdmin('Order', 'orderIdParamName', 'ownerField')
 * - ex: requireOwnershipOrAdmin('Order', 'orderId', 'userId')
 *
 * It checks:
 *  - if user is admin -> allow
 *  - else load the record and check record[ownerField] === req.user.id
 */
export function requireOwnershipOrAdmin(modelName, paramIdName = "id", ownerField = "userId") {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const role = String(req.user.role || "").toUpperCase();
      if (role === "ADMIN") return next();

      const id = req.params[paramIdName] || req.body[paramIdName] || req.query[paramIdName];
      if (!id) return res.status(400).json({ error: "Resource id is required" });

      // Prisma model name dynamic access: prisma[modelNameLower] is not safe.
      // We'll use a mapping:
      const mapping = {
        Order: "order",
        Design: "design",
        Review: "review",
        Customization: "customization",
        NfcTag: "nfcTag",
        User: "user"
      };
      const modelKey = mapping[modelName] || modelName[0].toLowerCase() + modelName.slice(1);
      if (!prisma[modelKey]) {
        return res.status(500).json({ error: "Server mapping error for ownership check" });
      }

      const record = await prisma[modelKey].findUnique({ where: { id: id } });
      if(!record) return res.status(404).json({ error: `${modelName} not found` });

      if (String(record[ownerField]) !== String(req.user.id)) {
        return res.status(403).json({ error: "You do not own this resource" });
      }

      // attach record to request to avoid re-query later
      req.resource = record;
      return next();
    } catch (err) {
      console.error("requireOwnershipOrAdmin:", err);
      return res.status(500).json({ error: "Ownership check failed" });
    }
  };
}
