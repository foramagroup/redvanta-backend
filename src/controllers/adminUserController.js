// backend/src/controllers/adminUserController.js
import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";

/* ============================================================
 * GET /api/admin/users
 * ============================================================ */
export async function getUsers(req, res) {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const search = req.query.search || "";
    const role = req.query.role || null;

    const where = {
      AND: [
        search
          ? {
              OR: [
                { email: { contains: search, mode: "insensitive" } },
                { name: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
              ],
            }
          : {},
        role ? { role } : {},
      ],
    };

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          nfcTags: { select: { id: true } },
          locations: { select: { id: true } },
        },
      }),
    ]);

    return res.json({
      page,
      limit,
      total,
      items: users,
    });
  } catch (err) {
    console.error("GET USERS ERROR:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/* ============================================================
 * GET /api/admin/users/:id
 * ============================================================ */
export async function getUser(req, res) {
  try {
    const id = req.params.id;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        nfcTags: true,
        locations: true,
        orders: true,
        reviews: true,
        affiliates: true,
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    return res.json(user);
  } catch (err) {
    console.error("GET USER ERROR:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/* ============================================================
 * POST /api/admin/users
 * ============================================================ */
export async function createUser(req, res) {
  try {
    const { email, password, name, phone, role } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Email and password required" });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
      return res.status(409).json({ error: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: { email, password: hashed, name, phone, role: role || "user" },
    });

    return res.status(201).json(newUser);
  } catch (err) {
    console.error("CREATE USER ERROR:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/* ============================================================
 * PUT /api/admin/users/:id
 * ============================================================ */
export async function updateUser(req, res) {
  try {
    const id = req.params.id;
    const { email, name, phone, role, password } = req.body;

    const data = { email, name, phone, role };

    if (password && password.length > 3) {
      data.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
    });

    return res.json(user);
  } catch (err) {
    console.error("UPDATE USER ERROR:", err);
    if (err.code === "P2025")
      return res.status(404).json({ error: "User not found" });
    return res.status(500).json({ error: "Internal server error" });
  }
}

/* ============================================================
 * DELETE /api/admin/users/:id
 * ============================================================ */
export async function deleteUser(req, res) {
  try {
    const id = req.params.id;
    await prisma.user.delete({ where: { id } });
    return res.json({ success: true });
  } catch (err) {
    console.error("DELETE USER ERROR:", err);
    if (err.code === "P2025")
      return res.status(404).json({ error: "User not found" });
    return res.status(500).json({ error: "Internal server error" });
  }
}
