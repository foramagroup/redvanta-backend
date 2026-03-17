import prisma from "../config/prisma.js";

/**
 * GET /api/dashboard/:uid
 * Retourne KPIs, sales by month, userTypes, nfc counts
 */
export async function getDashboard(req, res) {
  const uid = req.params.uid;
  try {
    // exemple : récupérer quelques KPIs
    const usersCount = await prisma.user.count({ where: { ownerId: uid } });
    const salesAgg = await prisma.order.aggregate({
      _sum: { total: true },
      where: { /* add filter by location.ownerId = uid if needed */ },
    });
    const salesTotal = salesAgg._sum.total || 0;

    // monthly sales (simple example)
    const salesByMonth = await prisma.$queryRaw`
      SELECT DATE_FORMAT(createdAt, '%Y-%m') as month, SUM(totalCents) as total
      FROM \`Order\`
      WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY month
      ORDER BY month
    `;

    // user types example
    const userTypes = [
      { name: "owners", value: usersCount },
      { name: "staff", value: 0 },
      { name: "customers", value: 0 }
    ];

    // nfc scans count
    const nfcCount = await prisma.nfcScan.count({ where: { ownerId: uid } }).catch(()=>0);

    res.json({
      users: usersCount,
      sales: Math.round((sales._sum.totalCents || 0) / 100),
      salesByMonth: (salesByMonth || []).map(r => ({ label: r.month, value: Math.round((r.total || 0)/100) })),
      userTypes,
      nfc: nfcCount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal_error" });
  }
}

/**
 * GET /api/dashboard/nfc
 * Retourne liste de scans récentes
 */
export async function getNfcStats(req, res) {
  try {
    const rows = await prisma.nfcScan.findMany({
      orderBy: { createdAt: "desc" },
      take: 200
    });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal_error" });
  }
}

export async function getNfcTagsForUid(req, res) {
  const uid = req.params.uid;
  try {
    // récupère tags liés aux locations de l'owner uid ou userId == uid
    const tags = await prisma.nFCTag.findMany({
      where: {
        OR: [{ userId: uid }, { location: { ownerId: uid } }],
      },
      include: {
        scans: { orderBy: { at: "desc" }, take: 10 },
        product: true,
        location: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json(tags);
  } catch (err) {
    console.error("getNfcTagsForUid", err);
    res.status(500).json({ error: "internal_error" });
  }
}

export async function getHeatmapPoints(req, res) {
  const uid = req.params.uid;
  try {
    // exemple: récupère derniers 500 scans
    const rows = await prisma.scanLog.findMany({
      where: { /* optionally: ownerId: uid */ },
      orderBy: { at: "desc" },
      take: 500,
      select: { lat: true, lon: true, country: true, city: true, at: true, nfcTagId: true },
    });

    // filter lat/lon not null
    const points = rows.filter(r => r.lat !== null && r.lon !== null);
    res.json(points);
  } catch (err) {
    console.error("getHeatmapPoints", err);
    res.status(500).json({ error: "internal_error" });
  }
}

/**
 * GET /api/dashboard/:uid/nfc/:tagId
 * Détail d'un tag (scans, geo)
 */
export async function getNfcTagDetail(req, res) {
  const { uid, tagId } = req.params;
  try {
    const tag = await prisma.nFCTag.findUnique({ where: { id: tagId }});
    if (!tag) return res.status(404).json({ error: "not_found" });

    const scans = await prisma.nfcScan.findMany({
      where: { nfcTagId: tagId },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    res.json({ tag, scans });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal_error" });
  }
}
