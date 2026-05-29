import prisma from "../config/database.js";

// ── Cache des limites du plan par company (5 min TTL) ────────
const _cache = new Map();
const TTL = 5 * 60 * 1000;

async function getPlanLimits(companyId) {
  const hit = _cache.get(companyId);
  if (hit && Date.now() < hit.exp) return hit.limits;

  const company = await prisma.company.findUnique({
    where:  { id: companyId },
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
    },
  });

  const limits = company?.package ?? null;
  _cache.set(companyId, { limits, exp: Date.now() + TTL });
  return limits;
}

// ── Capacité : locations ─────────────────────────────────────
export async function checkLocationLimit(companyId) {
  const limits = await getPlanLimits(companyId);
  if (!limits) return { allowed: true, current: 0, max: null }; // pas de plan → fail-open

  const current = await prisma.location.count({ where: { companyId } });
  return { allowed: current < limits.locationLimit, current, max: limits.locationLimit };
}

// ── Capacité : membres de l'équipe ───────────────────────────
export async function checkUserLimit(companyId) {
  const limits = await getPlanLimits(companyId);
  if (!limits) return { allowed: true, current: 0, max: null };

  const current = await prisma.userCompany.count({ where: { companyId } });
  return { allowed: current < limits.userLimit, current, max: limits.userLimit };
}

// ── Usage mensuel : depuis le début du mois calendaire ───────
async function getMonthlyUsage(companyId, type) {
  const from = new Date();
  from.setDate(1);
  from.setHours(0, 0, 0, 0);

  const agg = await prisma.usageRecord.aggregate({
    where: { companyId, type, recordedAt: { gte: from } },
    _sum:  { quantity: true },
  });
  return agg._sum.quantity ?? 0;
}

// ── Usage : SMS (mensuel) ────────────────────────────────────
export async function checkSmsLimit(companyId) {
  const limits = await getPlanLimits(companyId);
  if (!limits) return { allowed: true, current: 0, max: null };

  const current = await getMonthlyUsage(companyId, "sms");
  return { allowed: current < limits.smsLimit, current, max: limits.smsLimit };
}

// ── Usage : API calls (mensuel) ──────────────────────────────
export async function checkApiLimit(companyId) {
  const limits = await getPlanLimits(companyId);
  if (!limits) return { allowed: true, current: 0, max: null };

  const current = await getMonthlyUsage(companyId, "api");
  return { allowed: current < limits.apiLimit, current, max: limits.apiLimit };
}

// ── Enregistrer un usage (sms / api / webhook) ────────────────
export async function recordUsage(companyId, type, metadata = null, subscriptionId = null) {
  return prisma.usageRecord.create({
    data: { companyId, type, quantity: 1, metadata, subscriptionId },
  });
}

// ── Invalider le cache quand le plan change ───────────────────
export function invalidateLimitsCache(companyId) {
  _cache.delete(Number(companyId));
}
