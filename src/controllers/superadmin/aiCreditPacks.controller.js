// ═══════════════════════════════════════════════════════════
// src/controllers/superadmin/aiCreditPacks.controller.js
// CRUD des packs de crédits IA + traductions par langue
// ═══════════════════════════════════════════════════════════

import prisma from "../../config/database.js";

const include = {
  translations: {
    include: { language: { select: { id: true, code: true, name: true, flag: true } } },
    orderBy: { language: { name: "asc" } },
  },
  _count: { select: { purchases: true } },
};

// ── GET /api/superadmin/ai/credit-packs ──────────────────────
export async function listPacks(req, res) {
  try {
    const packs = await prisma.aiCreditPack.findMany({
      orderBy: { sortOrder: "asc" },
      include,
    });
    res.json({ success: true, data: packs.map(format) });
  } catch (err) {
    console.error("[listPacks]", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── POST /api/superadmin/ai/credit-packs ─────────────────────
// Body: { slug, credits, priceUsd, isActive?, sortOrder?, translations: [{ languageId, name, description? }] }
export async function createPack(req, res) {
  try {
    const { slug, credits, priceUsd, isActive = true, sortOrder = 0, translations = [] } = req.body;

    if (!slug?.trim())            return res.status(422).json({ success: false, error: "slug requis" });
    if (!credits || credits <= 0) return res.status(422).json({ success: false, error: "credits requis (> 0)" });
    if (!priceUsd || priceUsd < 0) return res.status(422).json({ success: false, error: "priceUsd requis (≥ 0)" });

    const existing = await prisma.aiCreditPack.findUnique({ where: { slug: slug.trim() } });
    if (existing) return res.status(409).json({ success: false, error: `Slug "${slug}" déjà utilisé.` });

    const pack = await prisma.aiCreditPack.create({
      data: {
        slug:      slug.trim(),
        credits:   parseInt(credits),
        priceUsd:  parseFloat(priceUsd),
        isActive:  Boolean(isActive),
        sortOrder: parseInt(sortOrder) || 0,
        translations: {
          create: translations
            .filter((t) => t.languageId && t.name?.trim())
            .map((t) => ({
              languageId:  parseInt(t.languageId),
              name:        t.name.trim(),
              description: t.description?.trim() || null,
            })),
        },
      },
      include,
    });

    res.status(201).json({ success: true, data: format(pack) });
  } catch (err) {
    console.error("[createPack]", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── PUT /api/superadmin/ai/credit-packs/:id ──────────────────
// Body: { slug?, credits?, priceUsd?, isActive?, sortOrder? }
export async function updatePack(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { slug, credits, priceUsd, isActive, sortOrder } = req.body;

    const existing = await prisma.aiCreditPack.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: "Pack introuvable" });

    if (slug && slug !== existing.slug) {
      const conflict = await prisma.aiCreditPack.findUnique({ where: { slug: slug.trim() } });
      if (conflict) return res.status(409).json({ success: false, error: `Slug "${slug}" déjà utilisé.` });
    }

    const data = {};
    if (slug      !== undefined) data.slug      = slug.trim();
    if (credits   !== undefined) data.credits   = parseInt(credits);
    if (priceUsd  !== undefined) data.priceUsd  = parseFloat(priceUsd);
    if (isActive  !== undefined) data.isActive  = Boolean(isActive);
    if (sortOrder !== undefined) data.sortOrder = parseInt(sortOrder) || 0;

    const pack = await prisma.aiCreditPack.update({ where: { id }, data, include });
    res.json({ success: true, data: format(pack) });
  } catch (err) {
    console.error("[updatePack]", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── DELETE /api/superadmin/ai/credit-packs/:id ───────────────
export async function deletePack(req, res) {
  try {
    const id = parseInt(req.params.id);

    const pack = await prisma.aiCreditPack.findUnique({
      where:   { id },
      include: { _count: { select: { purchases: true } } },
    });
    if (!pack) return res.status(404).json({ success: false, error: "Pack introuvable" });
    if (pack._count.purchases > 0) {
      return res.status(422).json({
        success: false,
        error:   `Ce pack est lié à ${pack._count.purchases} achat(s). Désactivez-le plutôt que de le supprimer.`,
      });
    }

    await prisma.aiCreditPack.delete({ where: { id } });
    res.json({ success: true, message: "Pack supprimé." });
  } catch (err) {
    console.error("[deletePack]", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── PUT /api/superadmin/ai/credit-packs/:id/translations ─────
// Body: { translations: [{ languageId, name, description? }] }
// Upsert atomique de toutes les traductions en une fois
export async function upsertTranslations(req, res) {
  try {
    const id           = parseInt(req.params.id);
    const { translations = [] } = req.body;

    const pack = await prisma.aiCreditPack.findUnique({ where: { id } });
    if (!pack) return res.status(404).json({ success: false, error: "Pack introuvable" });

    await prisma.$transaction(
      translations
        .filter((t) => t.languageId && t.name?.trim())
        .map((t) =>
          prisma.aiCreditPackTranslation.upsert({
            where:  { packId_languageId: { packId: id, languageId: parseInt(t.languageId) } },
            create: { packId: id, languageId: parseInt(t.languageId), name: t.name.trim(), description: t.description?.trim() || null },
            update: { name: t.name.trim(), description: t.description?.trim() || null },
          })
        )
    );

    const updated = await prisma.aiCreditPack.findUnique({ where: { id }, include });
    res.json({ success: true, data: format(updated) });
  } catch (err) {
    console.error("[upsertTranslations]", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── Formatter ─────────────────────────────────────────────────
function format(p) {
  const price = Number(p.priceUsd);
  return {
    id:           p.id,
    slug:         p.slug,
    credits:      p.credits,
    priceUsd:     price,
    costPerCredit: p.credits > 0 ? Number((price / p.credits).toFixed(4)) : 0,
    isActive:     p.isActive,
    sortOrder:    p.sortOrder,
    createdAt:    p.createdAt,
    updatedAt:    p.updatedAt,
    purchaseCount: p._count?.purchases ?? 0,
    translations: p.translations.map((t) => ({
      id:          t.id,
      languageId:  t.languageId,
      languageCode: t.language.code,
      languageName: t.language.name,
      languageFlag: t.language.flag,
      name:        t.name,
      description: t.description,
    })),
  };
}
