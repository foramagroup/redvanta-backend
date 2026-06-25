// ═══════════════════════════════════════════════════════════
// src/controllers/superadmin/blog.hubs.controller.js
// CRUD Hub Pages (pillar pages) — superadmin
// ═══════════════════════════════════════════════════════════

import prisma from "../../config/database.js";

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
    description:     t.description     || null,
    content:         t.content         || null,
    metaTitle:       t.metaTitle       || null,
    metaDescription: t.metaDescription || null,
  }));
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
    coverImage:  h.coverImage  ?? "",
    published:   h.published,
    translations,
    articleCount: h._count?.articles ?? 0,
    createdAt:   h.createdAt,
    updatedAt:   h.updatedAt,
  };
}

const HUB_INCLUDE = {
  translations: true,
  _count: { select: { articles: true } },
};

// ── GET /api/superadmin/blog/hubs ────────────────────────────
export const listHubs = async (req, res, next) => {
  try {
    const hubs = await prisma.blogHub.findMany({
      include: HUB_INCLUDE,
      orderBy: { createdAt: "asc" },
    });
    res.json({ success: true, data: hubs.map(serializeHub) });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/superadmin/blog/hubs/:id ────────────────────────
export const getHub = async (req, res, next) => {
  try {
    const hub = await prisma.blogHub.findUnique({
      where:   { id: req.params.id },
      include: HUB_INCLUDE,
    });
    if (!hub) return res.status(404).json({ success: false, error: "Hub not found" });
    res.json({ success: true, data: serializeHub(hub) });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/superadmin/blog/hubs ───────────────────────────
export const createHub = async (req, res, next) => {
  try {
    const {
      slug: rawSlug,
      hubType      = "custom",
      coverImage   = null,
      published    = false,
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

    const rows = buildTranslationRows(translations);

    const hub = await prisma.blogHub.create({
      data: {
        slug,
        hubType,
        coverImage: coverImage || null,
        published:  Boolean(published),
        translations: { createMany: { data: rows } },
      },
      include: HUB_INCLUDE,
    });

    res.status(201).json({ success: true, data: serializeHub(hub) });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(422).json({ success: false, error: "Slug already in use" });
    }
    next(err);
  }
};

// ── PUT /api/superadmin/blog/hubs/:id ────────────────────────
export const updateHub = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      slug: rawSlug,
      hubType,
      coverImage,
      published,
      translations = {},
    } = req.body;

    const existing = await prisma.blogHub.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: "Hub not found" });

    const enTitle  = translations.en?.title;
    const finalSlug = rawSlug || (enTitle ? slugify(enTitle) : existing.slug);

    const rows = buildTranslationRows(translations);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.blogHub.update({
        where: { id },
        data: {
          slug:       finalSlug,
          hubType:    hubType    !== undefined ? hubType    : existing.hubType,
          coverImage: coverImage !== undefined ? (coverImage || null) : existing.coverImage,
          published:  published  !== undefined ? Boolean(published)   : existing.published,
        },
      });

      await tx.blogHubTranslation.deleteMany({ where: { hubId: id } });
      if (rows.length) {
        await tx.blogHubTranslation.createMany({
          data: rows.map((r) => ({ ...r, hubId: id })),
        });
      }

      return tx.blogHub.findUnique({ where: { id }, include: HUB_INCLUDE });
    });

    res.json({ success: true, data: serializeHub(updated) });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(422).json({ success: false, error: "Slug already in use" });
    }
    next(err);
  }
};

// ── PATCH /api/superadmin/blog/hubs/:id/publish ──────────────
export const toggleHubPublish = async (req, res, next) => {
  try {
    const hub = await prisma.blogHub.findUnique({ where: { id: req.params.id } });
    if (!hub) return res.status(404).json({ success: false, error: "Hub not found" });

    const updated = await prisma.blogHub.update({
      where: { id: req.params.id },
      data:  { published: !hub.published },
      include: HUB_INCLUDE,
    });
    res.json({ success: true, data: serializeHub(updated) });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/superadmin/blog/hubs/:id ─────────────────────
export const deleteHub = async (req, res, next) => {
  try {
    // Détacher les articles liés avant suppression
    await prisma.blogArticle.updateMany({
      where: { hubId: req.params.id },
      data:  { hubId: null },
    });
    await prisma.blogHub.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Hub deleted" });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ success: false, error: "Hub not found" });
    }
    next(err);
  }
};
