// ═══════════════════════════════════════════════════════════
// Subscription Helpers
// Utilitaires et validations abonnements
// ═══════════════════════════════════════════════════════════

import prisma from "../config/database.js";

/**
 * Vérifier si une company a un abonnement actif
 */
export async function hasActiveSubscription(companyId) {
  const subscription = await prisma.subscription.findFirst({
    where: {
      companyId,
      status: { in: ["active", "trialing"] },
    },
  });

  return !!subscription;
}

/**
 * Récupérer l'abonnement actif d'une company
 */
export async function getActiveSubscription(companyId) {
  return await prisma.subscription.findFirst({
    where: {
      companyId,
      status: { in: ["active", "trialing"] },
    },
    include: {
      plan: true,
      addons: { include: { addon: true } },
    },
  });
}

/**
 * Vérifier si une company peut accéder à une fonctionnalité
 */
export async function canAccessFeature(companyId, feature) {
  const subscription = await getActiveSubscription(companyId);

  if (!subscription) {
    return false;
  }

  const plan = subscription.plan;

  switch (feature) {
    case "api":
      return plan.apiLimit > 0;
    case "sms":
      return plan.smsLimit > 0;
    case "webhooks":
      return plan.webhookLimit > 0;
    case "multiple_locations":
      return plan.locationLimit > 1 || plan.locationLimit === null;
    case "team_members":
      return plan.userLimit > 1 || plan.userLimit === null;
    default:
      return false;
  }
}

/**
 * Vérifier les limites d'usage
 */
export async function checkUsageLimit(companyId, type) {
  const subscription = await getActiveSubscription(companyId);

  if (!subscription) {
    return { allowed: false, limit: 0, current: 0, remaining: 0 };
  }

  const plan = subscription.plan;
  let limit, current;

  switch (type) {
    case "api":
      limit = plan.apiLimit;
      current = await prisma.usageRecord.count({
        where: {
          companyId,
          type: "api",
          recordedAt: { gte: subscription.currentPeriodStart },
        },
      });
      break;

    case "sms":
      limit = plan.smsLimit;
      current = await prisma.usageRecord.count({
        where: {
          companyId,
          type: "sms",
          recordedAt: { gte: subscription.currentPeriodStart },
        },
      });
      break;

    case "webhooks":
      limit = plan.webhookLimit;
      current = await prisma.usageRecord.count({
        where: {
          companyId,
          type: "webhook",
          recordedAt: { gte: subscription.currentPeriodStart },
        },
      });
      break;

    case "locations":
      limit = plan.locationLimit;
      current = await prisma.location.count({
        where: { companyId, active: true },
      });
      break;

    case "users":
      limit = plan.userLimit;
      current = await prisma.userCompany.count({
        where: { companyId },
      });
      break;

    default:
      return { allowed: false, limit: 0, current: 0, remaining: 0 };
  }

  // NULL = unlimited
  if (limit === null) {
    return {
      allowed: true,
      limit: "unlimited",
      current,
      remaining: "unlimited",
    };
  }

  return {
    allowed: current < limit,
    limit,
    current,
    remaining: Math.max(0, limit - current),
  };
}

/**
 * Enregistrer l'usage d'une ressource
 */
export async function trackUsage(companyId, type, quantity = 1, metadata = null) {
  const subscription = await getActiveSubscription(companyId);

  await prisma.usageRecord.create({
    data: {
      companyId,
      subscriptionId: subscription?.id || null,
      type,
      quantity,
      metadata,
      recordedAt: new Date(),
    },
  });

  console.log(`[Usage] Tracked ${type} usage for company ${companyId}: ${quantity}`);
}

/**
 * Calculer la différence de prix entre deux plans (pour upgrade/downgrade)
 */
export async function calculatePlanDifference(currentPlanId, newPlanId, interval) {
  const currentPlan = await prisma.planSetting.findUnique({
    where: { id: currentPlanId },
  });

  const newPlan = await prisma.planSetting.findUnique({
    where: { id: newPlanId },
  });

  if (!currentPlan || !newPlan) {
    throw new Error("Plan introuvable");
  }

  const currentPrice = interval === "monthly" ? currentPlan.price : currentPlan.annual;
  const newPrice = interval === "monthly" ? newPlan.price : newPlan.annual;

  return {
    currentPrice: Number(currentPrice),
    newPrice: Number(newPrice),
    difference: Number(newPrice) - Number(currentPrice),
    isUpgrade: newPrice > currentPrice,
    isDowngrade: newPrice < currentPrice,
  };
}

/**
 * Valider qu'un plan peut être sélectionné par une company
 */
export function validatePlanSelection(plan, company) {
  if (!plan || plan.status !== "Active") {
    return { valid: false, error: "Plan indisponible" };
  }

  // Ici tu peux ajouter des règles métier spécifiques
  // Exemple : certains plans réservés aux agencies
  if (plan.slug === "enterprise" && company.type !== "agency") {
    return {
      valid: false,
      error: "Le plan Enterprise est réservé aux agences",
    };
  }

  return { valid: true };
}

/**
 * Déterminer le prochain billing date après un changement de plan
 */
export function calculateNextBillingAfterChange(currentPeriodEnd, immediate = false) {
  if (immediate) {
    return new Date();
  }

  return new Date(currentPeriodEnd);
}

/**
 * Formater les features d'un plan pour affichage
 */
export function formatPlanFeatures(plan) {
  const features = [];

  if (plan.apiLimit > 0) {
    features.push(
      plan.apiLimit === null
        ? "Unlimited API calls"
        : `${plan.apiLimit.toLocaleString()} API calls/month`
    );
  }

  if (plan.smsLimit > 0) {
    features.push(
      plan.smsLimit === null
        ? "Unlimited SMS"
        : `${plan.smsLimit.toLocaleString()} SMS/month`
    );
  }

  if (plan.webhookLimit > 0) {
    features.push(
      plan.webhookLimit === null
        ? "Unlimited Webhooks"
        : `${plan.webhookLimit.toLocaleString()} Webhooks/month`
    );
  }

  if (plan.locationLimit) {
    features.push(
      plan.locationLimit === null
        ? "Unlimited Locations"
        : `Up to ${plan.locationLimit} location${plan.locationLimit > 1 ? "s" : ""}`
    );
  }

  if (plan.userLimit) {
    features.push(
      plan.userLimit === null
        ? "Unlimited Team Members"
        : `Up to ${plan.userLimit} team member${plan.userLimit > 1 ? "s" : ""}`
    );
  }

  // Ajouter les features JSON du plan
  if (plan.features && Array.isArray(plan.features)) {
    features.push(...plan.features);
  }

  return features;
}

/**
 * Vérifier si un abonnement est en trial
 */
export function isInTrial(subscription) {
  if (!subscription.trialEnd) return false;
  return new Date() < new Date(subscription.trialEnd);
}

/**
 * Calculer les jours restants de trial
 */
export function getTrialDaysRemaining(subscription) {
  if (!isInTrial(subscription)) return 0;

  const now = new Date();
  const trialEnd = new Date(subscription.trialEnd);
  const diffTime = trialEnd - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}