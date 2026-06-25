// ═══════════════════════════════════════════════════════════
// src/controllers/client/blog.controller.js
// Blog public — articles, catégories, tags (aucune auth)
// Format de réponse identique aux controllers superadmin pour
// que le store Zustand frontend puisse réutiliser les mêmes
// fonctions de désérialisation.
// ═══════════════════════════════════════════════════════════

import prisma from "../../config/database.js";

// ── Serializers (miroir exact des serializers superadmin) ──

function serializeArticle(a) {
  const translations = {};
  for (const t of (a.translations ?? [])) {
    translations[t.lang] = {
      slug:            t.slug,
      title:           t.title,
      excerpt:         t.excerpt         ?? "",
      content:         t.content         ?? "",
      metaTitle:       t.metaTitle       ?? "",
      metaDescription: t.metaDescription ?? "",
    };
  }
  return {
    id:            a.id,
    slug:          a.slug,
    image:         a.image         ?? "",
    author:        a.author        ?? "",
    date:          a.date          ?? "",
    readTime:      a.readTime      ?? "",
    published:     a.published,
    publishedAt:   a.publishedAt,
    categoryId:    a.categoryId    ?? "",
    hubId:         a.hubId         ?? "",
    targetKeyword: a.targetKeyword ?? "",
    faqs:          (a.faqs ?? []).map((f) => ({ id: f.id, question: f.question, answer: f.answer })),
    tagIds:        (a.tags ?? []).map((t) => t.tagId),
    translations,
    previousSlugs: (a.previousSlugs ?? []).map((s) => s.slug),
    createdAt:     a.createdAt,
    updatedAt:     a.updatedAt,
  };
}

function serializeHub(h) {
  const translations = {};
  for (const t of (h.translations ?? [])) {
    translations[t.lang] = {
      slug:            t.slug,
      title:           t.title,
      description:     t.description     ?? "",
      content:         t.content         ?? "",
      metaTitle:       t.metaTitle       ?? "",
      metaDescription: t.metaDescription ?? "",
    };
  }
  return {
    id:          h.id,
    slug:        h.slug,
    hubType:     h.hubType,
    coverImage:  h.coverImage ?? "",
    published:   h.published,
    translations,
    articleCount: h._count?.articles ?? 0,
    createdAt:   h.createdAt,
    updatedAt:   h.updatedAt,
  };
}

function serializeCategory(c) {
  const translations = {};
  for (const t of (c.translations ?? [])) {
    translations[t.lang] = {
      slug:            t.slug,
      name:            t.name,
      description:     t.description     ?? "",
      metaTitle:       t.metaTitle        ?? "",
      metaDescription: t.metaDesc         ?? "",
    };
  }
  return {
    id:           c.id,
    slug:         c.slug,
    displayOrder: c.displayOrder,
    translations,
    createdAt:    c.createdAt,
    updatedAt:    c.updatedAt,
  };
}

function serializeTag(t) {
  const translations = {};
  for (const tr of (t.translations ?? [])) {
    translations[tr.lang] = { slug: tr.slug, name: tr.name };
  }
  return {
    id:        t.id,
    slug:      t.slug,
    translations,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

// ── GET /api/client/blog/articles ────────────────────────────
export const listPublicArticles = async (req, res, next) => {
  try {
    const articles = await prisma.blogArticle.findMany({
      where: { published: true },
      include: {
        translations:  true,
        tags:          true,
        previousSlugs: true,
        faqs:          { orderBy: { position: "asc" } },
      },
      orderBy: { publishedAt: "desc" },
    });

    res.json({ success: true, data: articles.map(serializeArticle) });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/client/blog/hubs ────────────────────────────────
export const listPublicHubs = async (req, res, next) => {
  try {
    const hubs = await prisma.blogHub.findMany({
      where:   { published: true },
      include: {
        translations: true,
        _count: { select: { articles: { where: { published: true } } } },
      },
      orderBy: { createdAt: "asc" },
    });
    res.json({ success: true, data: hubs.map(serializeHub) });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/client/blog/hubs/:slug ──────────────────────────
export const getPublicHub = async (req, res, next) => {
  try {
    const hub = await prisma.blogHub.findFirst({
      where: { slug: req.params.slug, published: true },
      include: {
        translations: true,
        _count: { select: { articles: { where: { published: true } } } },
      },
    });
    if (!hub) return res.status(404).json({ success: false, error: "Hub not found" });

    // Articles de ce hub (publiés)
    const articles = await prisma.blogArticle.findMany({
      where:   { hubId: hub.id, published: true },
      include: { translations: { where: { lang: "en" } } },
      orderBy: { publishedAt: "desc" },
    });

    res.json({
      success: true,
      data: {
        ...serializeHub(hub),
        articles: articles.map((a) => ({
          id:       a.id,
          slug:     a.slug,
          title:    a.translations[0]?.title ?? a.slug,
          image:    a.image ?? "",
          date:     a.date ?? "",
          readTime: a.readTime ?? "",
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/client/blog/articles/:id/view ──────────────────
export const trackPageview = async (req, res, next) => {
  try {
    const { id }  = req.params;
    const lang    = (req.query.lang || req.body?.lang || "en").slice(0, 10);
    const referer = (req.headers.referer || "").slice(0, 500) || null;

    const article = await prisma.blogArticle.findFirst({
      where: { id, published: true }, select: { id: true },
    });
    if (!article) return res.status(404).json({ success: false, error: "Not found" });

    await prisma.blogPageview.create({ data: { articleId: id, lang, referer } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/client/blog/categories ─────────────────────────
// Toutes les catégories (même celles sans articles publiés)
// avec leurs traductions et slug, triées par displayOrder.
export const listPublicCategories = async (req, res, next) => {
  try {
    const categories = await prisma.blogCategory.findMany({
      include: { translations: true },
      orderBy: { displayOrder: "asc" },
    });

    res.json({
      success: true,
      data: categories.map(serializeCategory),
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/client/blog/tags ────────────────────────────────
// Tous les tags avec leurs traductions.
export const listPublicTags = async (req, res, next) => {
  try {
    const tags = await prisma.blogTag.findMany({
      include: { translations: true },
      orderBy: { slug: "asc" },
    });

    res.json({
      success: true,
      data: tags.map(serializeTag),
    });
  } catch (err) {
    next(err);
  }
};
