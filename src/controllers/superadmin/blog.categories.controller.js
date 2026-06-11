// ═══════════════════════════════════════════════════════════
// src/controllers/superadmin/blog.categories.controller.js
// CRUD Catégories de blog — superadmin
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
    slug:        t.slug        || slugify(t.name || ""),
    name:        t.name        || "",
    description: t.description || null,
    metaTitle:   t.metaTitle   || null,
    metaDesc:    t.metaDescription || null,
  }));
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
    _count:       c._count,
    createdAt:    c.createdAt,
    updatedAt:    c.updatedAt,
  };
}

// ── GET /api/superadmin/blog/categories ──────────────────────
export const listCategories = async (req, res, next) => {
  try {
    const categories = await prisma.blogCategory.findMany({
      include: {
        translations: true,
        _count: { select: { articles: true } },
      },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });

    res.json({ success: true, data: categories.map(serializeCategory) });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/superadmin/blog/categories/:id ──────────────────
export const getCategory = async (req, res, next) => {
  try {
    const category = await prisma.blogCategory.findUnique({
      where:   { id: req.params.id },
      include: {
        translations: true,
        _count: { select: { articles: true } },
      },
    });

    if (!category) {
      return res.status(404).json({ success: false, error: "Category not found" });
    }

    res.json({ success: true, data: serializeCategory(category) });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/superadmin/blog/categories ─────────────────────
export const createCategory = async (req, res, next) => {
  try {
    const { slug: rawSlug, displayOrder = 0, translations = {} } = req.body;

    const enName = translations.en?.name;
    if (!enName) {
      return res.status(422).json({ success: false, error: "English name is required" });
    }

    const slug = rawSlug || slugify(enName);
    if (!slug) {
      return res.status(422).json({ success: false, error: "Slug is required" });
    }

    const translationRows = buildTranslationRows(translations);

    const category = await prisma.blogCategory.create({
      data: {
        slug,
        displayOrder: parseInt(displayOrder) || 0,
        translations: { createMany: { data: translationRows } },
      },
      include: {
        translations: true,
        _count: { select: { articles: true } },
      },
    });

    res.status(201).json({ success: true, data: serializeCategory(category) });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(422).json({ success: false, error: "Slug already in use" });
    }
    next(err);
  }
};

// ── PUT /api/superadmin/blog/categories/:id ──────────────────
export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { slug: rawSlug, displayOrder, translations = {} } = req.body;

    const existing = await prisma.blogCategory.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Category not found" });
    }

    const enName   = translations.en?.name;
    const finalSlug = rawSlug || (enName ? slugify(enName) : existing.slug);

    const translationRows = buildTranslationRows(translations);

    const category = await prisma.$transaction(async (tx) => {
      await tx.blogCategory.update({
        where: { id },
        data: {
          slug:         finalSlug,
          displayOrder: displayOrder !== undefined ? parseInt(displayOrder) : undefined,
        },
      });

      await tx.blogCategoryTranslation.deleteMany({ where: { categoryId: id } });
      if (translationRows.length) {
        await tx.blogCategoryTranslation.createMany({
          data: translationRows.map((t) => ({ ...t, categoryId: id })),
        });
      }

      return tx.blogCategory.findUnique({
        where:   { id },
        include: {
          translations: true,
          _count: { select: { articles: true } },
        },
      });
    });

    res.json({ success: true, data: serializeCategory(category) });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(422).json({ success: false, error: "Slug already in use" });
    }
    next(err);
  }
};

// ── DELETE /api/superadmin/blog/categories/:id ───────────────
export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const articlesCount = await prisma.blogArticle.count({ where: { categoryId: id } });
    if (articlesCount > 0) {
      return res.status(409).json({
        success: false,
        error:   `Cannot delete — ${articlesCount} article(s) still use this category`,
      });
    }

    await prisma.blogCategory.delete({ where: { id } });
    res.json({ success: true, message: "Category deleted" });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ success: false, error: "Category not found" });
    }
    next(err);
  }
};

// ── PATCH /api/superadmin/blog/categories/reorder ────────────
// Body: [{ id, displayOrder }, ...]
export const reorderCategories = async (req, res, next) => {
  try {
    const items = req.body;
    if (!Array.isArray(items) || !items.length) {
      return res.status(422).json({ success: false, error: "Array of {id, displayOrder} required" });
    }

    await prisma.$transaction(
      items.map(({ id, displayOrder }) =>
        prisma.blogCategory.update({
          where: { id },
          data:  { displayOrder: parseInt(displayOrder) || 0 },
        })
      )
    );

    res.json({ success: true, message: "Order updated" });
  } catch (err) {
    next(err);
  }
};
