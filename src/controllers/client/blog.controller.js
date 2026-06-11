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
    image:         a.image      ?? "",
    author:        a.author     ?? "",
    date:          a.date       ?? "",
    readTime:      a.readTime   ?? "",
    published:     a.published,
    publishedAt:   a.publishedAt,
    categoryId:    a.categoryId ?? "",
    tagIds:        (a.tags ?? []).map((t) => t.tagId),
    translations,
    previousSlugs: (a.previousSlugs ?? []).map((s) => s.slug),
    createdAt:     a.createdAt,
    updatedAt:     a.updatedAt,
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
// Retourne tous les articles publiés avec leurs traductions,
// tags et anciens slugs.  Aucun filtre côté serveur — le
// client filtre par catégorie / tags / recherche.
export const listPublicArticles = async (req, res, next) => {
  try {
    const articles = await prisma.blogArticle.findMany({
      where: { published: true },
      include: {
        translations:  true,
        tags:          true,
        previousSlugs: true,
      },
      orderBy: { publishedAt: "desc" },
    });

    res.json({
      success: true,
      data: articles.map(serializeArticle),
    });
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
