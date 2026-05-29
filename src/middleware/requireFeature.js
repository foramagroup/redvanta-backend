import prisma from "../config/database.js";

// Cache company → featureSlugs, TTL 5 min pour éviter une query DB par requête
const _cache = new Map();
const TTL = 5 * 60 * 1000;

async function getFeatureSlugs(companyId) {
  const hit = _cache.get(companyId);
  if (hit && Date.now() < hit.exp) return hit.slugs;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      package: {
        select: {
          translations: { select: { featureSlugs: true } },
        },
      },
    },
  });

  const trs = company?.package?.translations ?? [];
  const tr  = trs.find((t) => Array.isArray(t.featureSlugs) && t.featureSlugs.length > 0)
           ?? trs.find((t) => t.featureSlugs !== null)
           ?? null;
  const slugs = Array.isArray(tr?.featureSlugs) ? tr.featureSlugs : null;

  _cache.set(companyId, { slugs, exp: Date.now() + TTL });
  return slugs;
}

/**
 * requireFeature('reviews')
 * → 403 si le plan de la company n'inclut pas ce slug.
 * → laisse passer si featureSlugs est null (plan non encore configuré).
 * Doit être placé APRÈS authenticateAdmin (req.user.companyId requis).
 */
export function requireFeature(slug) {
  return async (req, res, next) => {
    try {
      const companyId = req.user?.companyId ? Number(req.user.companyId) : null;
      if (!companyId) return next(); // sans companyId → laisse passer (bloqué en aval)

      const slugs = await getFeatureSlugs(companyId);
      if (slugs === null) return next(); // plan non configuré → tout accessible

      if (!slugs.includes(slug)) {
        return res.status(403).json({
          success: false,
          error:   `Cette fonctionnalité (${slug}) n'est pas incluse dans votre plan.`,
          code:    'FEATURE_NOT_INCLUDED',
        });
      }

      return next();
    } catch (err) {
      console.error('[requireFeature]', err.message);
      return next(); // fail-open : en cas d'erreur DB, on ne bloque pas
    }
  };
}

/** Vider le cache d'une company (à appeler quand son plan change) */
export function invalidateFeatureCache(companyId) {
  _cache.delete(Number(companyId));
}
