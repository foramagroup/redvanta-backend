// ═══════════════════════════════════════════════════════════
// Middleware Subscription
// Vérifier l'accès selon l'abonnement
// ═══════════════════════════════════════════════════════════

import { hasActiveSubscription, canAccessFeature, checkUsageLimit } from "../helpers/subscriptionBilling.helpers.js";

/**
 * Vérifier qu'une company a un abonnement actif
 */
export const requireActiveSubscription = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        error: "Aucune company active",
      });
    }

    const hasSubscription = await hasActiveSubscription(companyId);

    if (!hasSubscription) {
      return res.status(402).json({
        success: false,
        error: "Abonnement requis",
        code: "SUBSCRIPTION_REQUIRED",
      });
    }

    next();
  } catch (e) {
    next(e);
  }
};

/**
 * Vérifier l'accès à une fonctionnalité spécifique
 */
export const requireFeature = (feature) => {
  return async (req, res, next) => {
    try {
      const companyId = req.user?.companyId;

      if (!companyId) {
        return res.status(403).json({
          success: false,
          error: "Aucune company active",
        });
      }

      const canAccess = await canAccessFeature(companyId, feature);

      if (!canAccess) {
        return res.status(402).json({
          success: false,
          error: `Feature '${feature}' non disponible dans votre plan`,
          code: "FEATURE_NOT_AVAILABLE",
          feature,
        });
      }

      next();
    } catch (e) {
      next(e);
    }
  };
};

/**
 * Vérifier les limites d'usage
 */
export const checkLimit = (type) => {
  return async (req, res, next) => {
    try {
      const companyId = req.user?.companyId;

      if (!companyId) {
        return res.status(403).json({
          success: false,
          error: "Aucune company active",
        });
      }

      const usage = await checkUsageLimit(companyId, type);

      if (!usage.allowed) {
        return res.status(429).json({
          success: false,
          error: `Limite ${type} atteinte`,
          code: "USAGE_LIMIT_EXCEEDED",
          limit: usage.limit,
          current: usage.current,
          remaining: usage.remaining,
        });
      }

      // Passer les infos d'usage au controller si besoin
      req.usageInfo = usage;

      next();
    } catch (e) {
      next(e);
    }
  };
};