// src/middleware/auth.middleware.js
// Lit le JWT depuis le cookie HttpOnly (plus de Bearer token dans le header)

import { verifyToken, isBlacklisted } from "../services/token.service.js";


const COOKIE_NAMES = {
  superadmin: "sa_token",
  admin:      "admin_token",
  any:        ["sa_token", "admin_token"],
};

// ─── Middleware principal : lire le JWT du cookie ────────────
// type: "superadmin" | "admin" | "any"
function makeAuthMiddleware(type = "any") {
  return async (req, res, next) => {
    try {
      // Lire le token depuis le ou les cookies
      let token = null;
      if (type === "any") {
        token = req.cookies?.sa_token ?? req.cookies?.admin_token ?? null;
      } else {
        token = req.cookies?.[COOKIE_NAMES[type]] ?? null;
      }

      if (!token) {
        return res.status(401).json({
          success: false,
          error:   "Non authentifié. Veuillez vous connecter.",
          code:    "NO_TOKEN",
        });
      }

      // Vérifier la signature JWT
      const decoded = verifyToken(token);

      // Vérifier que le token n'est pas blacklisté (logout)
      const blacklisted = await isBlacklisted(token);
      if (blacklisted) {
        return res.status(401).json({
          success: false,
          error:   "Session révoquée. Veuillez vous reconnecter.",
          code:    "TOKEN_REVOKED",
        });
      }

      // Attacher les infos décodées à req.user
      req.user  = decoded;
      req.token = token;  // utile pour le logout (blacklist)
      next();
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          error:   "Session expirée. Veuillez vous reconnecter.",
          code:    "TOKEN_EXPIRED",
        });
      }
      return res.status(401).json({
        success: false,
        error:   "Token invalide.",
        code:    "INVALID_TOKEN",
      });
    }
  };
}

// ─── Exports des middlewares d'authentification ───────────────
export const authenticate         = makeAuthMiddleware("any");
export const authenticateSuperAdmin = makeAuthMiddleware("superadmin");
export const authenticateAdmin    = makeAuthMiddleware("admin");

// ─── Guards de rôle ──────────────────────────────────────────

export const requireSuperAdmin = (req, res, next) => {
  if (!req.user?.isSuperadmin) {
    return res.status(403).json({ success: false, error: "Accès SuperAdmin requis" });
  }
  next();
};

export const requireAdmin = (req, res, next) => {
  if (!req.user?.isAdmin && !req.user?.isSuperadmin) {
    return res.status(403).json({ success: false, error: "Accès Admin requis" });
  }
  next();
};


// Usage : requirePermission("products", "create")
export const requirePermission = (moduleName, permName) => (req, res, next) => {
  if (req.user?.isSuperadmin) return next(); // superadmin = tout autorisé
  const perms = req.user?.permissions?.[moduleName] ?? [];
  if (!perms.includes(permName)) {
    return res.status(403).json({
      success: false,
      error:   `Permission "${permName}" sur "${moduleName}" requise`,
    });
  }
  next();
};

// ─── Validate (Zod) ──────────────────────────────────────────
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({
      success: false,
      error:   "Données invalides",
      errors:  result.error.flatten().fieldErrors,
    });
  }
  req.validatedBody = result.data;
  next();
};