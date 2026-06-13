import prisma from "../config/database.js";

// GET /api/admin/ai/review-booster/analytics
export async function getBoosterAnalytics(req, res) {
  const companyId = req.user.companyId;
  const days = Math.min(Number(req.query.days ?? 30), 365);

  try {
    const since = new Date(Date.now() - days * 86400_000);

    const [total, withSuggestion, submitted] = await Promise.all([
      prisma.reviewBoosterEvent.count({ where: { companyId, createdAt: { gte: since } } }),
      prisma.reviewBoosterEvent.count({ where: { companyId, createdAt: { gte: since }, suggestionUsed: true } }),
      prisma.reviewBoosterEvent.count({ where: { companyId, createdAt: { gte: since }, reviewSubmitted: true } }),
    ]);

    // Average rating for submitted booster events
    const avgResult = await prisma.reviewBoosterEvent.aggregate({
      where: { companyId, createdAt: { gte: since }, reviewSubmitted: true },
      _avg: { rating: true },
    });

    // Daily series
    const series = await prisma.$queryRaw`
      SELECT
        DATE(createdAt) AS date,
        COUNT(*) AS generated,
        SUM(CASE WHEN suggestionUsed = 1 THEN 1 ELSE 0 END) AS booster,
        SUM(CASE WHEN reviewSubmitted = 1 THEN 1 ELSE 0 END) AS published
      FROM review_booster_events
      WHERE companyId = ${companyId}
        AND createdAt >= ${since}
      GROUP BY DATE(createdAt)
      ORDER BY date ASC
    `;

    // Google growth: reviews with source=google created in range
    const googleGrowth = await prisma.review.count({
      where: { companyId, source: "google", createdAt: { gte: since } },
    });

    res.json({
      requests: total,
      completions: submitted,
      conversionRate: total > 0 ? Math.round((submitted / total) * 100) : 0,
      averageRating: avgResult._avg.rating ?? 0,
      suggestionUsagePct: total > 0 ? Math.round((withSuggestion / total) * 100) : 0,
      googleGrowth,
      series: series.map((row) => ({
        date: new Date(row.date).toLocaleDateString("en", { month: "short", day: "numeric" }),
        generated: Number(row.generated),
        booster: Number(row.booster),
        published: Number(row.published),
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
    res.status(500).json({ error: err.message });
  }
}
