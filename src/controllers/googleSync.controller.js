import prisma from "../config/database.js";
import { getValidToken } from "./googleLocations.controller.js";

// Shared sync logic (also used by cron)
export async function runSync(companyId) {
  const conn = await prisma.googleConnection.findUnique({ where: { companyId } });
  if (!conn) throw new Error("No Google connection for company " + companyId);

  const token = await getValidToken(companyId);
  const locations = await prisma.googleBusinessLocation.findMany({
    where: { companyId, connected: true },
  });

  let totalSynced = 0;
  let totalNew = 0;
  const errors = [];

  for (const loc of locations) {
    try {
      const resp = await fetch(
        `https://mybusiness.googleapis.com/v4/${loc.locationId}/reviews?pageSize=50`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const reviews = data.reviews ?? [];

      for (const r of reviews) {
        const existing = await prisma.review.findFirst({
          where: { companyId, googleReviewId: r.reviewId },
        });
        if (!existing) {
          await prisma.review.create({
            data: {
              companyId,
              locationId: loc.id,
              googleReviewId: r.reviewId,
              rating: Math.round(["ONE", "TWO", "THREE", "FOUR", "FIVE"].indexOf(r.starRating) + 1),
              comment: r.comment ?? null,
              authorName: r.reviewer?.displayName ?? null,
              source: "google",
              createdAt: r.createTime ? new Date(r.createTime) : undefined,
            },
          });
          totalNew++;
        }
        totalSynced++;
      }

      // Update location stats
      if (reviews.length > 0) {
        const avg = reviews.reduce((s, rv) => {
          return s + (["ONE", "TWO", "THREE", "FOUR", "FIVE"].indexOf(rv.starRating) + 1);
        }, 0) / reviews.length;
        await prisma.googleBusinessLocation.update({
          where: { id: loc.id },
          data: { reviewCount: { increment: totalNew }, rating: Math.round(avg * 10) / 10 },
        });
      }
    } catch (e) {
      errors.push({ locationId: loc.locationId, error: e.message });
    }
  }

  await prisma.googleConnection.update({
    where: { companyId },
    data: { lastSyncAt: new Date(), reviewsSynced: { increment: totalNew } },
  });

  return { synced: totalSynced, newReviews: totalNew, errors, locations: locations.length };
}

// POST /api/admin/google/sync
export async function syncNow(req, res) {
  const companyId = req.user.companyId;
  try {
    const result = await runSync(companyId);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/google/sync/logs
export async function getSyncLogs(req, res) {
  const companyId = req.user.companyId;
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  try {
    // Return recent reviews synced from Google as audit log
    const reviews = await prisma.review.findMany({
      where: { companyId, source: "google" },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        googleReviewId: true,
        rating: true,
        comment: true,
        authorName: true,
        createdAt: true,
        location: { select: { name: true } },
      },
    });
    res.json({ logs: reviews, total: reviews.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
