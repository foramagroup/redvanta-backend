// ═══════════════════════════════════════════════════════════
// src/controllers/superadmin/blog.analytics.controller.js
// Analytics pageviews blog — superadmin
// ═══════════════════════════════════════════════════════════

import prisma from "../../config/database.js";

// ── GET /api/superadmin/blog/analytics ───────────────────────
// Retourne les stats globales + top articles (30 derniers jours)
export const getBlogAnalytics = async (req, res, next) => {
  try {
    const days  = parseInt(req.query.days  ?? "30");
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Totaux globaux
    const [totalViews, totalArticles, publishedArticles] = await Promise.all([
      prisma.blogPageview.count({ where: { viewedAt: { gte: since } } }),
      prisma.blogArticle.count(),
      prisma.blogArticle.count({ where: { published: true } }),
    ]);

    // Top 10 articles par pageviews
    const topRaw = await prisma.blogPageview.groupBy({
      by:      ["articleId"],
      where:   { viewedAt: { gte: since } },
      _count:  { id: true },
      orderBy: { _count: { id: "desc" } },
      take:    10,
    });

    const topIds = topRaw.map((r) => r.articleId);
    const topArticles = topIds.length
      ? await prisma.blogArticle.findMany({
          where:   { id: { in: topIds } },
          include: { translations: { where: { lang: "en" } } },
        })
      : [];

    const topWithViews = topRaw.map((r) => {
      const art = topArticles.find((a) => a.id === r.articleId);
      return {
        articleId: r.articleId,
        slug:      art?.slug ?? r.articleId,
        title:     art?.translations[0]?.title ?? art?.slug ?? r.articleId,
        views:     r._count.id,
      };
    });

    // Vues par jour (courbe)
    const dailyRaw = await prisma.$queryRaw`
      SELECT DATE(viewed_at) AS day, COUNT(*) AS views
      FROM blog_pageviews
      WHERE viewed_at >= ${since}
      GROUP BY DATE(viewed_at)
      ORDER BY day ASC
    `;

    const daily = (dailyRaw ?? []).map((r) => ({
      day:   r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day),
      views: Number(r.views),
    }));

    res.json({
      success: true,
      data: {
        totalViews,
        totalArticles,
        publishedArticles,
        topArticles: topWithViews,
        daily,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/client/blog/articles/:id/view ──────────────────
// Endpoint public — enregistre une pageview
export const trackPageview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const lang    = (req.query.lang || req.body?.lang || "en").slice(0, 10);
    const referer = (req.headers.referer || "").slice(0, 500) || null;

    const article = await prisma.blogArticle.findUnique({
      where:  { id },
      select: { id: true, published: true },
    });
    if (!article || !article.published) {
      return res.status(404).json({ success: false, error: "Article not found" });
    }

    await prisma.blogPageview.create({ data: { articleId: id, lang, referer } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
