// src/controllers/superadmin/authController.js

import prisma  from "../../config/database.js";
import bcrypt  from "bcryptjs";
import { generateToken, getCookieOptions, blacklistToken } from "../../services/token.service.js";
import { loadUserByEmail, loadUserForAuth, formatSuperAdmin } from "../../services/superadmin/auth.service.js";
import { errorResponse, successResponse } from "../../helpers/response.helper.js";


async function logActivity(userId, name, ip, userAgent, status) {
  await prisma.loginActivity.create({
    data: { userId: userId ?? null, admin_name: name ?? null, ip, userAgent, status },
  }).catch(console.error);
}

function getIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
    || req.socket?.remoteAddress
    || "unknown";
}

// ─── POST /api/superadmin/auth/login ─────────────────────────
export const login = async (req, res, next) => {
  const ip        = getIp(req);
  const userAgent = req.headers["user-agent"] ?? null;

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(422).json({ success: false, error: "Email and password are required" });
    }

    // Charger l'utilisateur
    const user = await loadUserByEmail(email, "superadmin");

    // Vérifier que c'est un superadmin
    if (!user || !user.isSuperadmin) {
      await logActivity(null, email, ip, userAgent, "failed");
      return  errorResponse(res, "auth.login_failed", {}, 401, null);
    }

    // Vérifier le mot de passe
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      await logActivity(user.id, user.name, ip, userAgent, "failed");
      return errorResponse(res, "auth.login_failed", {}, 401, null);
    }

    // Générer le JWT
    const token = generateToken({
      userId:       user.id,
      email:        user.email,
      isSuperadmin: true,
      isAdmin:      false,
    });

    // Mettre à jour lastLogin
    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

    // Logger la connexion
    await logActivity(user.id, user.name, ip, userAgent, "success");

    // ── Stocker le JWT dans un cookie HttpOnly ──────────────
    res.cookie("sa_token", token, getCookieOptions("sa_token"));

    // Retourner les infos user
    return  successResponse(res, "auth.login_success", {user:    formatSuperAdmin(user)}, {}, 200);
  } catch (e) {
    await logActivity(null, req.body?.email, ip, userAgent, "failed");
    next(e);
  }
};

// ─── GET /api/superadmin/auth/me ─────────────────────────────
export const me = async (req, res, next) => {
  try {
    const user = await loadUserForAuth(req.user.userId, "superadmin");
    if (!user || !user.isSuperadmin) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }
    return res.json({ success: true, user: formatSuperAdmin(user) });
  } catch (e) { next(e); }
};

// ─── POST /api/superadmin/auth/logout ────────────────────────
export const logout = async (req, res, next) => {
  try {
    // Blacklister le token courant pour l'invalider immédiatement
    if (req.token) {
      await blacklistToken(req.token);
    }
    // Logger la déconnexion
    if (req.user?.userId) {
      await logActivity(req.user.userId, null, getIp(req), req.headers["user-agent"], "logout");
    }
    // Effacer le cookie
    res.clearCookie("sa_token", { path: "/" });
    return res.json({ success: true, message: "Logged out successfully" });
    
  } catch (e) { next(e); }
};

// ─── GET /api/superadmin/auth/check ──────────────────────────
// Vérifier si la session est toujours valide
export const check = async (req, res) => {
  return res.json({ success: true, authenticated: true });
};