import prisma from "../../config/prisma.js";

export async function getOverview(req, res) {
  try {
    const [users, orders, reviews, locations] = await Promise.all([
      prisma.user.count(),
      prisma.order.count(),
      prisma.review.count(),
      prisma.location.count(),
    ]);

    return res.json({
      ok: true,
      metrics: { users, orders, reviews, locations },
      actor: { id: req.user.id, email: req.user.email, role: req.user.role },
    });
  } catch (err) {
    console.error("superadmin dashboard error", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
