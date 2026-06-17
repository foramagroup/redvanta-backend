// ═══════════════════════════════════════════════════════════
// src/controllers/admin/aiSettings.controller.js
// Paramètres IA, usage mensuel et crédits — côté admin company
// ═══════════════════════════════════════════════════════════

import prisma from "../config/database.js";

// ── Limites IA par plan (à migrer dans PlanSetting quand le schéma sera étendu) ─
const AI_PLAN_LIMITS = {
  trial:   { monthlyIncluded: 20,   overageRate: 0.10 },
  starter: { monthlyIncluded: 100,  overageRate: 0.08 },
  power:   { monthlyIncluded: 500,  overageRate: 0.05 },
  // fallback pour les plans sans correspondance
  default: { monthlyIncluded: 20,   overageRate: 0.10 },
};


// ── Helpers ──────────────────────────────────────────────────

function companyId(req) {
  return Number(req.user.companyId);
}

async function getOrCreateSettings(cid) {
  return prisma.aiSetting.upsert({
    where:  { companyId: cid },
    create: { companyId: cid },
    update: {},
  });
}

async function getOrCreateCreditBalance(cid) {
  return prisma.aiCreditBalance.upsert({
    where:  { companyId: cid },
    create: { companyId: cid },
    update: {},
  });
}

async function getCompanyPlanSlug(cid) {
  const company = await prisma.company.findUnique({
    where:  { id: cid },
    select: { planId: true, package: { select: { slug: true } } },
  });
  return company?.package?.slug ?? "starter";
}

function planLimits(slug) {
  return AI_PLAN_LIMITS[slug] ?? AI_PLAN_LIMITS.default;
}

// ── GET /api/admin/ai/settings ───────────────────────────────
export async function getSettings(req, res) {
  try {
    const cid      = companyId(req);
    const settings = await getOrCreateSettings(cid);

    res.json({
      success: true,
      data: {
        language:         settings.language,
        tone:             settings.tone,
        businessContext:  settings.businessContext ?? "",
        signature:        settings.signature       ?? "",
        autoReplyEnabled: settings.autoReplyEnabled,
      },
    });
  } catch (err) {
    console.error("[aiSettings] getSettings:", err);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
}

// ── PUT /api/admin/ai/settings ───────────────────────────────
// Body: { language?, tone?, businessContext?, signature?, autoReplyEnabled? }
export async function saveSettings(req, res) {
  try {
    const cid = companyId(req);
    const { language, tone, businessContext, signature, autoReplyEnabled } = req.body;

    const data = {};
    if (language         !== undefined) data.language         = String(language).trim();
    if (tone             !== undefined) data.tone             = String(tone).trim();
    if (businessContext  !== undefined) data.businessContext  = String(businessContext).trim();
    if (signature        !== undefined) data.signature        = String(signature).trim();
    if (autoReplyEnabled !== undefined) data.autoReplyEnabled = Boolean(autoReplyEnabled);

    const updated = await prisma.aiSetting.upsert({
      where:  { companyId: cid },
      create: { companyId: cid, ...data },
      update: data,
    });

    res.json({
      success: true,
      data: {
        language:         updated.language,
        tone:             updated.tone,
        businessContext:  updated.businessContext ?? "",
        signature:        updated.signature       ?? "",
        autoReplyEnabled: updated.autoReplyEnabled,
      },
    });
  } catch (err) {
    console.error("[aiSettings] saveSettings:", err);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
}

// ── GET /api/admin/ai/usage ──────────────────────────────────
// Retourne l'usage du mois courant + info plan
export async function getUsage(req, res) {
  try {
    const cid  = companyId(req);
    const now  = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12

    const [usageRow, planSlug] = await Promise.all([
      prisma.aiUsageMonth.findUnique({
        where: { companyId_year_month: { companyId: cid, year, month } },
      }),
      getCompanyPlanSlug(cid),
    ]);

    const limits    = planLimits(planSlug);
    const generated = usageRow?.generatedCount ?? 0;
    const included  = limits.monthlyIncluded;
    const remaining = Math.max(included - generated, 0);
    const extra     = Math.max(generated - included, 0);
    const totalCost = usageRow?.totalCostUsd ?? generated * 0.005;

    res.json({
      success: true,
      data: {
        plan:         planSlug,
        year,
        month,
        generatedCount: generated,
        totalTokens:    usageRow?.totalTokens ?? 0,
        totalCostUsd:   totalCost,
        // enrichissements pour l'affichage
        included,
        remaining,
        extra,
        overageRate:    limits.overageRate,
        pct:            included > 0 ? Math.min((generated / included) * 100, 150) : 0,
      },
    });
  } catch (err) {
    console.error("[aiSettings] getUsage:", err);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
}

// ── GET /api/admin/ai/credits ────────────────────────────────
export async function getCredits(req, res) {
  try {
    const cid     = companyId(req);
    const balance = await getOrCreateCreditBalance(cid);
    const total     = balance.planIncluded + balance.purchased;
    const remaining = Math.max(total - balance.used, 0);

    res.json({
      success: true,
      data: {
        planIncluded: balance.planIncluded,
        purchased:    balance.purchased,
        used:         balance.used,
        remaining,
        total,
        resetAt:      balance.resetAt,
        pct:          total > 0 ? Math.min((balance.used / total) * 100, 100) : 0,
      },
    });
  } catch (err) {
    console.error("[aiSettings] getCredits:", err);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
}

