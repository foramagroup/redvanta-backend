const LEGACY_SUPERADMIN_ROLES = new Set(["admin", "owner"]);

export function requireSuperadmin(req, res, next) {
  const role = String(req.user?.role || "").toLowerCase();
  const isSuperadmin = Boolean(req.user?.isSuperadmin) || role === "superadmin" || LEGACY_SUPERADMIN_ROLES.has(role);
  if (!isSuperadmin) {
    return res.status(403).json({ error: "Forbidden: superadmin only" });
  }
  next();
}
