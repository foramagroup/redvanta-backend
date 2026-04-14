

import { checkUsageLimit, trackUsage } from '../helpers/usage.helpers.js';

/**
 * Middleware pour vérifier et tracker l'usage API
 */
export const checkApiUsage = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;
    
    if (!companyId) {
      return next(); // Pas de company, pas de tracking
    }

    // Vérifier la limite
    const usage = await checkUsageLimit(companyId, 'api');

    if (!usage.allowed) {
      return res.status(429).json({
        success: false,
        error: 'API usage limit exceeded',
        message: `You have reached your monthly API limit of ${usage.limit} calls. Please upgrade your plan.`,
        usage: {
          current: usage.current,
          limit: usage.limit,
          remaining: 0,
        }
      });
    }

    // Tracker l'usage
    await trackUsage(companyId, 'api', 1, {
      endpoint: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Ajouter les infos d'usage dans la requête
    req.usage = usage;

    next();
  } catch (error) {
    console.error('❌ Error in checkApiUsage middleware:', error);
    next();
  }
};

/**
 * Middleware pour vérifier l'usage SMS
 */
export const checkSmsUsage = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;
    
    if (!companyId) {
      return next();
    }

    const usage = await checkUsageLimit(companyId, 'sms');

    if (!usage.allowed) {
      return res.status(429).json({
        success: false,
        error: 'SMS usage limit exceeded',
        message: `You have reached your monthly SMS limit of ${usage.limit}. Please upgrade your plan.`,
        usage: {
          current: usage.current,
          limit: usage.limit,
          remaining: 0,
        }
      });
    }

    req.usage = usage;
    next();
  } catch (error) {
    console.error('❌ Error in checkSmsUsage middleware:', error);
    next();
  }
};

/**
 * Middleware pour vérifier l'usage Webhook
 */
export const checkWebhookUsage = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;
    
    if (!companyId) {
      return next();
    }

    const usage = await checkUsageLimit(companyId, 'webhook');

    if (!usage.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Webhook usage limit exceeded',
        message: `You have reached your monthly webhook limit of ${usage.limit}. Please upgrade your plan.`,
        usage: {
          current: usage.current,
          limit: usage.limit,
          remaining: 0,
        }
      });
    }

    req.usage = usage;
    next();
  } catch (error) {
    console.error('❌ Error in checkWebhookUsage middleware:', error);
    next();
  }
};