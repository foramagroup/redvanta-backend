// ═══════════════════════════════════════════════════════════
// src/controllers/superadmin/aiProviderCosts.controller.js
// Tarifs par fournisseur IA (superadmin)
// ═══════════════════════════════════════════════════════════

import prisma from "../../config/database.js";

// Coûts par défaut insérés à la première consultation
const DEFAULT_COSTS = [
  { providerName: "openai",    model: "gpt-4o-mini",          inputPer1M: 0.15,  outputPer1M: 0.60  },
  { providerName: "anthropic", model: "claude-sonnet-4-5",    inputPer1M: 3.00,  outputPer1M: 15.00 },
  { providerName: "google",    model: "gemini-2.5-flash",     inputPer1M: 0.15,  outputPer1M: 0.60  },
];

async function ensureCostsExist() {
  // On s'assure que les providers existent d'abord (normalement déjà fait par aiProviders)
  const providers = await prisma.aiProvider.findMany();
  const providerMap = Object.fromEntries(providers.map((p) => [p.name, p.id]));

  for (const def of DEFAULT_COSTS) {
    const providerId = providerMap[def.providerName];
    if (!providerId) continue;

    const existing = await prisma.aiProviderCost.findFirst({
      where: { providerId, active: true },
    });
    if (!existing) {
      await prisma.aiProviderCost.create({
        data: { providerId, model: def.model, inputPer1M: def.inputPer1M, outputPer1M: def.outputPer1M, active: true },
      });
    }
  }
}

function formatCost(cost, provider) {
  return {
    id: cost.id,
    providerId: cost.providerId,
    providerName: provider?.name ?? null,
    providerDisplayName: provider?.displayName ?? null,
    model: cost.model,
    inputPer1M: cost.inputPer1M,
    outputPer1M: cost.outputPer1M,
    active: cost.active,
    effectiveAt: cost.effectiveAt,
    createdAt: cost.createdAt,
  };
}

// ── GET /api/superadmin/ai/provider-costs ────────────────────
export async function listCosts(req, res) {
  try {
    await ensureCostsExist();

    const costs = await prisma.aiProviderCost.findMany({
      include: { provider: true },
      orderBy: [{ providerId: "asc" }, { effectiveAt: "desc" }],
    });

    res.json({ costs: costs.map((c) => formatCost(c, c.provider)) });
  } catch (err) {
    console.error("[aiProviderCosts] listCosts:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

// ── PUT /api/superadmin/ai/provider-costs ────────────────────
// Sauvegarde en masse tous les tarifs
// Body: { costs: [{ id?, providerId, model, inputPer1M, outputPer1M, active }] }
export async function saveCosts(req, res) {
  try {
    const { costs } = req.body;
    if (!Array.isArray(costs) || costs.length === 0) {
      return res.status(400).json({ error: "costs[] requis" });
    }

    const results = await prisma.$transaction(
      costs.map((row) => {
        const data = {
          providerId: parseInt(row.providerId, 10),
          model: String(row.model ?? "").trim(),
          inputPer1M: parseFloat(row.inputPer1M) || 0,
          outputPer1M: parseFloat(row.outputPer1M) || 0,
          active: Boolean(row.active),
        };

        if (row.id) {
          return prisma.aiProviderCost.update({
            where: { id: parseInt(row.id, 10) },
            data,
            include: { provider: true },
          });
        }
        return prisma.aiProviderCost.create({ data, include: { provider: true } });
      })
    );

    res.json({ costs: results.map((c) => formatCost(c, c.provider)) });
  } catch (err) {
    console.error("[aiProviderCosts] saveCosts:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

// ── POST /api/superadmin/ai/provider-costs ───────────────────
// Ajoute un nouveau tarif pour un fournisseur
// Body: { providerId, model, inputPer1M, outputPer1M }
export async function createCost(req, res) {
  try {
    const { providerId, model, inputPer1M, outputPer1M } = req.body;
    if (!providerId || !model) {
      return res.status(400).json({ error: "providerId et model requis" });
    }

    const provider = await prisma.aiProvider.findUnique({
      where: { id: parseInt(providerId, 10) },
    });
    if (!provider) return res.status(404).json({ error: "Fournisseur introuvable" });

    const cost = await prisma.aiProviderCost.create({
      data: {
        providerId: parseInt(providerId, 10),
        model: String(model).trim(),
        inputPer1M: parseFloat(inputPer1M) || 0,
        outputPer1M: parseFloat(outputPer1M) || 0,
        active: true,
      },
      include: { provider: true },
    });

    res.status(201).json(formatCost(cost, cost.provider));
  } catch (err) {
    console.error("[aiProviderCosts] createCost:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

// ── PATCH /api/superadmin/ai/provider-costs/:id ──────────────
// Met à jour un tarif individuel
export async function updateCost(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { model, inputPer1M, outputPer1M, active } = req.body;

    const existing = await prisma.aiProviderCost.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Tarif introuvable" });

    const data = {};
    if (model !== undefined)       data.model       = String(model).trim();
    if (inputPer1M !== undefined)  data.inputPer1M  = parseFloat(inputPer1M)  || 0;
    if (outputPer1M !== undefined) data.outputPer1M = parseFloat(outputPer1M) || 0;
    if (active !== undefined)      data.active      = Boolean(active);

    const updated = await prisma.aiProviderCost.update({
      where: { id },
      data,
      include: { provider: true },
    });

    res.json(formatCost(updated, updated.provider));
  } catch (err) {
    console.error("[aiProviderCosts] updateCost:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

// ── DELETE /api/superadmin/ai/provider-costs/:id ─────────────
export async function deleteCost(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.aiProviderCost.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Tarif introuvable" });

    await prisma.aiProviderCost.delete({ where: { id } });
    res.json({ message: "Tarif supprimé" });
  } catch (err) {
    console.error("[aiProviderCosts] deleteCost:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}
