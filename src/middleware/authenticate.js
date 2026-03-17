
import jwt from "jsonwebtoken";
import prisma from "../config/database.js";

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Accès non autorisé" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true }
            }
          }
        }
      }
    });

    if (!user || !user.active) {
      return res.status(401).json({ success: false, message: "Utilisateur introuvable ou inactif" });
    }

    const permissions = user.role.permissions.map(rp => rp.permission.name);

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role.name,
      permissions: permissions
    };

    next();
  } catch (err) {
    const message = err.name === "TokenExpiredError" ? "Session expirée" : "Token invalide";
    return res.status(401).json({ success: false, message });
  }
};

