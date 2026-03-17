// backend/src/controllers/adminSalesController.js
import prisma from "../prismaClient.js";

// GET /api/admin/sales
export async function getSalesGraph(req, res) {
  try {
    const sales = await prisma.order.findMany({
      include: { user: true, items: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, sales });
  } catch (err) {
    console.error("❌ Error getSalesGraph:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

// GET /api/admin/sales/monthly
export async function getMonthlySales(req, res) {
  const series = await prisma.order.groupBy({
    by: ["createdAt"],
    _sum: { total: true },
    orderBy: { createdAt: "asc" },
  });
  res.json({ success: true, series });
}

// GET /api/admin/sales/top-products
export async function getTopProducts(req, res) {
  try {
    const products = await prisma.orderItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10,
    });
    res.json({ success: true, products });
  } catch (err) {
    console.error("❌ Error getTopProducts:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}
