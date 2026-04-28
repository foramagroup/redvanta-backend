import prisma from "../config/database.js";
import { verifyToken, isBlacklisted } from "../services/token.service.js";

const COOKIE_NAMES = {
  superadmin: "sa_token",
  admin: "admin_token",
  any: ["sa_token", "admin_token"],
};

function clearAuthCookies(res, type) {
  if (type === "any") {
    res.clearCookie("sa_token", { path: "/" });
    res.clearCookie("admin_token", { path: "/" });
    return;
  }
  res.clearCookie(COOKIE_NAMES[type], { path: "/" });
}

function makeAuthMiddleware(type = "any") {
  return async (req, res, next) => {
    try {
      let token = null;

      if (type === "any") {
        token = req.cookies?.sa_token ?? req.cookies?.admin_token ?? null;
      } else {
        token = req.cookies?.[COOKIE_NAMES[type]] ?? null;
      }

      if (!token) {
        return res.status(401).json({
          success: false,
          error: "Not authenticated. Please sign in.",
          code: "NO_TOKEN",
        });
      }

      const decoded = verifyToken(token);

      const blacklisted = await isBlacklisted(token);
      if (blacklisted) {
        clearAuthCookies(res, type);
        return res.status(401).json({
          success: false,
          error: "Session revoked. Please sign in again.",
          code: "TOKEN_REVOKED",
        });
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          isAdmin: true,
          isSuperadmin: true,
          companies: {
            where: decoded.companyId ? { companyId: Number(decoded.companyId) } : undefined,
            select: { companyId: true },
            take: 1,
          },
        },
      });

      const normalizedTokenEmail = String(decoded.email || "").trim().toLowerCase();
      const normalizedDbEmail = String(dbUser?.email || "").trim().toLowerCase();

      const emailMismatch = !dbUser || normalizedTokenEmail !== normalizedDbEmail;
      const roleMismatch =
        !dbUser ||
        (decoded.isSuperadmin && !dbUser.isSuperadmin) ||
        (decoded.isAdmin && !dbUser.isAdmin);
      const companyMismatch =
        !!decoded.companyId &&
        !!dbUser &&
        decoded.isAdmin &&
        !decoded.isSuperadmin &&
        !(dbUser.companies?.length > 0);

      if (emailMismatch || roleMismatch || companyMismatch) {
        clearAuthCookies(res, type);
        return res.status(401).json({
          success: false,
          error: "Invalid session. Please sign in again.",
          code: "STALE_SESSION",
        });
      }

      req.user = decoded;
      req.token = token;
      next();
    } catch (err) {
      clearAuthCookies(res, type);

      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          error: "Session expired. Please sign in again.",
          code: "TOKEN_EXPIRED",
        });
      }

      return res.status(401).json({
        success: false,
        error: "Invalid token.",
        code: "INVALID_TOKEN",
      });
    }
  };
}

export const authenticate = makeAuthMiddleware("any");
export const authenticateSuperAdmin = makeAuthMiddleware("superadmin");
export const authenticateAdmin = makeAuthMiddleware("admin");

export const requireSuperAdmin = (req, res, next) => {
  if (!req.user?.isSuperadmin) {
    return res.status(403).json({ success: false, error: "Superadmin access required." });
  }
  next();
};

export const requireAdmin = (req, res, next) => {
  if (!req.user?.isAdmin && !req.user?.isSuperadmin) {
    return res.status(403).json({ success: false, error: "Admin access required." });
  }
  next();
};

export const requirePermission = (moduleName, permName) => (req, res, next) => {
  if (req.user?.isSuperadmin) return next();
  const perms = req.user?.permissions?.[moduleName] ?? [];
  if (!perms.includes(permName)) {
    return res.status(403).json({
      success: false,
      error: `Permission "${permName}" on "${moduleName}" is required.`,
    });
  }
  next();
};

export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({
      success: false,
      error: "Invalid data.",
      errors: result.error.flatten().fieldErrors,
    });
  }
  req.validatedBody = result.data;
  next();
};
