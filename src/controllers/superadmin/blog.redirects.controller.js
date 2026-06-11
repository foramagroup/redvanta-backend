// ═══════════════════════════════════════════════════════════
// src/controllers/superadmin/blog.redirects.controller.js
// Redirect map : construit depuis blog_article_previous_slugs
// ═══════════════════════════════════════════════════════════

import prisma from "../../config/database.js";

// ── GET /api/superadmin/blog/redirects ───────────────────────
// Retourne { generatedAt, entries, conflicts }
// Chaque entry : { kind, from, to, lang, itemId }
export const getRedirectMap = async (req, res, next) => {
  try {
    // Récupère tous les previous slugs avec l'article + ses traductions
    const rows = await prisma.blogArticlePreviousSlug.findMany({
      include: {
        article: {
          include: { translations: true },
        },
      },
      orderBy: { id: "asc" },
    });

    const entries = [];
    const groups  = new Map();

    for (const ps of rows) {
      const { article } = ps;
      if (!article) continue;

      // Slug courant pour ce niveau (lang="" → slug racine de l'article,
      // lang="en"/"fr"/… → slug de la traduction correspondante)
      let currentSlug;
      if (!ps.lang) {
        currentSlug = article.slug;
      } else {
        const tr = article.translations.find((t) => t.lang === ps.lang);
        currentSlug = tr?.slug ?? article.slug;
      }

      if (!currentSlug || currentSlug === ps.slug) continue;

      const lang = ps.lang || "en";
      const entry = {
        kind:           "article",
        from:           `/article/${ps.slug}`,
        to:             `/article/${currentSlug}`,
        lang,
        itemId:         article.id,
        sourcePrevSlug: ps.slug,
      };

      entries.push(entry);

      const key = `${lang}::${entry.from}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    }

    // Détecte les conflits : même `from` pointe vers plusieurs articles
    const conflicts = [];
    for (const [, arr] of groups) {
      const distinct = new Set(arr.map((e) => e.itemId));
      if (distinct.size <= 1) continue;

      const targets = [...new Map(arr.map((e) => [e.itemId, e])).values()].map((e) => ({
        itemId:    e.itemId,
        kind:      e.kind,
        to:        e.to,
      }));
      const keep = targets[0];
      const drop = targets.slice(1);
      conflicts.push({
        from:           arr[0].from,
        lang:           arr[0].lang,
        sourcePrevSlug: arr[0].sourcePrevSlug,
        targets,
        suggestion: `Keep "${keep.to}" as the redirect target and remove "${arr[0].sourcePrevSlug}" from previousSlugs of: ${drop.map((d) => `"${d.to}"`).join(", ")}.`,
      });
    }

    res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        entries,
        conflicts,
      },
    });
  } catch (err) {
    next(err);
  }
};
