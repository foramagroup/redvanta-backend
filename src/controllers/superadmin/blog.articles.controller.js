// ═══════════════════════════════════════════════════════════
// src/controllers/superadmin/blog.articles.controller.js
// CRUD Articles de blog — superadmin
// ═══════════════════════════════════════════════════════════

import prisma from "../../config/database.js";

// ── Helpers ──────────────────────────────────────────────────

const slugify = (s = "") =>
  s.toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function buildTranslationRows(translations = {}) {
  return Object.entries(translations).map(([lang, t]) => ({
    lang,
    slug:            t.slug            || slugify(t.title || ""),
    title:           t.title           || "",
    excerpt:         t.excerpt         || null,
    content:         t.content         || null,
    metaTitle:       t.metaTitle       || null,
    metaDescription: t.metaDescription || null,
  }));
}

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
    image:         a.image     ?? "",
    author:        a.author    ?? "",
    date:          a.date      ?? "",
    readTime:      a.readTime  ?? "",
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

const ARTICLE_INCLUDE = {
  translations:  true,
  tags:          true,
  previousSlugs: true,
};

// ── GET /api/superadmin/blog/articles ────────────────────────
export const listArticles = async (req, res, next) => {
  try {
    const { search, published, categoryId, page = 1, limit = 50 } = req.query;

    const where = {};
    if (published !== undefined) where.published = published === "true";
    if (categoryId)               where.categoryId = categoryId;
    if (search) {
      where.translations = {
        some: {
          OR: [
            { title: { contains: search } },
            { slug:  { contains: search } },
          ],
        },
      };
    }

    const [articles, total] = await Promise.all([
      prisma.blogArticle.findMany({
        where,
        include: ARTICLE_INCLUDE,
        orderBy: { updatedAt: "desc" },
        skip:  (parseInt(page) - 1) * parseInt(limit),
        take:  parseInt(limit),
      }),
      prisma.blogArticle.count({ where }),
    ]);

    res.json({
      success: true,
      data: articles.map(serializeArticle),
      pagination: { page: +page, limit: +limit, total },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/superadmin/blog/articles/:id ────────────────────
export const getArticle = async (req, res, next) => {
  try {
    const article = await prisma.blogArticle.findUnique({
      where:   { id: req.params.id },
      include: ARTICLE_INCLUDE,
    });

    if (!article) {
      return res.status(404).json({ success: false, error: "Article not found" });
    }

    res.json({ success: true, data: serializeArticle(article) });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/superadmin/blog/articles ───────────────────────
export const createArticle = async (req, res, next) => {
  try {
    const {
      slug: rawSlug,
      image      = "",
      author     = "",
      date       = "",
      readTime   = "",
      categoryId = null,
      tagIds     = [],
      published  = false,
      translations = {},
    } = req.body;

    const enTitle = translations.en?.title;
    if (!enTitle) {
      return res.status(422).json({ success: false, error: "English title is required" });
    }

    const slug = rawSlug || slugify(enTitle);
    if (!slug) {
      return res.status(422).json({ success: false, error: "Slug is required" });
    }

    // Validate category exists
    if (categoryId) {
      const cat = await prisma.blogCategory.findUnique({ where: { id: categoryId } });
      if (!cat) {
        return res.status(422).json({ success: false, error: "Category not found" });
      }
    }

    // Validate tags exist
    if (tagIds.length) {
      const found = await prisma.blogTag.count({ where: { id: { in: tagIds } } });
      if (found !== tagIds.length) {
        return res.status(422).json({ success: false, error: "One or more tags not found" });
      }
    }

    const translationRows = buildTranslationRows(translations);

    const article = await prisma.$transaction(async (tx) => {
      return tx.blogArticle.create({
        data: {
          slug,
          image:      image    || null,
          author:     author   || null,
          date:       date     || null,
          readTime:   readTime || null,
          published:  Boolean(published),
          publishedAt: published ? new Date() : null,
          categoryId: categoryId || null,
          translations: { createMany: { data: translationRows } },
          tags: tagIds.length
            ? { createMany: { data: tagIds.map((tagId) => ({ tagId })) } }
            : undefined,
        },
        include: ARTICLE_INCLUDE,
      });
    });

    res.status(201).json({ success: true, data: serializeArticle(article) });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(422).json({ success: false, error: "Slug already in use" });
    }
    next(err);
  }
};

// ── PUT /api/superadmin/blog/articles/:id ────────────────────
export const updateArticle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      slug: rawSlug,
      image,
      author,
      date,
      readTime,
      categoryId,
      tagIds       = [],
      published,
      translations = {},
    } = req.body;

    const existing = await prisma.blogArticle.findUnique({
      where:   { id },
      include: { translations: true },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Article not found" });
    }

    const enTitle  = translations.en?.title;
    const finalSlug = rawSlug || (enTitle ? slugify(enTitle) : existing.slug);

    if (!finalSlug) {
      return res.status(422).json({ success: false, error: "Slug is required" });
    }

    // Validate category
    if (categoryId) {
      const cat = await prisma.blogCategory.findUnique({ where: { id: categoryId } });
      if (!cat) {
        return res.status(422).json({ success: false, error: "Category not found" });
      }
    }

    // Validate tags
    if (tagIds.length) {
      const found = await prisma.blogTag.count({ where: { id: { in: tagIds } } });
      if (found !== tagIds.length) {
        return res.status(422).json({ success: false, error: "One or more tags not found" });
      }
    }

    const translationRows = buildTranslationRows(translations);
    const nowPublished    = published !== undefined ? Boolean(published) : existing.published;

    const updated = await prisma.$transaction(async (tx) => {
      // ── Track slug changes for redirect map ──────────────────
      const prevSlugs = [];

      if (existing.slug !== finalSlug) {
        prevSlugs.push({ articleId: id, slug: existing.slug, lang: "" });
      }
      for (const [lang, newTr] of Object.entries(translations)) {
        const oldTr    = existing.translations.find((t) => t.lang === lang);
        const newSlug  = newTr.slug || slugify(newTr.title || "");
        if (oldTr?.slug && oldTr.slug !== newSlug) {
          prevSlugs.push({ articleId: id, slug: oldTr.slug, lang });
        }
      }

      for (const ps of prevSlugs) {
        await tx.blogArticlePreviousSlug.upsert({
          where:  { slug_lang: { slug: ps.slug, lang: ps.lang } },
          update: {},
          create: ps,
        });
      }

      // ── Update article ────────────────────────────────────────
      await tx.blogArticle.update({
        where: { id },
        data: {
          slug:       finalSlug,
          image:      image      !== undefined ? (image      || null) : undefined,
          author:     author     !== undefined ? (author     || null) : undefined,
          date:       date       !== undefined ? (date       || null) : undefined,
          readTime:   readTime   !== undefined ? (readTime   || null) : undefined,
          categoryId: categoryId !== undefined ? (categoryId || null) : undefined,
          published:  nowPublished,
          publishedAt: !existing.published && nowPublished ? new Date()
                     :  existing.published && !nowPublished ? null
                     :  undefined,
        },
      });

      // ── Rebuild translations ──────────────────────────────────
      await tx.blogArticleTranslation.deleteMany({ where: { articleId: id } });
      if (translationRows.length) {
        await tx.blogArticleTranslation.createMany({
          data: translationRows.map((t) => ({ ...t, articleId: id })),
        });
      }

      // ── Rebuild tag pivot ─────────────────────────────────────
      await tx.blogArticleTag.deleteMany({ where: { articleId: id } });
      if (tagIds.length) {
        await tx.blogArticleTag.createMany({
          data: tagIds.map((tagId) => ({ articleId: id, tagId })),
        });
      }

      return tx.blogArticle.findUnique({
        where:   { id },
        include: ARTICLE_INCLUDE,
      });
    });

    res.json({ success: true, data: serializeArticle(updated) });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(422).json({ success: false, error: "Slug already in use" });
    }
    next(err);
  }
};

// ── PATCH /api/superadmin/blog/articles/:id/publish ──────────
export const togglePublish = async (req, res, next) => {
  try {
    const { id } = req.params;

    const article = await prisma.blogArticle.findUnique({ where: { id } });
    if (!article) {
      return res.status(404).json({ success: false, error: "Article not found" });
    }

    const nowPublished = !article.published;

    const updated = await prisma.blogArticle.update({
      where: { id },
      data: {
        published:   nowPublished,
        publishedAt: nowPublished ? (article.publishedAt ?? new Date()) : null,
      },
      include: ARTICLE_INCLUDE,
    });

    res.json({ success: true, data: serializeArticle(updated) });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/superadmin/blog/articles/:id ─────────────────
export const deleteArticle = async (req, res, next) => {
  try {
    await prisma.blogArticle.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Article deleted" });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ success: false, error: "Article not found" });
    }
    next(err);
  }
};

// ── POST /api/superadmin/blog/articles/bulk ──────────────────
export const bulkArticles = async (req, res, next) => {
  try {
    const { action, ids = [] } = req.body;
    if (!ids.length) {
      return res.status(422).json({ success: false, error: "No article ids provided" });
    }

    if (action === "delete") {
      await prisma.blogArticle.deleteMany({ where: { id: { in: ids } } });
      return res.json({ success: true, message: `${ids.length} article(s) deleted` });
    }

    if (action === "publish" || action === "unpublish") {
      const published = action === "publish";
      await prisma.blogArticle.updateMany({
        where: { id: { in: ids } },
        data:  {
          published,
          publishedAt: published ? new Date() : null,
        },
      });
      return res.json({ success: true, message: `${ids.length} article(s) ${action}ed` });
    }

    res.status(422).json({ success: false, error: `Unknown action: ${action}` });
  } catch (err) {
    next(err);
  }
};
