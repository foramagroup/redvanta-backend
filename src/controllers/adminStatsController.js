// backend/src/controllers/adminStatsController.js
import prisma from "../prismaClient.js";

// GET /api/admin/stats
export async function getGlobalStats(req, res) {
  try {
    const usersCount = await prisma.user.count();
    const ordersCount = await prisma.order.count();
    const totalSales = await prisma.order.aggregate({ _sum: { total: true } });

    const monthlySales = await prisma.order.groupBy({
      by: ["createdAt"],
      _sum: { total: true },
      orderBy: { createdAt: "asc" },
    });

    res.json({
      success: true,
      data: {
        users: usersCount,
        orders: ordersCount,
        revenue: totalSales._sum.total || 0,
        monthlySales,
      },
    });
  } catch (err) {
    console.error("❌ Error getGlobalStats:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

// GET /api/admin/stats/heatmap
export async function getHeatmapData(req, res) {
  try {
    const scans = await prisma.nfcScan.findMany({
      select: { lat: true, lng: true, intensity: true },
    });
    res.json({ success: true, scans });
  } catch (err) {
    console.error("❌ Error getHeatmapData:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}
