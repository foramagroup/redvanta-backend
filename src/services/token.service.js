

import jwt   from "jsonwebtoken";
import prisma from "../config/database.js";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return secret;
}

function getJwtExpires() {
  return process.env.JWT_EXPIRES_IN || "7d";
}

// ─── Générer le JWT ───────────────────────────────────────────
export function generateToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: getJwtExpires() });
}

// ─── Vérifier le JWT ─────────────────────────────────────────
export function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

// ─── Options du cookie HttpOnly ──────────────────────────────
// HttpOnly  → inaccessible au JavaScript (protège contre XSS)
// Secure    → HTTPS uniquement en production
// SameSite  → protège contre CSRF
// Path      → le cookie n'est envoyé que sur les routes API

export function getCookieOptions(name) {
  const isProd = process.env.NODE_ENV === "production";

  const configs = {
    // Cookie superadmin — valide 7 jours
    sa_token: {
      httpOnly: true,
      secure:   isProd,
      sameSite: isProd ? "strict" : "lax",
      maxAge:   7 * 24 * 60 * 60 * 1000,  // 7 jours en ms
      path:     "/",
    },
    // Cookie admin — valide 7 jours
    admin_token: {
      httpOnly: true,
      secure:   isProd,
      sameSite: isProd ? "strict" : "lax",
      maxAge:   7 * 24 * 60 * 60 * 1000,
      path:     "/",
    },
  };

  return configs[name] ?? configs.admin_token;
}

// ─── Nettoyer (révoquer) un token en DB ──────────────────────
// Optionnel : blacklist pour invalidation immédiate (logout avant expiration)
export async function blacklistToken(token) {
  try {
    const decoded   = verifyToken(token);
    const expiresAt = new Date(decoded.exp * 1000);
    await prisma.tokenBlacklist.create({
      data: { token, expiresAt },
    }).catch(() => {}); // ignorer si la table n'existe pas
  } catch {
    // token déjà invalide — pas de problème
  }
}

// ─── Vérifier si un token est blacklisté ─────────────────────
export async function isBlacklisted(token) {
  try {
    const record = await prisma.tokenBlacklist.findUnique({ where: { token } });
    return !!record;
  } catch {
    return false; // si la table n'existe pas, on ignore
  }
}
