// ═══════════════════════════════════════════════════════════
// src/controllers/superadmin/blog.keywords.controller.js
// CRUD KeywordBank — superadmin
// ═══════════════════════════════════════════════════════════

import prisma from "../../config/database.js";

function serializeKeyword(k) {
  return {
    id:           k.id,
    keyword:      k.keyword,
    hubId:        k.hubId,
    hubName:      k.hub?.translations?.[0]?.title ?? k.hub?.slug ?? null,
    clusterId:    k.clusterId,
    clusterName:  k.cluster?.name ?? null,
    intent:       k.intent,
    difficulty:   k.difficulty,
    searchVolume: k.searchVolume,
    priority:     k.priority,
    articlesCount: k._count?.articles ?? 0,
    createdAt:    k.createdAt,
  };
}

const INCLUDE = {
  hub:     { include: { translations: { take: 1 } } },
  cluster: { select: { id: true, name: true } },
  _count:  { select: { articles: true } },
};

// ── GET /api/superadmin/blog/keywords ────────────────────────
export const listKeywords = async (req, res, next) => {
  try {
    const { search, hubId, clusterId, intent, page = 1, limit = 100 } = req.query;
    const where = {};
    if (search)    where.keyword   = { contains: search };
    if (hubId)     where.hubId     = hubId;
    if (clusterId) where.clusterId = clusterId;
    if (intent)    where.intent    = intent;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [total, keywords] = await Promise.all([
      prisma.keywordBank.count({ where }),
      prisma.keywordBank.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        skip,
        take: parseInt(limit),
      }),
    ]);

    res.json({ success: true, data: keywords.map(serializeKeyword), total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/superadmin/blog/keywords/search?q=... ───────────
// Used by article form autocomplete
export const searchKeywords = async (req, res, next) => {
  try {
    const { q = "" } = req.query;
    const keywords = await prisma.keywordBank.findMany({
      where:   { keyword: { contains: q } },
      include: INCLUDE,
      orderBy: [{ priority: "desc" }, { keyword: "asc" }],
      take:    20,
    });
    res.json({ success: true, data: keywords.map(serializeKeyword) });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/superadmin/blog/keywords/:id ────────────────────
export const getKeyword = async (req, res, next) => {
  try {
    const kw = await prisma.keywordBank.findUnique({ where: { id: req.params.id }, include: INCLUDE });
    if (!kw) return res.status(404).json({ success: false, error: "Keyword not found" });
    res.json({ success: true, data: serializeKeyword(kw) });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/superadmin/blog/keywords ───────────────────────
export const createKeyword = async (req, res, next) => {
  try {
    const { keyword, hubId, clusterId, intent = "informational", difficulty, searchVolume, priority } = req.body;
    if (!keyword?.trim()) return res.status(422).json({ success: false, error: "Keyword is required" });

    const kw = await prisma.keywordBank.create({
      data: {
        keyword:      keyword.trim().toLowerCase(),
        hubId:        hubId     || null,
        clusterId:    clusterId || null,
        intent,
        difficulty:   difficulty    ? parseInt(difficulty)    : null,
        searchVolume: searchVolume  ? parseInt(searchVolume)  : null,
        priority:     priority      ? parseInt(priority)      : null,
      },
      include: INCLUDE,
    });

    res.status(201).json({ success: true, data: serializeKeyword(kw) });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(422).json({ success: false, error: "This keyword already exists in the bank" });
    }
    next(err);
  }
};

// ── PUT /api/superadmin/blog/keywords/:id ────────────────────
export const updateKeyword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { keyword, hubId, clusterId, intent, difficulty, searchVolume, priority } = req.body;

    const existing = await prisma.keywordBank.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: "Keyword not found" });

    const kw = await prisma.keywordBank.update({
      where: { id },
      data: {
        keyword:      keyword?.trim().toLowerCase() ?? existing.keyword,
        hubId:        hubId     !== undefined ? (hubId     || null) : existing.hubId,
        clusterId:    clusterId !== undefined ? (clusterId || null) : existing.clusterId,
        intent:       intent    ?? existing.intent,
        difficulty:   difficulty    !== undefined ? (difficulty    ? parseInt(difficulty)    : null) : existing.difficulty,
        searchVolume: searchVolume  !== undefined ? (searchVolume  ? parseInt(searchVolume)  : null) : existing.searchVolume,
        priority:     priority      !== undefined ? (priority      ? parseInt(priority)      : null) : existing.priority,
      },
      include: INCLUDE,
    });

    res.json({ success: true, data: serializeKeyword(kw) });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(422).json({ success: false, error: "This keyword already exists in the bank" });
    }
    next(err);
  }
};

// ── DELETE /api/superadmin/blog/keywords/:id ─────────────────
export const deleteKeyword = async (req, res, next) => {
  try {
    await prisma.keywordBank.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Keyword deleted" });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ success: false, error: "Keyword not found" });
    }
    next(err);
  }
};
