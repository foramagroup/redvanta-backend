// src/controllers/client/display.controller.js
// ─────────────────────────────────────────────────────────────
// Endpoint public appelé par display.js depuis des sites externes.
// Aucun JWT requis — auth par widgetId + token uniquement.
//
// GET /api/client/display/reviews
//   ?widgetId=ID&token=TOKEN&limit=6&locale=fr&featured=0&theme=light
//   → { reviews: [...], summary: { count, avg } }
// ─────────────────────────────────────────────────────────────

import prisma from "../../config/database.js";

// ─── Formate une soumission vers le format attendu par display.js ──
function formatReview(sub) {
  return {
    author:   sub.name  || "Anonymous",
    rating:   sub.rating,
    text:     sub.comment || "",
    date:     sub.createdAt.toISOString(),
    verified: true,
    avatar:   null,
  };
}

// ─────────────────────────────────────────────────────────────
// GET /api/client/display/reviews
// ─────────────────────────────────────────────────────────────
export const getDisplayReviews = async (req, res, next) => {
  try {
    const {
      widgetId: rawId,
      token,
      limit:    rawLimit    = "6",
      locale:   _locale     = "en",
      featured: rawFeatured = "0",
    } = req.query;

    const widgetId = parseInt(rawId);
    if (isNaN(widgetId) || !token) {
      return res.status(400).json({ success: false, error: "widgetId et token requis." });
    }

    const limit    = Math.max(1, Math.min(parseInt(rawLimit) || 6, 50));
    const featured = rawFeatured === "1" || rawFeatured === "true";

    // Authentifier le widget par id + token
    const widget = await prisma.reviewWidget.findFirst({
      where: { id: widgetId, token },
      select: { id: true, status: true, companyId: true },
    });

    if (!widget) {
      return res.status(404).json({ success: false, error: "Widget introuvable ou token invalide." });
    }

    if (widget.status !== "active") {
      return res.json({ success: true, reviews: [], summary: { count: 0, avg: 0 } });
    }

    // Requête des soumissions publiques
    const where = {
      widgetId: widget.id,
      isPublic: true,
      ...(featured ? { rating: 5 } : {}),
    };

    const [submissions, totalCount] = await Promise.all([
      prisma.widgetSubmission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take:    limit,
        select:  { name: true, rating: true, comment: true, createdAt: true },
      }),
      prisma.widgetSubmission.count({ where: { widgetId: widget.id, isPublic: true } }),
    ]);

    const reviews = submissions.map(formatReview);
    const avg     = reviews.length
      ? Math.round((reviews.reduce((a, r) => a + r.rating, 0) / reviews.length) * 10) / 10
      : 0;

    res.json({
      success: true,
      reviews,
      summary: { count: totalCount, avg },
    });
  } catch (e) {
    next(e);
  }
};
