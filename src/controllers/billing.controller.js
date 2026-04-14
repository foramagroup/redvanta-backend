// src/controllers/admin/billing.controller.js

import prisma from "../config/database.js";

/**
 * GET /api/admin/billing/overview
 * Vue d'ensemble : plan, addons, usage, limites
 */
export const getBillingOverview = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    
    // Récupérer subscription avec plan et addons
    const subscription = await prisma.subscription.findUnique({
      where: { companyId },
      include: {
        plan: true,
        addons: {
          where: { status: 'active' },
          include: { addon: true }
        }
      }
    });
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Aucun abonnement trouvé"
      });
    }
    
    // Calculer l'usage du mois en cours
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const usageStats = await prisma.usageRecord.groupBy({
      by: ['type'],
      where: {
        companyId,
        recordedAt: { gte: monthStart }
      },
      _sum: { quantity: true }
    });
    
    const usage = {
      api: usageStats.find(u => u.type === 'api')?._sum.quantity || 0,
      sms: usageStats.find(u => u.type === 'sms')?._sum.quantity || 0,
      webhook: usageStats.find(u => u.type === 'webhook')?._sum.quantity || 0,
    };
    
    // Calculer les limites (plan + addons)
    const limits = {
      api: subscription.plan.apiLimit + subscription.addons.reduce((sum, a) => sum + (a.addon.apiBonus || 0), 0),
      sms: subscription.plan.smsLimit + subscription.addons.reduce((sum, a) => sum + (a.addon.smsBonus || 0), 0),
      webhook: subscription.plan.webhookLimit + subscription.addons.reduce((sum, a) => sum + (a.addon.webhookBonus || 0), 0),
    };
    
    res.json({
      success: true,
      data: {
        subscription: {
          id: subscription.id,
          status: subscription.status,
          interval: subscription.interval,
          nextBillingDate: subscription.nextBillingDate,
          plan: {
            name: subscription.plan.name,
            price: subscription.baseAmount,
          },
          totalAmount: subscription.totalAmount,
        },
        addons: subscription.addons.map(a => ({
          id: a.addon.id,
          name: a.addon.name,
          description: a.addon.description,
          price: a.amount,
          status: a.status,
          active: a.status === 'active',
        })),
        usage,
        limits,
        utilization: {
          api: limits.api > 0 ? ((usage.api / limits.api) * 100).toFixed(1) : 0,
          sms: limits.sms > 0 ? ((usage.sms / limits.sms) * 100).toFixed(1) : 0,
          webhook: limits.webhook > 0 ? ((usage.webhook / limits.webhook) * 100).toFixed(1) : 0,
        }
      }
    });
    
  } catch (e) {
    next(e);
  }
};

/**
 * GET /api/admin/billing/usage-history?days=30
 * Historique d'usage quotidien (pour le graphique)
 */
export const getUsageHistory = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const days = parseInt(req.query.days) || 30;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    
    // Récupérer tous les records
    const records = await prisma.usageRecord.findMany({
      where: {
        companyId,
        recordedAt: { gte: startDate }
      },
      orderBy: { recordedAt: 'asc' }
    });
    
    // Grouper par jour
    const dailyUsage = {};
    
    records.forEach(record => {
      const day = record.recordedAt.toISOString().split('T')[0];
      if (!dailyUsage[day]) {
        dailyUsage[day] = { api: 0, sms: 0, webhooks: 0 };
      }
      dailyUsage[day][record.type] += record.quantity;
    });
    
    // Générer la liste complète des jours (même vides)
    const result = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dayKey = date.toISOString().split('T')[0];
      
      result.push({
        day: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        date: dayKey,
        api: dailyUsage[dayKey]?.api || 0,
        sms: dailyUsage[dayKey]?.sms || 0,
        webhooks: dailyUsage[dayKey]?.webhooks || 0,
      });
    }
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (e) {
    next(e);
  }
};

/**
 * GET /api/admin/billing/invoices
 * Historique des factures
 */
export const getInvoices = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    
    const subscription = await prisma.subscription.findUnique({
      where: { companyId },
      select: { id: true }
    });
    
    if (!subscription) {
      return res.json({ success: true, data: [] });
    }
    
    const invoices = await prisma.billingHistory.findMany({
      where: { subscriptionId: subscription.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        subscription: {
          include: { plan: true }
        }
      }
    });
    
    res.json({
      success: true,
      data: invoices.map(inv => ({
        id: inv.id,
        date: inv.createdAt.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        }),
        description: `${inv.subscription.plan?.name || 'Plan'} + Add-ons`,
        amount: `$${inv.totalAmount.toFixed(2)}`,
        status: inv.status === 'paid' ? 'Paid' : inv.status,
        downloadUrl: inv.stripeInvoiceId 
          ? `https://invoice.stripe.com/i/${inv.stripeInvoiceId}` 
          : null
      }))
    });
    
  } catch (e) {
    next(e);
  }
};

/**
 * GET /api/admin/billing/addons/available
 * Liste des add-ons disponibles (non activés)
 */
export const getAvailableAddons = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    
    // Récupérer les add-ons déjà activés
    const subscription = await prisma.subscription.findUnique({
      where: { companyId },
      include: {
        addons: {
          where: { status: 'active' },
          select: { addonId: true }
        }
      }
    });
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Aucun abonnement trouvé"
      });
    }
    
    const activeAddonIds = subscription.addons.map(a => a.addonId);
    
    // Récupérer les add-ons disponibles (non activés)
    const availableAddons = await prisma.addon.findMany({
      where: {
        status: 'active',
        id: { notIn: activeAddonIds }
      },
      orderBy: { displayOrder: 'asc' }
    });
    
    res.json({
      success: true,
      data: availableAddons.map(addon => ({
        id: addon.id,
        name: addon.name,
        slug: addon.slug,
        description: addon.description,
        price: `$${addon.price.toFixed(0)}/mo`,
        type: addon.type,
        icon: addon.icon,
        color: addon.color,
        isPopular: addon.isPopular,
      }))
    });
    
  } catch (e) {
    next(e);
  }
};

/**
 * POST /api/admin/billing/addons/:addonId/activate
 * Activer un add-on
 */
export const activateAddon = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const addonId = parseInt(req.params.addonId);
    
    // Vérifier que l'addon existe
    const addon = await prisma.addon.findUnique({
      where: { id: addonId, status: 'active' }
    });
    
    if (!addon) {
      return res.status(404).json({
        success: false,
        message: "Add-on introuvable"
      });
    }
    
    // Récupérer la subscription
    const subscription = await prisma.subscription.findUnique({
      where: { companyId }
    });
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Aucun abonnement trouvé"
      });
    }
    
    // Vérifier si déjà activé
    const existing = await prisma.subscriptionAddon.findUnique({
      where: {
        subscriptionId_addonId: {
          subscriptionId: subscription.id,
          addonId: addonId
        }
      }
    });
    
    if (existing && existing.status === 'active') {
      return res.status(409).json({
        success: false,
        message: "Add-on déjà activé"
      });
    }
    
    // Activer l'addon dans une transaction
    const result = await prisma.$transaction(async (tx) => {
      // Créer ou réactiver le subscription addon
      const subscriptionAddon = await tx.subscriptionAddon.upsert({
        where: {
          subscriptionId_addonId: {
            subscriptionId: subscription.id,
            addonId: addonId
          }
        },
        create: {
          subscriptionId: subscription.id,
          addonId: addonId,
          amount: addon.price,
          status: 'active',
          activatedAt: new Date(),
        },
        update: {
          status: 'active',
          amount: addon.price,
          activatedAt: new Date(),
          deactivatedAt: null,
        }
      });
      
      // Recalculer le total de la subscription
      const activeAddons = await tx.subscriptionAddon.findMany({
        where: {
          subscriptionId: subscription.id,
          status: 'active'
        }
      });
      
      const addonsAmount = activeAddons.reduce((sum, a) => sum + a.amount, 0);
      const totalAmount = subscription.baseAmount + addonsAmount;
      
      // Mettre à jour la subscription
      const updatedSubscription = await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          addonsAmount,
          totalAmount
        }
      });
      
      return { subscriptionAddon, updatedSubscription };
    });
    
    res.json({
      success: true,
      message: `Add-on "${addon.name}" activé avec succès`,
      data: {
        addon: {
          id: addon.id,
          name: addon.name,
          price: addon.price,
        },
        subscription: {
          addonsAmount: result.updatedSubscription.addonsAmount,
          totalAmount: result.updatedSubscription.totalAmount,
        }
      }
    });
    
  } catch (e) {
    next(e);
  }
};

/**
 * POST /api/admin/billing/addons/:addonId/deactivate
 * Désactiver un add-on
 */
export const deactivateAddon = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const addonId = parseInt(req.params.addonId);
    
    const subscription = await prisma.subscription.findUnique({
      where: { companyId }
    });
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Aucun abonnement trouvé"
      });
    }
    
    const result = await prisma.$transaction(async (tx) => {
      // Désactiver l'addon
      const subscriptionAddon = await tx.subscriptionAddon.updateMany({
        where: {
          subscriptionId: subscription.id,
          addonId: addonId,
          status: 'active'
        },
        data: {
          status: 'inactive',
          deactivatedAt: new Date()
        }
      });
      
      if (subscriptionAddon.count === 0) {
        throw new Error("Add-on non trouvé ou déjà désactivé");
      }
      
      // Recalculer le total
      const activeAddons = await tx.subscriptionAddon.findMany({
        where: {
          subscriptionId: subscription.id,
          status: 'active'
        }
      });
      
      const addonsAmount = activeAddons.reduce((sum, a) => sum + a.amount, 0);
      const totalAmount = subscription.baseAmount + addonsAmount;
      
      const updatedSubscription = await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          addonsAmount,
          totalAmount
        }
      });
      
      return updatedSubscription;
    });
    
    res.json({
      success: true,
      message: "Add-on désactivé avec succès",
      data: {
        subscription: {
          addonsAmount: result.addonsAmount,
          totalAmount: result.totalAmount,
        }
      }
    });
    
  } catch (e) {
    if (e.message === "Add-on non trouvé ou déjà désactivé") {
      return res.status(404).json({
        success: false,
        message: e.message
      });
    }
    next(e);
  }
};

/**
 * POST /api/admin/billing/usage/track
 * Enregistrer une consommation (API, SMS, Webhook)
 */
export const trackUsage = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const { type, quantity = 1, metadata = null } = req.body;
    
    if (!['api', 'sms', 'webhook'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Type invalide. Valeurs acceptées : api, sms, webhook"
      });
    }
    
    const subscription = await prisma.subscription.findUnique({
      where: { companyId },
      select: { id: true }
    });
    
    const usageRecord = await prisma.usageRecord.create({
      data: {
        companyId,
        subscriptionId: subscription?.id || null,
        type,
        quantity,
        metadata,
        recordedAt: new Date()
      }
    });
    
    res.json({
      success: true,
      data: usageRecord
    });
    
  } catch (e) {
    next(e);
  }
};

/**
 * POST /api/admin/billing/export-usage
 * Exporter l'usage en CSV
 */
export const exportUsage = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const { startDate, endDate } = req.body;
    
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(1));
    const end = endDate ? new Date(endDate) : new Date();
    
    const records = await prisma.usageRecord.findMany({
      where: {
        companyId,
        recordedAt: {
          gte: start,
          lte: end
        }
      },
      orderBy: { recordedAt: 'asc' }
    });
    
    // Générer CSV
    const csvHeader = "Date,Type,Quantity,Metadata\n";
    const csvRows = records.map(r => 
      `${r.recordedAt.toISOString()},${r.type},${r.quantity},"${JSON.stringify(r.metadata || {})}"`
    ).join("\n");
    
    const csv = csvHeader + csvRows;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="usage-export-${Date.now()}.csv"`);
    res.send(csv);
    
  } catch (e) {
    next(e);
  }
};