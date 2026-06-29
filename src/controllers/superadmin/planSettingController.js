// ═══════════════════════════════════════════════════════════
// src/controllers/superadmin/planSettingController.js
// Gestion des plans d'abonnement (superadmin)
// ═══════════════════════════════════════════════════════════

import prisma from "../../config/database.js";
import { invalidateLimitsCache }  from "../../services/limits.service.js";
import { invalidateFeatureCache } from "../../middleware/requireFeature.js";

const VALID_STATUSES = ["Active", "inactive", "archived"];

// ─── Include réutilisable ────────────────────────────────────
const PLAN_INCLUDE = {
  translations: {
    include: { language: { select: { id: true, code: true, name: true } } },
    orderBy: { languageId: "asc" },
  },
  _count: {
    select: { companies: true, subscriptions: true },
  },
};

// ─── Format ──────────────────────────────────────────────────
function formatPlan(plan) {
  return {
    id:           plan.id,
    slug:         plan.slug,
    price:        plan.price,
    annual:       plan.annual,
    apiLimit:     plan.apiLimit,
    smsLimit:     plan.smsLimit,
    webhookLimit: plan.webhookLimit,
    locationLimit:plan.locationLimit,
    userLimit:    plan.userLimit,
    widgetLimit:         plan.widgetLimit,
    reviewsPerMonth:     plan.reviewsPerMonth,
    impressionsPerMonth: plan.impressionsPerMonth,
    trialDays:    plan.trialDays,
    isDefault:    plan.isDefault,
    isPopular:    plan.isPopular,
    status:       plan.status,
    displayOrder: plan.displayOrder,
    createdAt:    plan.createdAt,
    updatedAt:    plan.updatedAt,
    companiesCount:     plan._count?.companies     ?? 0,
    subscriptionsCount: plan._count?.subscriptions ?? 0,
    translations: (plan.translations ?? []).map((t) => ({
      id:            t.id,
      languageId:    t.languageId,
      languageCode:  t.language?.code  ?? null,
      languageName:  t.language?.name  ?? null,
      name:          t.name,
      title:         t.title         ?? null,
      description:   t.description   ?? null,
      featureSlugs:      parseJsonField(t.featureSlugs),
      trialFeatureSlugs: parseJsonField(t.trialFeatureSlugs),
    })),
  };
}

function parseJsonField(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value); } catch { return []; }
}

// ═══════════════════════════════════════════════════════════
// GET /api/superadmin/plan-settings
// ═══════════════════════════════════════════════════════════
export const listPlans = async (req, res, next) => {
  try {
    const plans = await prisma.planSetting.findMany({
      include: PLAN_INCLUDE,
      orderBy: { displayOrder: "asc" },
    });

    res.json({ success: true, data: plans.map(formatPlan) });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// GET /api/superadmin/plan-settings/:id
// ═══════════════════════════════════════════════════════════
export const getPlan = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    const plan = await prisma.planSetting.findUnique({
      where: { id },
      include: PLAN_INCLUDE,
    });

    if (!plan) {
      return res.status(404).json({ success: false, error: req.t("superadmin.plan.not_found") });
    }

    res.json({ success: true, data: formatPlan(plan) });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// POST /api/superadmin/plan-settings
// Body: {
//   slug, price, annual,
//   apiLimit?, smsLimit?, webhookLimit?, locationLimit?, userLimit?,
//   trialDays?, isDefault?, isPopular?, status?, displayOrder?,
//   translations: [{ languageId, name, title?, description?, featureSlugs?, trialFeatureSlugs? }]
// }
// ═══════════════════════════════════════════════════════════
export const createPlan = async (req, res, next) => {
  try {
    const {
      slug,
      price,
      annual,
      apiLimit,
      smsLimit,
      webhookLimit,
      locationLimit,
      userLimit,
      widgetLimit,
      reviewsPerMonth,
      impressionsPerMonth,
      trialDays,
      isDefault,
      isPopular,
      status,
      displayOrder,
      translations,
    } = req.body;

    // Validation champs requis
    if (!slug || price === undefined || annual === undefined || !translations?.length) {
      return res.status(422).json({ success: false, error: req.t("superadmin.plan.fields_required") });
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.status(422).json({ success: false, error: req.t("superadmin.plan.invalid_slug") });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(422).json({ success: false, error: req.t("superadmin.plan.invalid_status") });
    }

    // Vérifier unicité du slug
    const existing = await prisma.planSetting.findUnique({ where: { slug } });
    if (existing) {
      return res.status(422).json({ success: false, error: req.t("superadmin.plan.slug_taken", { slug }) });
    }

    // Vérifier que toutes les langues existent
    const languageIds = translations.map((t) => parseInt(t.languageId));
    const languages = await prisma.language.findMany({ where: { id: { in: languageIds } } });
    if (languages.length !== languageIds.length) {
      return res.status(422).json({ success: false, error: req.t("superadmin.plan.invalid_languages") });
    }

    // Calculer displayOrder automatiquement si non fourni
    let order = displayOrder;
    if (order === undefined || order === null) {
      const max = await prisma.planSetting.aggregate({ _max: { displayOrder: true } });
      order = (max._max.displayOrder ?? 0) + 1;
    }

    const plan = await prisma.$transaction(async (tx) => {
      const created = await tx.planSetting.create({
        data: {
          slug,
          price:         parseInt(price),
          annual:        parseInt(annual),
          apiLimit:           apiLimit           !== undefined ? parseInt(apiLimit)           : undefined,
          smsLimit:           smsLimit           !== undefined ? parseInt(smsLimit)           : undefined,
          webhookLimit:       webhookLimit       !== undefined ? parseInt(webhookLimit)       : undefined,
          locationLimit:      locationLimit      !== undefined ? parseInt(locationLimit)      : undefined,
          userLimit:          userLimit          !== undefined ? parseInt(userLimit)          : undefined,
          widgetLimit:        widgetLimit        !== undefined ? parseInt(widgetLimit)        : undefined,
          reviewsPerMonth:    reviewsPerMonth    !== undefined ? parseInt(reviewsPerMonth)    : undefined,
          impressionsPerMonth:impressionsPerMonth!== undefined ? parseInt(impressionsPerMonth): undefined,
          trialDays:          trialDays          !== undefined ? parseInt(trialDays)          : undefined,
          isDefault:     isDefault     !== undefined ? Boolean(isDefault)      : undefined,
          isPopular:     isPopular     !== undefined ? Boolean(isPopular)      : undefined,
          status:        status        ?? "Active",
          displayOrder:  parseInt(order),
        },
      });

      await tx.planSettingTranslation.createMany({
        data: translations.map((t) => ({
          planId:            created.id,
          languageId:        parseInt(t.languageId),
          name:              t.name,
          title:             t.title             ?? null,
          description:       t.description       ?? null,
          featureSlugs:      t.featureSlugs      ?? null,
          trialFeatureSlugs: t.trialFeatureSlugs ?? null,
        })),
      });

      return tx.planSetting.findUnique({ where: { id: created.id }, include: PLAN_INCLUDE });
    });

    res.status(201).json({
      success: true,
      message: req.t("superadmin.plan.created"),
      data: formatPlan(plan),
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// PUT /api/superadmin/plan-settings/:id
// Même body que createPlan (translations optionnelles pour update partiel)
// ═══════════════════════════════════════════════════════════
export const updatePlan = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const {
      slug,
      price,
      annual,
      apiLimit,
      smsLimit,
      webhookLimit,
      locationLimit,
      userLimit,
      widgetLimit,
      reviewsPerMonth,
      impressionsPerMonth,
      trialDays,
      isDefault,
      isPopular,
      status,
      displayOrder,
      translations,
    } = req.body;

    const existing = await prisma.planSetting.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: req.t("superadmin.plan.not_found") });
    }

    if (slug && !/^[a-z0-9-]+$/.test(slug)) {
      return res.status(422).json({ success: false, error: req.t("superadmin.plan.invalid_slug") });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(422).json({ success: false, error: req.t("superadmin.plan.invalid_status") });
    }

    // Vérifier unicité du slug si modifié
    if (slug && slug !== existing.slug) {
      const slugExists = await prisma.planSetting.findUnique({ where: { slug } });
      if (slugExists) {
        return res.status(422).json({ success: false, error: req.t("superadmin.plan.slug_taken", { slug }) });
      }
    }

    // Vérifier les langues si des traductions sont fournies
    if (translations?.length) {
      const languageIds = translations.map((t) => parseInt(t.languageId));
      const languages = await prisma.language.findMany({ where: { id: { in: languageIds } } });
      if (languages.length !== languageIds.length) {
        return res.status(422).json({ success: false, error: req.t("superadmin.plan.invalid_languages") });
      }
    }

    const plan = await prisma.$transaction(async (tx) => {
      // Construire les données de mise à jour (uniquement les champs fournis)
      const updateData = {};
      if (slug          !== undefined) updateData.slug          = slug;
      if (price         !== undefined) updateData.price         = parseInt(price);
      if (annual        !== undefined) updateData.annual        = parseInt(annual);
      if (apiLimit           !== undefined) updateData.apiLimit           = parseInt(apiLimit);
      if (smsLimit           !== undefined) updateData.smsLimit           = parseInt(smsLimit);
      if (webhookLimit       !== undefined) updateData.webhookLimit       = parseInt(webhookLimit);
      if (locationLimit      !== undefined) updateData.locationLimit      = parseInt(locationLimit);
      if (userLimit          !== undefined) updateData.userLimit          = parseInt(userLimit);
      if (widgetLimit        !== undefined) updateData.widgetLimit        = parseInt(widgetLimit);
      if (reviewsPerMonth    !== undefined) updateData.reviewsPerMonth    = parseInt(reviewsPerMonth);
      if (impressionsPerMonth!== undefined) updateData.impressionsPerMonth= parseInt(impressionsPerMonth);
      if (trialDays          !== undefined) updateData.trialDays          = parseInt(trialDays);
      if (isDefault     !== undefined) updateData.isDefault     = Boolean(isDefault);
      if (isPopular     !== undefined) updateData.isPopular     = Boolean(isPopular);
      if (status        !== undefined) updateData.status        = status;
      if (displayOrder  !== undefined) updateData.displayOrder  = parseInt(displayOrder);

      await tx.planSetting.update({ where: { id }, data: updateData });

      // Upsert des traductions fournies
      if (translations?.length) {
        for (const t of translations) {
          await tx.planSettingTranslation.upsert({
            where: { planId_languageId: { planId: id, languageId: parseInt(t.languageId) } },
            update: {
              name:              t.name,
              title:             t.title             ?? null,
              description:       t.description       ?? null,
              featureSlugs:      t.featureSlugs      ?? null,
              trialFeatureSlugs: t.trialFeatureSlugs ?? null,
            },
            create: {
              planId:            id,
              languageId:        parseInt(t.languageId),
              name:              t.name,
              title:             t.title             ?? null,
              description:       t.description       ?? null,
              featureSlugs:      t.featureSlugs      ?? null,
              trialFeatureSlugs: t.trialFeatureSlugs ?? null,
            },
          });
        }
      }

      return tx.planSetting.findUnique({ where: { id }, include: PLAN_INCLUDE });
    });

    // Invalider les caches de toutes les companies utilisant ce plan
    const affected = await prisma.company.findMany({
      where:  { planId: id },
      select: { id: true },
    });
    for (const c of affected) {
      invalidateLimitsCache(c.id);
      invalidateFeatureCache(c.id);
    }

    res.json({
      success: true,
      message: req.t("superadmin.plan.updated"),
      data: formatPlan(plan),
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// DELETE /api/superadmin/plan-settings/:id
// Bloqué si des companies ou subscriptions actives utilisent ce plan
// ═══════════════════════════════════════════════════════════
export const deletePlan = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    const plan = await prisma.planSetting.findUnique({
      where: { id },
      include: { _count: { select: { companies: true, subscriptions: true } } },
    });

    if (!plan) {
      return res.status(404).json({ success: false, error: req.t("superadmin.plan.not_found") });
    }

    if (plan._count.companies > 0 || plan._count.subscriptions > 0) {
      return res.status(422).json({
        success: false,
        error: req.t("superadmin.plan.cannot_delete_in_use", {
          companies:     plan._count.companies,
          subscriptions: plan._count.subscriptions,
        }),
      });
    }

    await prisma.planSetting.delete({ where: { id } });

    res.json({ success: true, message: req.t("superadmin.plan.deleted") });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// PATCH /api/superadmin/plan-settings/:id/status
// Body: { status: "Active" | "inactive" | "archived" }
// ═══════════════════════════════════════════════════════════
export const updatePlanStatus = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(422).json({ success: false, error: req.t("superadmin.plan.invalid_status") });
    }

    const plan = await prisma.planSetting.findUnique({ where: { id } });
    if (!plan) {
      return res.status(404).json({ success: false, error: req.t("superadmin.plan.not_found") });
    }

    await prisma.planSetting.update({ where: { id }, data: { status } });

    res.json({
      success: true,
      message: req.t("superadmin.plan.status_updated", { status }),
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// GET /api/superadmin/plan-settings/features
// Retourne le catalogue de features avec toutes leurs traductions.
// Le frontend résout le nom par langue (feature.translations[langId].name).
// ═══════════════════════════════════════════════════════════
export const getFeatureCatalog = async (req, res, next) => {
  try {
    const features = await prisma.feature.findMany({
      where: { status: "active" },
      include: { translations: true },
      orderBy: [{ category: "asc" }, { displayOrder: "asc" }],
    });

    res.json({ success: true, data: features });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// POST /api/superadmin/plan-settings/reorder
// Body: { orders: [{ id: 1, order: 3 }, { id: 2, order: 1 }] }
// ═══════════════════════════════════════════════════════════
export const reorderPlans = async (req, res, next) => {
  try {
    const { orders } = req.body;

    if (!orders || !Array.isArray(orders)) {
      return res.status(422).json({ success: false, error: req.t("superadmin.plan.orders_required") });
    }

    await prisma.$transaction(
      orders.map(({ id, order }) =>
        prisma.planSetting.update({
          where: { id: parseInt(id) },
          data:  { displayOrder: parseInt(order) },
        })
      )
    );

    res.json({ success: true, message: req.t("superadmin.plan.order_updated") });
  } catch (e) {
    next(e);
  }
};
