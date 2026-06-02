import prisma from "../config/database.js";

// ── Cache des limites effectives par company ──────────────────
// TTL 10 min — invalidateLimitsCache() appelé à chaque changement.
// PROD multi-instance : remplacer par Redis (ioredis.get/set/del)
const _cache = new Map();
const TTL = 10 * 60 * 1000;

// ─────────────────────────────────────────────────────────────
// Calcule les limites effectives : plan + bonus des addons actifs
// 1 seule requête DB (company + subscription + addons en include)
// ─────────────────────────────────────────────────────────────
async function getEffectiveLimits(companyId) {
  const id  = Number(companyId); // normalise string/number
  const hit = _cache.get(id);
  if (hit && Date.now() < hit.exp) return hit.limits;

  // 1 requête pour tout récupérer
  const company = await prisma.company.findUnique({
    where:  { id },
    select: {
      package: {
        select: {
          locationLimit: true,
          userLimit:     true,
          apiLimit:      true,
          smsLimit:      true,
          webhookLimit:  true,
        },
      },
      subscription: {
        select: {
          addons: {
            where:  { status: "active" },
            select: {
              addon: {
                select: {
                  locationBonus: true,
                  userBonus:     true,
                  apiBonus:      true,
                  smsBonus:      true,
                  webhookBonus:  true,
                },
              },
            },
          },
        },
      },
    },
  });

  const plan = company?.package ?? null;
  if (!plan) {
    _cache.set(id, { limits: null, exp: Date.now() + TTL });
    return null;
  }

  // 1 seul passage sur les addons pour tous les bonus
  const bonus = (company.subscription?.addons ?? []).reduce(
    (acc, { addon: a }) => {
      if (!a) return acc;
      acc.location += a.locationBonus || 0;
      acc.user     += a.userBonus     || 0;
      acc.api      += a.apiBonus      || 0;
      acc.sms      += a.smsBonus      || 0;
      acc.webhook  += a.webhookBonus  || 0;
      return acc;
    },
    { location: 0, user: 0, api: 0, sms: 0, webhook: 0 }
  );

  const limits = {
    locationLimit: plan.locationLimit + bonus.location,
    userLimit:     plan.userLimit     + bonus.user,
    apiLimit:      plan.apiLimit      + bonus.api,
    smsLimit:      plan.smsLimit      + bonus.sms,
    webhookLimit:  plan.webhookLimit  + bonus.webhook,
  };

  _cache.set(id, { limits, exp: Date.now() + TTL });
  return limits;
}

// ── Capacité : locations ─────────────────────────────────────
export async function checkLocationLimit(companyId) {
  const limits = await getEffectiveLimits(companyId);
  if (!limits) return { allowed: true, current: 0, max: null };

  const current = await prisma.location.count({ where: { companyId: Number(companyId) } });
  return { allowed: current < limits.locationLimit, current, max: limits.locationLimit };
}

// ── Capacité : membres de l'équipe ───────────────────────────
export async function checkUserLimit(companyId) {
  const limits = await getEffectiveLimits(companyId);
  if (!limits) return { allowed: true, current: 0, max: null };

  const current = await prisma.userCompany.count({ where: { companyId: Number(companyId) } });
  return { allowed: current < limits.userLimit, current, max: limits.userLimit };
}

// ── Usage mensuel : depuis le début du mois calendaire ───────
async function getMonthlyUsage(companyId, type) {
  const from = new Date();
  from.setDate(1);
  from.setHours(0, 0, 0, 0);

  const agg = await prisma.usageRecord.aggregate({
    where: { companyId: Number(companyId), type, recordedAt: { gte: from } },
    _sum:  { quantity: true },
  });
  return agg._sum.quantity ?? 0;
}

// ── Usage : SMS (mensuel) ────────────────────────────────────
export async function checkSmsLimit(companyId) {
  const limits = await getEffectiveLimits(companyId);
  if (!limits) return { allowed: true, current: 0, max: null };

  const current = await getMonthlyUsage(companyId, "sms");
  return { allowed: current < limits.smsLimit, current, max: limits.smsLimit };
}

// ── Usage : API calls (mensuel) ──────────────────────────────
export async function checkApiLimit(companyId) {
  const limits = await getEffectiveLimits(companyId);
  if (!limits) return { allowed: true, current: 0, max: null };

  const current = await getMonthlyUsage(companyId, "api");
  return { allowed: current < limits.apiLimit, current, max: limits.apiLimit };
}

// ── Enregistrer un usage (sms / api / webhook) ────────────────
export async function recordUsage(companyId, type, metadata = null, subscriptionId = null) {
  return prisma.usageRecord.create({
    data: { companyId: Number(companyId), type, quantity: 1, metadata, subscriptionId },
  });
}

// ── Invalider le cache (plan ou addon changé) ─────────────────
export function invalidateLimitsCache(companyId) {
  _cache.delete(Number(companyId));
}
