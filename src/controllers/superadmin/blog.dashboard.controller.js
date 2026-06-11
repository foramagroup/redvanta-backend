// ═══════════════════════════════════════════════════════════
// src/controllers/superadmin/blog.dashboard.controller.js
// Statistiques résumées pour le tableau de bord blog — superadmin
// ═══════════════════════════════════════════════════════════

import prisma from "../../config/database.js";

// ── GET /api/superadmin/blog/dashboard ───────────────────────
// Retourne :
//   articles   { total, published, draft }
//   categories { total }
//   tags       { total }
//   recent     [ 5 derniers articles modifiés ]
//   settings   { baseUrl, sitemapLastBuild }
export const getDashboardStats = async (req, res, next) => {
  try {
    const [
      totalArticles,
      publishedArticles,
      totalCategories,
      totalTags,
      recentArticles,
      baseUrlSetting,
      sitemapBuiltSetting,
    ] = await Promise.all([
      prisma.blogArticle.count(),
      prisma.blogArticle.count({ where: { published: true } }),
      prisma.blogCategory.count(),
      prisma.blogTag.count(),
      prisma.blogArticle.findMany({
        orderBy: { updatedAt: "desc" },
        take:    5,
        include: { translations: { where: { lang: "en" }, take: 1 } },
      }),
      prisma.blogSetting.findUnique({ where: { key: "sitemap_base_url" } }),
      prisma.blogSetting.findUnique({ where: { key: "sitemap_last_build" } }),
    ]);

    res.json({
      success: true,
      data: {
        articles: {
          total:     totalArticles,
          published: publishedArticles,
          draft:     totalArticles - publishedArticles,
        },
        categories: { total: totalCategories },
        tags:       { total: totalTags },
        recent: recentArticles.map((a) => ({
          id:        a.id,
          slug:      a.slug,
          title:     a.translations[0]?.title ?? a.slug,
          published: a.published,
          updatedAt: a.updatedAt,
        })),
        settings: {
          baseUrl:          baseUrlSetting?.value  ?? "",
          sitemapLastBuild: sitemapBuiltSetting?.value ?? null,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};
