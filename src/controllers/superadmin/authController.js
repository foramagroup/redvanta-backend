import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../../config/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET || "change_me";
const TOKEN_EXP = "7d";
const LEGACY_SUPERADMIN_ROLES = new Set(["admin", "owner"]);

export async function login(req, res) {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Email & password required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password || "");
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const role = String(user.role || "").toLowerCase();
    const isSuperadmin = Boolean(user.isSuperadmin) || role === "superadmin" || LEGACY_SUPERADMIN_ROLES.has(role);
    if (!isSuperadmin) {
      return res.status(403).json({ error: "Forbidden: superadmin only" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email, scope: "superadmin" },
      JWT_SECRET,
      { expiresIn: TOKEN_EXP }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 3600 * 1000,
      path: "/",
    });

    return res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isSuperadmin: Boolean(user.isSuperadmin),
      },
    });
  } catch (err) {
    console.error("superadmin login error", err);
    return res.status(500).json({ error: "Internal error" });
  }
}

export async function me(req, res) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const role = String(user.role || "").toLowerCase();
    const isSuperadmin = Boolean(user.isSuperadmin) || role === "superadmin" || LEGACY_SUPERADMIN_ROLES.has(role);
    if (!isSuperadmin) {
      return res.status(403).json({ error: "Forbidden: superadmin only" });
    }

    return res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isSuperadmin: Boolean(user.isSuperadmin),
        superadminLastAt: user.superadminLastAt,
      },
    });
  } catch (err) {
    console.error("superadmin me error", err);
    return res.status(500).json({ error: "Internal error" });
  }
}

export function logout(req, res) {
  res.clearCookie("token", { path: "/" });
  return res.json({ ok: true });
}
