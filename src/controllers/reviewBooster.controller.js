import prisma from "../config/database.js";

// GET /api/admin/ai/review-booster/analytics
export async function getBoosterAnalytics(req, res) {
  const companyId = Number(req.user.companyId);
  if (!companyId) return res.status(400).json({ error: "companyId missing from session" });
  const days = Math.min(Number(req.query.days ?? 30), 365);

  try {
    const since = new Date(Date.now() - days * 86400_000);

    // generated  = événements créés par le backend au moment de la génération IA (reviewSubmitted: false)
    // submitted  = événements créés par le frontend à la soumission (reviewSubmitted: true)
    // withSuggestion = soumissions où le client a utilisé la suggestion IA
    console.log(`[getBoosterAnalytics] companyId=${companyId} days=${days} since=${since.toISOString()}`);

    const [generated, withSuggestion, submitted, scansShown] = await Promise.all([
      prisma.reviewBoosterEvent.count({ where: { companyId, createdAt: { gte: since }, reviewSubmitted: false } }),
      prisma.reviewBoosterEvent.count({ where: { companyId, createdAt: { gte: since }, reviewSubmitted: true, suggestionUsed: true } }),
      prisma.reviewBoosterEvent.count({ where: { companyId, createdAt: { gte: since }, reviewSubmitted: true } }),
      prisma.nfcScan.count({ where: { companyId, scannedAt: { gte: since } } }),
    ]);

    // Average rating for submitted booster events
    const avgResult = await prisma.reviewBoosterEvent.aggregate({
      where: { companyId, createdAt: { gte: since }, reviewSubmitted: true },
      _avg: { rating: true },
    });

    // Daily series — generated = suggestions IA demandées, booster = soumis avec suggestion, published = tous les soumis
    const series = await prisma.$queryRaw`
      SELECT
        DATE(createdAt) AS \`date\`,
        SUM(CASE WHEN reviewSubmitted = 0 THEN 1 ELSE 0 END) AS \`generated\`,
        SUM(CASE WHEN suggestionUsed = 1 THEN 1 ELSE 0 END) AS \`booster\`,
        SUM(CASE WHEN reviewSubmitted = 1 THEN 1 ELSE 0 END) AS \`published\`
      FROM review_booster_events
      WHERE companyId = ${companyId}
        AND createdAt >= ${since}
      GROUP BY DATE(createdAt)
      ORDER BY \`date\` ASC
    `;

    // Google growth: reviews with source=google created in range
    const googleGrowth = await prisma.review.count({
      where: { companyId, source: "google", createdAt: { gte: since } },
    });

    // Performance table : uniquement les soumissions (reviewSubmitted: true), last 50
    const events = await prisma.reviewBoosterEvent.findMany({
      where: { companyId, createdAt: { gte: since }, reviewSubmitted: true },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        locationId: true,
        rating: true,
        suggestionUsed: true,
        reviewSubmitted: true,
        createdAt: true,
      },
    });

    // total = all interactions (generation events + submission events)
    const total = generated + submitted;

    res.json({
      requests: total,         // toutes les interactions (génération IA + soumissions)
      completions: submitted,  // avis soumis (frontend events)
      conversionRate: generated > 0 ? Math.round((submitted / generated) * 100) : (total > 0 ? 100 : 0),
      averageRating: avgResult._avg.rating ?? 0,
      suggestionUsagePct: submitted > 0 ? Math.round((withSuggestion / submitted) * 100) : 0,
      googleGrowth,
      funnel: {
        shown: scansShown,     // tous les scans NFC
        used: withSuggestion,  // ont utilisé la suggestion IA ET soumis
        submitted,             // ont soumis un avis
      },
      series: series.map((row) => ({
        date: new Date(row.date).toLocaleDateString("en", { month: "short", day: "numeric" }),
        generated: Number(row.generated),
        booster: Number(row.booster),
        published: Number(row.published),
      })),
      events: events.map((e) => ({
        date: e.createdAt.toISOString(),
        locationId: e.locationId,
        rating: e.rating,
        suggestionUsed: e.suggestionUsed,
        reviewSubmitted: e.reviewSubmitted,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/review/booster-event  (public — called from NFC scan flow)
export async function recordBoosterEvent(req, res) {
  const { nfcCardUid, rating, suggestionUsed, reviewSubmitted, locationId } = req.body;

  if (!nfcCardUid || !rating) return res.status(400).json({ error: "nfcCardUid and rating are required" });

  try {
    const card = await prisma.nFCCard.findUnique({
      where: { uid: nfcCardUid },
      select: { companyId: true, id: true, locationId: true },
    });
    if (!card) return res.status(404).json({ error: "Card not found" });

    await prisma.reviewBoosterEvent.create({
      data: {
        companyId: card.companyId,
        nfcCardId: card.id,
        locationId: locationId ?? card.locationId,
        rating: Number(rating),
        suggestionUsed: !!suggestionUsed,
        reviewSubmitted: !!reviewSubmitted,
      },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("[recordBoosterEvent] error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
