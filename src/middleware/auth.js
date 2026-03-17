// backend/src/middleware/auth.js
import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET || "change_me";

// Require authentication
export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.token || req.headers?.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized: no token" });

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded?.id) return res.status(401).json({ error: "Unauthorized: invalid token" });

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) return res.status(401).json({ error: "Unauthorized: user not found" });

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isSuperadmin: Boolean(user.isSuperadmin),
    };

    next();
  } catch (err) {
    console.error("requireAuth error:", err.message);
    return res.status(401).json({ error: "Unauthorized" });
  }
}

// Require admin role
export async function requireAdmin(req, res, next) {
  try {
    // Ensure the user is authenticated first
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    
    // Check role
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden: Admins only" });
    }

    next();
  } catch (err) {
    console.error("requireAdmin error:", err.message);
    return res.status(403).json({ error: "Forbidden" });
  }
}
