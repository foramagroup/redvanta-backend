// src/controllers/widget.controller.js
// ─────────────────────────────────────────────────────────────
// Gestion des widgets de collecte d'avis (dashboard admin)
//
// GET    /api/admin/widgets                        listWidgets
// POST   /api/admin/widgets                        createWidget
// GET    /api/admin/widgets/analytics/overview     getOverviewAnalytics
// GET    /api/admin/widgets/:id                    getWidget
// PUT    /api/admin/widgets/:id                    updateWidget
// DELETE /api/admin/widgets/:id                    deleteWidget
// PATCH  /api/admin/widgets/:id/status             toggleStatus
// POST   /api/admin/widgets/:id/duplicate          duplicateWidget
// POST   /api/admin/widgets/:id/token/regenerate   regenerateToken
// GET    /api/admin/widgets/:id/analytics          getWidgetAnalytics
// ─────────────────────────────────────────────────────────────

import prisma from "../config/database.js";
import { randomBytes } from "crypto";

// Valeurs de secours si la DB ne retourne pas encore les nouveaux champs
const PLAN_LIMITS_FALLBACK = {
  starter:   { widgetLimit: 1,  reviewsPerMonth: 100,  impressionsPerMonth: 5000  },
  growth:    { widgetLimit: 5,  reviewsPerMonth: 1000, impressionsPerMonth: 50000 },
  pro:       { widgetLimit: 20, reviewsPerMonth: 5000, impressionsPerMonth: 200000 },
  dominator: { widgetLimit: -1, reviewsPerMonth: -1,   impressionsPerMonth: -1    },
};

function getCompanyId(req) {
  const id = req.user?.companyId;
  if (!id) throw Object.assign(new Error("Forbidden"), { status: 403 });
  return parseInt(id);
}

function makeToken() {
  return randomBytes(20).toString("hex"); // 40 chars
}

// Récupère les limites effectives (plan de base + bonus addons actifs)
async function getPlanLimits(companyId) {
  const company = await prisma.company.findUnique({
    where:  { id: companyId },
    select: {
      package: {
        select: { slug: true, widgetLimit: true, reviewsPerMonth: true, impressionsPerMonth: true },
      },
    },
  });

  const pkg  = company?.package;
  const slug = pkg?.slug ?? "starter";
  const fb   = PLAN_LIMITS_FALLBACK[slug] ?? PLAN_LIMITS_FALLBACK.starter;

  const baseWidgetLimit        = pkg?.widgetLimit        ?? fb.widgetLimit;
  const baseReviewsPerMonth    = pkg?.reviewsPerMonth    ?? fb.reviewsPerMonth;
  const baseImpressionsPerMonth= pkg?.impressionsPerMonth ?? fb.impressionsPerMonth;

  // Addons actifs sur l'abonnement courant
  const subscription = await prisma.subscription.findUnique({
    where:  { companyId },
    select: {
      addons: {
        where:  { status: "active" },
        select: { addon: { select: { widgetBonus: true, reviewBonus: true, impressionBonus: true } } },
      },
    },
  });

  const addonWidgetBonus        = subscription?.addons.reduce((s, a) => s + (a.addon.widgetBonus     ?? 0), 0) ?? 0;
  const addonReviewBonus        = subscription?.addons.reduce((s, a) => s + (a.addon.reviewBonus     ?? 0), 0) ?? 0;
  const addonImpressionBonus    = subscription?.addons.reduce((s, a) => s + (a.addon.impressionBonus ?? 0), 0) ?? 0;

  // -1 = illimité : un plan illimité ne peut pas être réduit par un bonus de 0
  const addBounded = (base, bonus) => base === -1 ? -1 : base + bonus;

  return {
    slug,
    widgetLimit:         addBounded(baseWidgetLimit,         addonWidgetBonus),
    reviewsPerMonth:     addBounded(baseReviewsPerMonth,     addonReviewBonus),
    impressionsPerMonth: addBounded(baseImpressionsPerMonth, addonImpressionBonus),
  };
}

// Formate un widget pour la réponse API
function formatWidget(w) {
  return {
    id:               w.id,
    name:             w.name,
    token:            w.token,
    type:             w.type,
    status:           w.status,
    config:           w.config ?? {},
    submissionsCount: w.submissionsCount,
    viewsCount:       w.viewsCount,
    createdAt:        w.createdAt,
    updatedAt:        w.updatedAt,
  };
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/widgets
// ─────────────────────────────────────────────────────────────
export const listWidgets = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [widgets, planLimits, reviewsThisMonth, impressionsThisMonth] = await Promise.all([
      prisma.reviewWidget.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } }),
      getPlanLimits(companyId),
      prisma.widgetSubmission.count({ where: { companyId, createdAt: { gte: monthStart } } }),
      prisma.widgetEvent.count({
        where: { companyId, type: "view", occurredAt: { gte: monthStart } },
      }),
    ]);

    // -1 = illimité
    const toLimit = (v) => (v === -1 ? null : v);

    res.json({
      success: true,
      data: {
        widgets: widgets.map(formatWidget),
        total:   widgets.length,
        plan:    planLimits.slug,
        limits: {
          widgetLimit:        toLimit(planLimits.widgetLimit),
          reviewsPerMonth:    toLimit(planLimits.reviewsPerMonth),
          impressionsPerMonth:toLimit(planLimits.impressionsPerMonth),
        },
        usage: {
          widgetsCount:        widgets.length,
          reviewsThisMonth,
          impressionsThisMonth,
        },
        // Compat rétro
        limit:   toLimit(planLimits.widgetLimit),
        atLimit: planLimits.widgetLimit !== -1 && widgets.length >= planLimits.widgetLimit,
      },
    });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/admin/widgets
// Body: { name, type, config }
// ─────────────────────────────────────────────────────────────
export const createWidget = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const { name, type = "modal", config = {} } = req.body;

    if (!name?.trim()) {
      return res.status(422).json({ success: false, error: "Le nom du widget est requis." });
    }

    // TODO: réactiver la vérification de limite de plan
    const planLimits = await getPlanLimits(companyId);

    const validTypes = ["modal", "floating", "slidein", "embedded", "topbanner", "bottombanner"];
    if (!validTypes.includes(type)) {
      return res.status(422).json({ success: false, error: "Type de widget invalide." });
    }

    const widget = await prisma.reviewWidget.create({
      data: {
        companyId,
        name:   name.trim(),
        token:  makeToken(),
        type,
        status: "active",
        config,
      },
    });

    res.status(201).json({ success: true, data: formatWidget(widget) });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/admin/widgets/:id
// ─────────────────────────────────────────────────────────────
export const getWidget = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const id        = parseInt(req.params.id);

    const widget = await prisma.reviewWidget.findFirst({
      where: { id, companyId },
    });
    if (!widget) {
      return res.status(404).json({ success: false, error: "Widget introuvable." });
    }

    res.json({ success: true, data: formatWidget(widget) });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/admin/widgets/:id
// Body: { name?, type?, config? }
// ─────────────────────────────────────────────────────────────
export const updateWidget = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const id        = parseInt(req.params.id);
    const { name, type, config } = req.body;

    const existing = await prisma.reviewWidget.findFirst({ where: { id, companyId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Widget introuvable." });
    }

    if (name !== undefined && !name?.trim()) {
      return res.status(422).json({ success: false, error: "Le nom ne peut pas être vide." });
    }

    const validTypes = ["modal", "floating", "slidein", "embedded", "topbanner", "bottombanner"];
    if (type && !validTypes.includes(type)) {
      return res.status(422).json({ success: false, error: "Type de widget invalide." });
    }

    const updated = await prisma.reviewWidget.update({
      where: { id },
      data: {
        ...(name   !== undefined && { name: name.trim() }),
        ...(type   !== undefined && { type }),
        ...(config !== undefined && { config }),
      },
    });

    res.json({ success: true, data: formatWidget(updated) });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/admin/widgets/:id
// ─────────────────────────────────────────────────────────────
export const deleteWidget = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const id        = parseInt(req.params.id);

    const existing = await prisma.reviewWidget.findFirst({ where: { id, companyId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Widget introuvable." });
    }

    await prisma.reviewWidget.delete({ where: { id } });

    res.json({ success: true, message: "Widget supprimé." });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/admin/widgets/:id/status
// Body: { status: "active" | "paused" }
// ─────────────────────────────────────────────────────────────
export const toggleStatus = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const id        = parseInt(req.params.id);
    const { status } = req.body;

    const validStatuses = ["active", "paused", "draft"];
    if (!validStatuses.includes(status)) {
      return res.status(422).json({ success: false, error: "Statut invalide." });
    }

    const existing = await prisma.reviewWidget.findFirst({ where: { id, companyId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Widget introuvable." });
    }

    const updated = await prisma.reviewWidget.update({
      where: { id },
      data:  { status },
    });

    res.json({ success: true, data: { id: updated.id, status: updated.status } });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/admin/widgets/:id/duplicate
// ─────────────────────────────────────────────────────────────
export const duplicateWidget = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const id        = parseInt(req.params.id);

    // TODO: réactiver la vérification de limite de plan
    const source = await prisma.reviewWidget.findFirst({ where: { id, companyId } });
    if (!source) {
      return res.status(404).json({ success: false, error: "Widget introuvable." });
    }

    const copy = await prisma.reviewWidget.create({
      data: {
        companyId,
        name:             `${source.name} (copie)`,
        token:            makeToken(),
        type:             source.type,
        status:           "draft",
        config:           source.config ?? {},
        submissionsCount: 0,
        viewsCount:       0,
      },
    });

    res.status(201).json({ success: true, data: formatWidget(copy) });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/admin/widgets/:id/token/regenerate
// ─────────────────────────────────────────────────────────────
export const regenerateToken = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const id        = parseInt(req.params.id);

    const existing = await prisma.reviewWidget.findFirst({ where: { id, companyId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Widget introuvable." });
    }

    const newToken = makeToken();
    await prisma.reviewWidget.update({ where: { id }, data: { token: newToken } });

    res.json({ success: true, data: { id, token: newToken } });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/admin/widgets/:id/analytics?range=daily|weekly|monthly
// Retourne les soumissions groupées par période + métriques
// ─────────────────────────────────────────────────────────────
export const getWidgetAnalytics = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const id        = parseInt(req.params.id);
    const range     = req.query.range ?? "daily";

    const existing = await prisma.reviewWidget.findFirst({ where: { id, companyId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Widget introuvable." });
    }

    // Fenêtre temporelle selon le range
    const since = new Date();
    if (range === "daily")        since.setDate(since.getDate() - 30);
    else if (range === "weekly")  since.setDate(since.getDate() - 84);
    else if (range === "monthly") since.setMonth(since.getMonth() - 12);
    else since.setDate(since.getDate() - 30);

    const submissions = await prisma.widgetSubmission.findMany({
      where: {
        widgetId:  id,
        companyId,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "asc" },
      select: { rating: true, isPublic: true, createdAt: true },
    });

    // Grouper par période
    const grouped = {};
    for (const s of submissions) {
      let key;
      const d = s.createdAt;
      if (range === "daily") {
        key = d.toISOString().slice(0, 10);
      } else if (range === "weekly") {
        const day = d.getDay() || 7;
        const mon = new Date(d);
        mon.setDate(d.getDate() - day + 1);
        key = mon.toISOString().slice(0, 10);
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      }
      if (!grouped[key]) grouped[key] = { period: key, total: 0, public: 0, private: 0, ratings: [] };
      grouped[key].total++;
      if (s.isPublic) grouped[key].public++;
      else grouped[key].private++;
      grouped[key].ratings.push(s.rating);
    }

    const series = Object.values(grouped).map((g) => ({
      period:    g.period,
      total:     g.total,
      public:    g.public,
      private:   g.private,
      avgRating: g.ratings.length
        ? Math.round((g.ratings.reduce((a, b) => a + b, 0) / g.ratings.length) * 10) / 10
        : 0,
    }));

    const totalCount  = submissions.length;
    const publicCount = submissions.filter((s) => s.isPublic).length;
    const avgRating   = totalCount
      ? Math.round((submissions.reduce((a, s) => a + s.rating, 0) / totalCount) * 10) / 10
      : 0;
    const convRate    = existing.viewsCount > 0
      ? Math.round((totalCount / existing.viewsCount) * 1000) / 10
      : 0;

    res.json({
      success: true,
      data: {
        widgetId:         id,
        range,
        series,
        metrics: {
          totalSubmissions: totalCount,
          publicCount,
          privateCount:     totalCount - publicCount,
          avgRating,
          conversionRate:   convRate,
          totalViews:       existing.viewsCount,
        },
      },
    });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/admin/widgets/analytics/overview?range=daily|weekly|monthly
// Retourne un résumé multi-widgets pour le dashboard
// ─────────────────────────────────────────────────────────────
export const getOverviewAnalytics = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const range     = req.query.range ?? "daily";

    const since = new Date();
    if (range === "daily")        since.setDate(since.getDate() - 30);
    else if (range === "weekly")  since.setDate(since.getDate() - 84);
    else if (range === "monthly") since.setMonth(since.getMonth() - 12);

    const [widgets, submissions] = await Promise.all([
      prisma.reviewWidget.findMany({
        where:   { companyId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.widgetSubmission.findMany({
        where: {
          companyId,
          createdAt: { gte: since },
        },
        select: { widgetId: true, rating: true, isPublic: true, createdAt: true },
      }),
    ]);

    // Métriques par widget
    const byWidget = {};
    for (const w of widgets) {
      byWidget[w.id] = { widgetId: w.id, name: w.name, total: 0, public: 0, ratings: [] };
    }
    for (const s of submissions) {
      if (!byWidget[s.widgetId]) continue;
      byWidget[s.widgetId].total++;
      if (s.isPublic) byWidget[s.widgetId].public++;
      byWidget[s.widgetId].ratings.push(s.rating);
    }

    const widgetStats = Object.values(byWidget).map((w) => ({
      widgetId:  w.widgetId,
      name:      w.name,
      total:     w.total,
      public:    w.public,
      private:   w.total - w.public,
      avgRating: w.ratings.length
        ? Math.round((w.ratings.reduce((a, b) => a + b, 0) / w.ratings.length) * 10) / 10
        : 0,
    }));

    const totalViews  = widgets.reduce((a, w) => a + w.viewsCount, 0);
    const totalSubs   = submissions.length;
    const totalPublic = submissions.filter((s) => s.isPublic).length;

    res.json({
      success: true,
      data: {
        range,
        widgetCount:   widgets.length,
        widgetStats,
        totals: {
          submissions:    totalSubs,
          publicReviews:  totalPublic,
          privateReviews: totalSubs - totalPublic,
          views:          totalViews,
          conversionRate: totalViews > 0
            ? Math.round((totalSubs / totalViews) * 1000) / 10
            : 0,
        },
      },
    });
  } catch (e) {
    next(e);
  }
};
