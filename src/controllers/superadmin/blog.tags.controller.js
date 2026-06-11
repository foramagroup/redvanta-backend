// ═══════════════════════════════════════════════════════════
// src/controllers/superadmin/blog.tags.controller.js
// CRUD Tags de blog — superadmin
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
    slug: t.slug || slugify(t.name || ""),
    name: t.name || "",
  }));
}

function serializeTag(t) {
  const translations = {};
  for (const tr of (t.translations ?? [])) {
    translations[tr.lang] = { slug: tr.slug, name: tr.name };
  }
  return {
    id:           t.id,
    slug:         t.slug,
    translations,
    _count:       t._count,
    createdAt:    t.createdAt,
    updatedAt:    t.updatedAt,
  };
}

// ── GET /api/superadmin/blog/tags ────────────────────────────
export const listTags = async (req, res, next) => {
  try {
    const { search } = req.query;

    const where = search
      ? { translations: { some: { name: { contains: search } } } }
      : {};

    const tags = await prisma.blogTag.findMany({
      where,
      include: {
        translations: true,
        _count: { select: { articles: true } },
      },
      orderBy: { slug: "asc" },
    });

    res.json({ success: true, data: tags.map(serializeTag) });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/superadmin/blog/tags/:id ────────────────────────
export const getTag = async (req, res, next) => {
  try {
    const tag = await prisma.blogTag.findUnique({
      where:   { id: req.params.id },
      include: {
        translations: true,
        _count: { select: { articles: true } },
      },
    });

    if (!tag) {
      return res.status(404).json({ success: false, error: "Tag not found" });
    }

    res.json({ success: true, data: serializeTag(tag) });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/superadmin/blog/tags ───────────────────────────
export const createTag = async (req, res, next) => {
  try {
    const { slug: rawSlug, translations = {} } = req.body;

    const enName = translations.en?.name;
    if (!enName) {
      return res.status(422).json({ success: false, error: "English name is required" });
    }

    const slug = rawSlug || slugify(enName);
    if (!slug) {
      return res.status(422).json({ success: false, error: "Slug is required" });
    }

    const translationRows = buildTranslationRows(translations);

    const tag = await prisma.blogTag.create({
      data: {
        slug,
        translations: { createMany: { data: translationRows } },
      },
      include: {
        translations: true,
        _count: { select: { articles: true } },
      },
    });

    res.status(201).json({ success: true, data: serializeTag(tag) });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(422).json({ success: false, error: "Slug already in use" });
    }
    next(err);
  }
};

// ── PUT /api/superadmin/blog/tags/:id ────────────────────────
export const updateTag = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { slug: rawSlug, translations = {} } = req.body;

    const existing = await prisma.blogTag.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Tag not found" });
    }

    const enName    = translations.en?.name;
    const finalSlug = rawSlug || (enName ? slugify(enName) : existing.slug);

    const translationRows = buildTranslationRows(translations);

    const tag = await prisma.$transaction(async (tx) => {
      await tx.blogTag.update({
        where: { id },
        data:  { slug: finalSlug },
      });

      await tx.blogTagTranslation.deleteMany({ where: { tagId: id } });
      if (translationRows.length) {
        await tx.blogTagTranslation.createMany({
          data: translationRows.map((t) => ({ ...t, tagId: id })),
        });
      }

      return tx.blogTag.findUnique({
        where:   { id },
        include: {
          translations: true,
          _count: { select: { articles: true } },
        },
      });
    });

    res.json({ success: true, data: serializeTag(tag) });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(422).json({ success: false, error: "Slug already in use" });
    }
    next(err);
  }
};

// ── DELETE /api/superadmin/blog/tags/:id ─────────────────────
export const deleteTag = async (req, res, next) => {
  try {
    await prisma.blogTag.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Tag deleted" });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ success: false, error: "Tag not found" });
    }
    next(err);
  }
};
