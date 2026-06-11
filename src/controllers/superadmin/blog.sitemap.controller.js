// ═══════════════════════════════════════════════════════════
// src/controllers/superadmin/blog.sitemap.controller.js
// Génération du sitemap.xml (JSON ou XML) — superadmin
// ═══════════════════════════════════════════════════════════

import prisma from "../../config/database.js";

// Langues supportées (même ordre que le frontend LANGUAGES)
const LANGS = ["en", "fr", "de", "es", "ar", "zh", "ro", "ru"];
const DEFAULT_LANG = "en";

// ── Helpers ───────────────────────────────────────────────────

function escapeXml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function slugFor(translations, lang, fallback) {
  const tr = translations.find((t) => t.lang === lang);
  return tr?.slug ?? fallback;
}

function buildPath(prefix, slug, lang) {
  const path = `${prefix}/${slug}`;
  return lang === DEFAULT_LANG ? path : `${path}?lang=${lang}`;
}

function buildAlternates(translations, fallbackSlug, prefix) {
  return LANGS.map((lang) => ({
    lang,
    url: buildPath(prefix, slugFor(translations, lang, fallbackSlug), lang),
  }));
}

function formatDate(dt) {
  return dt instanceof Date ? dt.toISOString().split("T")[0] : "";
}

// ── Construit l'XML sitemap depuis la liste d'URLs ────────────

function toXml(baseUrl, urls) {
  const entries = urls.map((u) => {
    const loc = escapeXml(`${baseUrl}${u.alternates[0].url}`);
    const alts = u.alternates
      .map(
        (a) =>
          `    <xhtml:link rel="alternate" hreflang="${escapeXml(a.lang)}" href="${escapeXml(`${baseUrl}${a.url}`)}"/>`,
      )
      .join("\n");
    return [
      "  <url>",
      `    <loc>${loc}</loc>`,
      `    <lastmod>${u.lastmod}</lastmod>`,
      `    <priority>${u.priority}</priority>`,
      alts,
      "  </url>",
    ].join("\n");
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    "</urlset>",
  ].join("\n");
}

// ── GET /api/superadmin/blog/sitemap ─────────────────────────
// Query: ?format=json|xml  (default: json)
// Si format=xml, marque aussi sitemap_last_build en DB
export const getSitemap = async (req, res, next) => {
  try {
    const format = (req.query.format ?? "json").toLowerCase();

    // Base URL depuis les settings
    const baseUrlSetting = await prisma.blogSetting.findUnique({
      where: { key: "sitemap_base_url" },
    });
    const baseUrl = (baseUrlSetting?.value ?? "").trim().replace(/\/$/, "");

    // Charger les données
    const [articles, categories, tags] = await Promise.all([
      prisma.blogArticle.findMany({
        where:   { published: true },
        include: { translations: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.blogCategory.findMany({
        include: { translations: true },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      }),
      prisma.blogTag.findMany({
        include: { translations: true },
        orderBy: { slug: "asc" },
      }),
    ]);

    // Construire la liste d'URLs
    const urls = [];

    for (const a of articles) {
      urls.push({
        kind:       "article",
        slug:       a.slug,
        lastmod:    formatDate(a.updatedAt),
        priority:   "0.8",
        alternates: buildAlternates(a.translations, a.slug, "/article"),
      });
    }
    for (const c of categories) {
      urls.push({
        kind:       "category",
        slug:       c.slug,
        lastmod:    formatDate(c.updatedAt),
        priority:   "0.6",
        alternates: buildAlternates(c.translations, c.slug, "/category"),
      });
    }
    for (const t of tags) {
      urls.push({
        kind:       "tag",
        slug:       t.slug,
        lastmod:    formatDate(t.updatedAt),
        priority:   "0.5",
        alternates: buildAlternates(t.translations, t.slug, "/tag"),
      });
    }

    if (format === "xml") {
      // Marque le timestamp de génération
      const iso = new Date().toISOString();
      await prisma.blogSetting.upsert({
        where:  { key: "sitemap_last_build" },
        update: { value: iso },
        create: { key: "sitemap_last_build", value: iso },
      });

      res.set("Content-Type", "application/xml; charset=utf-8");
      return res.send(toXml(baseUrl, urls));
    }

    res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        baseUrl,
        total:       urls.length,
        urls,
      },
    });
  } catch (err) {
    next(err);
  }
};
