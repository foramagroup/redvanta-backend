// src/utils/usage.helpers.js
import prisma from '../config/database.js';

/**
 * Enregistrer un usage (API, SMS, Webhook)
 * @param {number} companyId - ID de la company
 * @param {string} type - Type d'usage: 'api', 'sms', 'webhook'
 * @param {number} quantity - Quantité (défaut: 1)
 * @param {object} metadata - Métadonnées optionnelles
 */
export async function trackUsage(companyId, type, quantity = 1, metadata = null) {
  try {
    // Récupérer la subscription active
    const subscription = await prisma.subscription.findUnique({
      where: { companyId: parseInt(companyId) },
      select: { id: true }
    });

    // Créer l'enregistrement d'usage
    const usage = await prisma.usageRecord.create({
      data: {
        companyId: parseInt(companyId),
        subscriptionId: subscription?.id || null,
        type,
        quantity,
        metadata,
        recordedAt: new Date(),
      }
    });

    return usage;
  } catch (error) {
    console.error('❌ Error tracking usage:', error);
    // Ne pas bloquer l'application si le tracking échoue
    return null;
  }
}

/**
 * Vérifier si la company a dépassé ses limites
 * @param {number} companyId - ID de la company
 * @param {string} type - Type d'usage
 * @returns {object} { allowed: boolean, current: number, limit: number }
 */
export async function checkUsageLimit(companyId, type) {
  try {
    // Récupérer la subscription avec plan
    const subscription = await prisma.subscription.findUnique({
      where: { companyId: parseInt(companyId) },
      include: {
        plan: true,
        addons: {
          where: { status: 'active' },
          include: { addon: true }
        }
      }
    });

    if (!subscription) {
      return { allowed: false, current: 0, limit: 0, message: 'No active subscription' };
    }

    // Déterminer la limite selon le type
    let baseLimit = 0;
    let addonBonus = 0;

    if (type === 'api') {
      baseLimit = subscription.plan.apiLimit;
      addonBonus = subscription.addons.reduce((sum, a) => sum + (a.addon.apiBonus || 0), 0);
    } else if (type === 'sms') {
      baseLimit = subscription.plan.smsLimit;
      addonBonus = subscription.addons.reduce((sum, a) => sum + (a.addon.smsBonus || 0), 0);
    } else if (type === 'webhook') {
      baseLimit = subscription.plan.webhookLimit;
      addonBonus = subscription.addons.reduce((sum, a) => sum + (a.addon.webhookBonus || 0), 0);
    }

    const totalLimit = baseLimit + addonBonus;

    // Calculer l'usage du mois en cours
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const currentUsage = await prisma.usageRecord.aggregate({
      where: {
        companyId: parseInt(companyId),
        type,
        recordedAt: {
          gte: startOfMonth
        }
      },
      _sum: {
        quantity: true
      }
    });

    const current = currentUsage._sum.quantity || 0;
    const allowed = current < totalLimit;

    return {
      allowed,
      current,
      limit: totalLimit,
      remaining: totalLimit - current,
      percentage: totalLimit > 0 ? Math.round((current / totalLimit) * 100) : 0,
    };
  } catch (error) {
    console.error('❌ Error checking usage limit:', error);
    // En cas d'erreur, autoriser l'usage pour ne pas bloquer
    return { allowed: true, current: 0, limit: 0, error: true };
  }
}

/**
 * Obtenir les statistiques d'usage pour une période
 * @param {number} companyId - ID de la company
 * @param {Date} startDate - Date de début
 * @param {Date} endDate - Date de fin
 */
export async function getUsageStats(companyId, startDate, endDate) {
  try {
    const usage = await prisma.usageRecord.groupBy({
      by: ['type'],
      where: {
        companyId: parseInt(companyId),
        recordedAt: {
          gte: startDate,
          lte: endDate,
        }
      },
      _sum: {
        quantity: true
      }
    });
    return usage.reduce((acc, item) => {
      acc[item.type] = item._sum.quantity || 0;
      return acc;
    }, {});
  } catch (error) {
    console.error('❌ Error getting usage stats:', error);
    return {};
  }
}