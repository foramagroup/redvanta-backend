// ═══════════════════════════════════════════════════════════
// src/controllers/superadmin/blog.clusters.controller.js
// CRUD Clusters SEO — superadmin
// ═══════════════════════════════════════════════════════════

import prisma from "../../config/database.js";

const slugify = (s = "") =>
  s.toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function serializeCluster(c) {
  const totalArticles     = c._count?.articles ?? 0;
  const publishedArticles = c.articles?.filter((a) => a.published).length ?? 0;
  const coverageScore     = totalArticles > 0 ? Math.round((publishedArticles / totalArticles) * 100) : 0;
  return {
    id:                  c.id,
    name:                c.name,
    slug:                c.slug,
    hubId:               c.hubId,
    hubName:             c.hub?.translations?.[0]?.title ?? c.hub?.slug ?? null,
    description:         c.description,
    hasSeoPage:          c.hasSeoPage,
    mainKeyword:         c.mainKeyword,
    seoPriority:         c.seoPriority,
    internalLinkingAuto: c.internalLinkingAuto,
    published:           c.published,
    totalArticles,
    publishedArticles,
    draftArticles:       totalArticles - publishedArticles,
    coverageScore,
    keywordsCount:       c._count?.keywords ?? 0,
    createdAt:           c.createdAt,
    updatedAt:           c.updatedAt,
  };
}

// ── GET /api/superadmin/blog/clusters ────────────────────────
export const listClusters = async (req, res, next) => {
  try {
    const { hubId, search } = req.query;
    const where = {};
    if (hubId)  where.hubId = hubId;
    if (search) where.name = { contains: search };

    const clusters = await prisma.blogCluster.findMany({
      where,
      include: {
        hub: { include: { translations: { take: 1 } } },
        articles: { select: { id: true, published: true } },
        _count: { select: { articles: true, keywords: true } },
      },
      orderBy: [{ seoPriority: "desc" }, { createdAt: "asc" }],
    });

    res.json({ success: true, data: clusters.map(serializeCluster) });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/superadmin/blog/clusters/:id ────────────────────
export const getCluster = async (req, res, next) => {
  try {
    const cluster = await prisma.blogCluster.findUnique({
      where: { id: req.params.id },
      include: {
        hub: { include: { translations: { take: 1 } } },
        articles: { select: { id: true, published: true } },
        _count: { select: { articles: true, keywords: true } },
      },
    });
    if (!cluster) return res.status(404).json({ success: false, error: "Cluster not found" });
    res.json({ success: true, data: serializeCluster(cluster) });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/superadmin/blog/clusters ───────────────────────
export const createCluster = async (req, res, next) => {
  try {
    const {
      name, slug: rawSlug, hubId, description, hasSeoPage = true,
      mainKeyword, seoPriority = 3, internalLinkingAuto = true, published = false,
    } = req.body;

    if (!name) return res.status(422).json({ success: false, error: "Cluster name is required" });

    const slug = rawSlug || slugify(name);
    if (!slug) return res.status(422).json({ success: false, error: "Slug is required" });

    const cluster = await prisma.blogCluster.create({
      data: {
        name, slug,
        hubId:               hubId || null,
        description:         description || null,
        hasSeoPage:          Boolean(hasSeoPage),
        mainKeyword:         mainKeyword || null,
        seoPriority:         parseInt(seoPriority) || 3,
        internalLinkingAuto: Boolean(internalLinkingAuto),
        published:           Boolean(published),
      },
      include: {
        hub: { include: { translations: { take: 1 } } },
        articles: { select: { id: true, published: true } },
        _count: { select: { articles: true, keywords: true } },
      },
    });

    res.status(201).json({ success: true, data: serializeCluster(cluster) });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(422).json({ success: false, error: "Slug already in use" });
    }
    next(err);
  }
};

// ── PUT /api/superadmin/blog/clusters/:id ────────────────────
export const updateCluster = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name, slug: rawSlug, hubId, description, hasSeoPage,
      mainKeyword, seoPriority, internalLinkingAuto, published,
    } = req.body;

    const existing = await prisma.blogCluster.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: "Cluster not found" });

    const cluster = await prisma.blogCluster.update({
      where: { id },
      data: {
        name:                name         ?? existing.name,
        slug:                rawSlug      ?? (name ? slugify(name) : existing.slug),
        hubId:               hubId !== undefined ? (hubId || null) : existing.hubId,
        description:         description  !== undefined ? (description || null) : existing.description,
        hasSeoPage:          hasSeoPage   !== undefined ? Boolean(hasSeoPage)   : existing.hasSeoPage,
        mainKeyword:         mainKeyword  !== undefined ? (mainKeyword || null) : existing.mainKeyword,
        seoPriority:         seoPriority  !== undefined ? parseInt(seoPriority) : existing.seoPriority,
        internalLinkingAuto: internalLinkingAuto !== undefined ? Boolean(internalLinkingAuto) : existing.internalLinkingAuto,
        published:           published    !== undefined ? Boolean(published)    : existing.published,
      },
      include: {
        hub: { include: { translations: { take: 1 } } },
        articles: { select: { id: true, published: true } },
        _count: { select: { articles: true, keywords: true } },
      },
    });

    res.json({ success: true, data: serializeCluster(cluster) });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(422).json({ success: false, error: "Slug already in use" });
    }
    next(err);
  }
};

// ── DELETE /api/superadmin/blog/clusters/:id ─────────────────
export const deleteCluster = async (req, res, next) => {
  try {
    const { id } = req.params;
    const articleCount = await prisma.blogArticle.count({ where: { clusterId: id } });
    if (articleCount > 0) {
      return res.status(409).json({
        success: false,
        error: `Cannot delete — ${articleCount} article(s) still use this cluster`,
      });
    }
    await prisma.blogCluster.delete({ where: { id } });
    res.json({ success: true, message: "Cluster deleted" });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ success: false, error: "Cluster not found" });
    }
    next(err);
  }
};
