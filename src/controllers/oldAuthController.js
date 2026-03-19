
import prisma from "../config/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "change_me";
const TOKEN_EXP = "7d";

// LOGIN
export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email & password required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password || "");
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_EXP });

    // Set cookie for credentials
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 3600 * 1000,
      path: "/",
    });

    const safeUser = { id: user.id, email: user.email, name: user.name, role: user.role };
    return res.json({ ok: true, token, user: safeUser });
  } catch (err) {
    console.error("login error", err);
    return res.status(500).json({ error: "Internal error" });
  }
}

// REGISTER
export async function registerUser(req, res) {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email & password required" });

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(400).json({ error: "Email already used" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, password: hashed, name } });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_EXP });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 3600 * 1000,
      path: "/",
    });

    res.json({ ok: true, token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    console.error("register error", err);
    res.status(500).json({ error: "Internal error" });
  }
}

// GET /me
export async function me(req, res) {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const u = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!u) return res.status(404).json({ error: "User not found" });
    return res.json({ ok: true, user: { id: u.id, email: u.email, name: u.name, role: u.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
}

// LOGOUT
export async function logout(req, res) {
  res.clearCookie("token", { path: "/" });
  res.json({ ok: true });
}
