// ═══════════════════════════════════════════════════════════
// src/controllers/planBuilder.controller.js
// Endpoints CLIENT ADMIN — PlanBuilder (Dashboard)
// Routes montées sous /api/admin/plan-builder
// ═══════════════════════════════════════════════════════════

import prisma from "../config/database.js";
import { getStripe } from "../services/Stripe.service.js";
import {
  getOrCreateStripeCustomer,
  getDefaultPaymentMethod,
  createSetupIntent,
  calculatePeriodDates,
  createSubscriptionInvoice,
  sendSubscriptionWelcomeEmail,
  sendSubscriptionPendingEmail,
  generateSubscriptionOrderNumber,
} from "../services/stripeSubscription.service.js";

// ─── Helpers ─────────────────────────────────────────────────

function getCompanyId(req) {
  const id = req.user?.companyId;
  if (!id) throw Object.assign(new Error("Aucune company active"), { status: 403 });
  return parseInt(id);
}

const TAX_RATE = 0.10; // 10%

// Facteur de prix selon l'interval
function intervalFactor(interval) {
  return interval === "yearly" ? 0.9 : 1;
}

// Calcule tous les montants à partir du plan + addons + locations
function computeAmounts({ plan, addons, extraLocations = 0, interval }) {
  const factor = intervalFactor(interval);
  const baseAmount = (interval === "yearly" ? plan.annual : plan.price) * factor;

  const LOCATION_UNIT_PRICE = 29;
  const locationCost = extraLocations * LOCATION_UNIT_PRICE * factor;

  const addonsAmount = addons.reduce((sum, a) => sum + a.price * factor, 0) + locationCost;
  const subtotal = baseAmount + addonsAmount;
  const taxAmount = subtotal * TAX_RATE;
  const totalAmount = subtotal + taxAmount;

  return {
    baseAmount: Math.round(baseAmount * 100) / 100,
    addonsAmount: Math.round(addonsAmount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}

// Formate un plan
function formatPlan(p) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    annual: p.annual,
    description: p.description ?? null,
    features: p.features ?? [],
    locationLimit: p.locationLimit,
    userLimit: p.userLimit,
    apiLimit: p.apiLimit,
    smsLimit: p.smsLimit,
    webhookLimit: p.webhookLimit,
    trialDays: p.trialDays,
    isPopular: p.isPopular,
    isDefault: p.isDefault,
    displayOrder: p.displayOrder,
  };
}

// Formate un addon
function formatAddon(a) {
  return {
    id: a.id,
    name: a.name,
    slug: a.slug,
    description: a.description,
    price: a.price,
    type: a.type,
    icon: a.icon,
    features: a.features ?? [],
    locationBonus: a.locationBonus ?? 0,
    isPopular: a.isPopular,
    displayOrder: a.displayOrder,
  };
}

// Formate la subscription
function formatSubscription(sub) {
  return {
    id: sub.id,
    status: sub.status,
    interval: sub.interval,
    baseAmount: sub.baseAmount,
    addonsAmount: sub.addonsAmount,
    totalAmount: sub.totalAmount,
    currentPeriodStart: sub.currentPeriodStart,
    currentPeriodEnd: sub.currentPeriodEnd,
    nextBillingDate: sub.nextBillingDate,
    trialEnd: sub.trialEnd ?? null,
    cancelAt: sub.cancelAt ?? null,
    plan: sub.plan ? formatPlan(sub.plan) : null,
    addons: (sub.addons ?? [])
      .filter((sa) => sa.status === "active")
      .map((sa) => ({
        id: sa.addon.id,
        slug: sa.addon.slug,
        name: sa.addon.name,
        amount: sa.amount,
        activatedAt: sa.activatedAt,
      })),
  };
}

// ═══════════════════════════════════════════════════════════
// GET /api/admin/plan-builder/catalog
// ═══════════════════════════════════════════════════════════
export const getCatalog = async (req, res, next) => {
  try {
    const [plans, addons] = await Promise.all([
      prisma.planSetting.findMany({
        where: { status: "Active" },
        orderBy: { displayOrder: "asc" },
      }),
      prisma.addon.findMany({
        where: { status: "active" },
        orderBy: { displayOrder: "asc" },
      }),
    ]);

    res.json({
      success: true,
      data: {
        plans: plans.map(formatPlan),
        addons: addons.map(formatAddon),
        taxRate: TAX_RATE,
        locationUnitPrice: 29,
      },
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// GET /api/admin/plan-builder/current
// ═══════════════════════════════════════════════════════════
export const getCurrentSubscription = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);

    const sub = await prisma.subscription.findUnique({
      where: { companyId },
      include: {
        plan: true,
        addons: {
          include: { addon: true },
          where: { status: "active" },
        },
      },
    });

    if (!sub) {
      return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: formatSubscription(sub) });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// POST /api/admin/plan-builder/preview
// ═══════════════════════════════════════════════════════════
export const previewSubscription = async (req, res, next) => {
  try {
    const { planId, addonIds = [], extraLocations = 0, interval = "monthly" } = req.body;

    if (!planId) {
      return res.status(422).json({ success: false, error: "planId requis" });
    }
    if (!["monthly", "yearly"].includes(interval)) {
      return res.status(422).json({ success: false, error: "interval invalide" });
    }

    const plan = await prisma.planSetting.findFirst({
      where: { id: parseInt(planId), status: "Active" },
    });
    if (!plan) return res.status(404).json({ success: false, error: "Plan introuvable" });

    let addons = [];
    if (addonIds.length > 0) {
      addons = await prisma.addon.findMany({
        where: { id: { in: addonIds.map(Number) }, status: "active" },
      });
    }

    const amounts = computeAmounts({ plan, addons, extraLocations, interval });
    const factor = intervalFactor(interval);

    res.json({
      success: true,
      data: {
        plan: formatPlan(plan),
        addons: addons.map(formatAddon),
        extraLocations,
        interval,
        breakdown: {
          planLine: {
            label: plan.name,
            amount: Math.round((interval === "yearly" ? plan.annual : plan.price) * factor * 100) / 100,
          },
          addonLines: addons.map((a) => ({
            label: a.name,
            amount: Math.round(a.price * factor * 100) / 100,
          })),
          locationLine: extraLocations > 0
            ? {
                label: `Extra locations ×${extraLocations}`,
                amount: Math.round(29 * extraLocations * factor * 100) / 100,
              }
            : null,
        },
        ...amounts,
        annualSavings: interval === "yearly"
          ? Math.round((amounts.subtotal ?? amounts.totalAmount - amounts.taxAmount) / 0.9 * 0.1 * 12 * 100) / 100
          : 0,
      },
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// POST /api/admin/plan-builder/subscribe
// Créer/upgrade plan (SANS paiement immédiat)
// ═══════════════════════════════════════════════════════════
export const subscribe = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const { planId, addonIds = [], extraLocations = 0, interval = "monthly" } = req.body;

    if (!planId) return res.status(422).json({ success: false, error: "planId requis" });
    if (!["monthly", "yearly"].includes(interval)) {
      return res.status(422).json({ success: false, error: "interval invalide" });
    }

    const plan = await prisma.planSetting.findFirst({
      where: { id: parseInt(planId), status: "Active" },
    });
    if (!plan) return res.status(404).json({ success: false, error: "Plan introuvable" });

    let addons = [];
    const parsedAddonIds = addonIds.map(Number);
    if (parsedAddonIds.length > 0) {
      addons = await prisma.addon.findMany({
        where: { id: { in: parsedAddonIds }, status: "active" },
      });
      if (addons.length !== parsedAddonIds.length) {
        return res.status(422).json({ success: false, error: "Addons invalides" });
      }
    }

    const amounts = computeAmounts({ plan, addons, extraLocations, interval });
    const now = new Date();
    const periodEnd = new Date(now);
    interval === "yearly"
      ? periodEnd.setFullYear(periodEnd.getFullYear() + 1)
      : periodEnd.setMonth(periodEnd.getMonth() + 1);

    const existing = await prisma.subscription.findUnique({
      where: { companyId },
      include: { addons: true },
    });

    let subscription;

    if (existing) {
      subscription = await prisma.$transaction(async (tx) => {
        const updated = await tx.subscription.update({
          where: { companyId },
          data: {
            planId: plan.id,
            interval,
            baseAmount: amounts.baseAmount,
            addonsAmount: amounts.addonsAmount,
            totalAmount: amounts.totalAmount,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            nextBillingDate: periodEnd,
            status: "active",
            metadata: { extraLocations },
          },
          include: { plan: true, addons: { include: { addon: true } } },
        });

        await tx.subscriptionAddon.updateMany({
          where: { subscriptionId: existing.id },
          data: { status: "inactive", deactivatedAt: now },
        });

        for (const addon of addons) {
          await tx.subscriptionAddon.upsert({
            where: {
              subscriptionId_addonId: { subscriptionId: existing.id, addonId: addon.id },
            },
            update: {
              status: "active",
              amount: addon.price,
              activatedAt: now,
              deactivatedAt: null,
            },
            create: {
              subscriptionId: existing.id,
              addonId: addon.id,
              amount: addon.price,
              status: "active",
            },
          });
        }

        return updated;
      });
    } else {
      subscription = await prisma.$transaction(async (tx) => {
        const created = await tx.subscription.create({
          data: {
            companyId,
            planId: plan.id,
            interval,
            status: "active",
            baseAmount: amounts.baseAmount,
            addonsAmount: amounts.addonsAmount,
            totalAmount: amounts.totalAmount,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            nextBillingDate: periodEnd,
            metadata: { extraLocations },
          },
          include: { plan: true, addons: { include: { addon: true } } },
        });

        if (addons.length > 0) {
          await tx.subscriptionAddon.createMany({
            data: addons.map((a) => ({
              subscriptionId: created.id,
              addonId: a.id,
              amount: a.price,
              status: "active",
            })),
          });
        }

        return created;
      });
    }

    const fresh = await prisma.subscription.findUnique({
      where: { companyId },
      include: {
        plan: true,
        addons: { include: { addon: true }, where: { status: "active" } },
      },
    });

    res.status(existing ? 200 : 201).json({
      success: true,
      message: existing ? "Abonnement mis à jour" : "Abonnement créé",
      data: formatSubscription(fresh),
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// POST /api/admin/plan-builder/checkout
// Payer l'upgrade (Stripe ou Manuel)
// ═══════════════════════════════════════════════════════════
export const checkoutUpgrade = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const companyId = getCompanyId(req);

    const { paymentMethod, paymentMethodId } = req.body;

    const isStripe = paymentMethod === "stripe";
    const isManual = paymentMethod === "manual";

    if (!isStripe && !isManual) {
      return res.status(422).json({
        success: false,
        error: "paymentMethod invalide : 'stripe' | 'manual'",
      });
    }

    // Méthode manuelle
    let manualMethod = null;
    if (isManual) {
      if (!paymentMethodId) {
        return res.status(422).json({ success: false, error: "paymentMethodId requis" });
      }

      manualMethod = await prisma.manualPaymentMethod.findFirst({
        where: { id: parseInt(paymentMethodId), status: "Active" },
      });

      if (!manualMethod) {
        return res.status(422).json({ success: false, error: "Méthode manuelle invalide" });
      }
    }

    // Charger subscription
    const subscription = await prisma.subscription.findUnique({
      where: { companyId },
      include: {
        plan: true,
        addons: { include: { addon: true }, where: { status: "active" } },
      },
    });

    if (!subscription) {
      return res.status(404).json({ success: false, error: "Aucun abonnement" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const company = await prisma.company.findUnique({ where: { id: companyId } });

    const periods = calculatePeriodDates(subscription.interval, new Date());

    // ═══════════════════════════════════════════════════════════
    // STRIPE
    // ═══════════════════════════════════════════════════════════
    if (isStripe) {
      const stripe = await getStripe();

      // Customer
      let stripeCustomerId = subscription.stripeCustomerId;

      if (!stripeCustomerId) {
        const customer = await getOrCreateStripeCustomer(user, company);
        stripeCustomerId = customer.id;

        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { stripeCustomerId },
        });
      }

      // Vérifier carte
      const savedCard = await getDefaultPaymentMethod(stripeCustomerId);

      if (!savedCard) {
        const setupIntent = await createSetupIntent(stripeCustomerId);

        return res.json({
          success: true,
          requiresPaymentMethod: true,
          clientSecret: setupIntent.client_secret,
          message: "Veuillez enregistrer une carte",
        });
      }

      const orderNumber = await generateSubscriptionOrderNumber();

      // PaymentIntent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(subscription.totalAmount * 100),
        currency: "eur",
        customer: stripeCustomerId,
        payment_method: savedCard.id,
        automatic_payment_methods: { enabled: true },
        metadata: {
          type: "subscription_upgrade",
          companyId: String(companyId),
          userId: String(userId),
          subscriptionId: String(subscription.id),
          orderNumber,
        },
      });

      // Créer Order + BillingHistory (pending)
      await prisma.$transaction(async (tx) => {
        // Order
        await tx.order.create({
          data: {
            userId,
            companyId,
            orderNumber,
            status: "pending",
            subtotal: subscription.totalAmount,
            shippingCost: 0,
            total: subscription.totalAmount,
            currency: "EUR",
            exchangeRate: 1,
            methodPayment: "Stripe",
            stripePaymentIntentId: paymentIntent.id,
            stripeClientSecret: paymentIntent.client_secret,
          },
        });

        // BillingHistory
        await tx.billingHistory.create({
          data: {
            subscriptionId: subscription.id,
            baseAmount: subscription.baseAmount,
            addonsAmount: subscription.addonsAmount,
            totalAmount: subscription.totalAmount,
            periodStart: periods.currentPeriodStart,
            periodEnd: periods.currentPeriodEnd,
            status: "pending",
            stripePaymentIntentId: paymentIntent.id,
            paymentMethod: "Stripe",
          },
        });

        // Subscription → incomplete (en attente paiement)
        await tx.subscription.update({
          where: { id: subscription.id },
          data: { status: "incomplete" },
        });
      });

      return res.json({
        success: true,
        clientSecret: paymentIntent.client_secret,
        message: "Veuillez confirmer le paiement",
        data: {
          orderNumber,
          totalAmount: subscription.totalAmount,
          status: "pending",
        },
      });
    }

    // ═══════════════════════════════════════════════════════════
    // MANUEL
    // ═══════════════════════════════════════════════════════════
    if (isManual) {
      const orderNumber = await generateSubscriptionOrderNumber();

      const result = await prisma.$transaction(async (tx) => {
        // Order
        const order = await tx.order.create({
          data: {
            userId,
            companyId,
            orderNumber,
            status: "unpaid",
            subtotal: subscription.totalAmount,
            shippingCost: 0,
            total: subscription.totalAmount,
            currency: "EUR",
            exchangeRate: 1,
            methodPayment: manualMethod.name,
            manualPaymentMethodId: manualMethod.id,
          },
        });

        // BillingHistory
        const billingHistory = await tx.billingHistory.create({
          data: {
            subscriptionId: subscription.id,
            baseAmount: subscription.baseAmount,
            addonsAmount: subscription.addonsAmount,
            totalAmount: subscription.totalAmount,
            periodStart: periods.currentPeriodStart,
            periodEnd: periods.currentPeriodEnd,
            status: "pending",
            paymentMethod: manualMethod.name,
          },
        });

        // Invoice
        const invoice = await createSubscriptionInvoice({
          subscription,
          billingHistory,
          user,
          company,
          paymentMethod: manualMethod.name,
          orderId: order.id,
        });

        // Subscription → incomplete
        await tx.subscription.update({
          where: { id: subscription.id },
          data: { status: "incomplete" },
        });

        return { order, invoice };
      });

      // Email pending
      await sendSubscriptionPendingEmail(
        subscription,
        user,
        company,
        result.invoice,
        manualMethod
      );

      return res.json({
        success: true,
        message: `Commande ${result.order.orderNumber} créée. Facture ${result.invoice.invoiceNumber} en attente de paiement.`,
        data: {
          orderNumber: result.order.orderNumber,
          invoiceNumber: result.invoice.invoiceNumber,
          totalAmount: subscription.totalAmount,
          status: "unpaid",
          manualInstructions: manualMethod.instructions,
        },
      });
    }
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// PATCH /api/admin/plan-builder/addons
// ═══════════════════════════════════════════════════════════
export const updateAddons = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const { addonIds = [], extraLocations = 0 } = req.body;

    const sub = await prisma.subscription.findUnique({
      where: { companyId },
      include: { plan: true, addons: { include: { addon: true } } },
    });
    if (!sub) return res.status(404).json({ success: false, error: "Aucun abonnement" });

    if (sub.status === "canceled") {
      return res.status(409).json({ success: false, error: "Abonnement annulé" });
    }
    const parsedAddonIds = addonIds.map(Number);
    let addons = [];
    if (parsedAddonIds.length > 0) {
      addons = await prisma.addon.findMany({
        where: { id: { in: parsedAddonIds }, status: "active" },
      });
      if (addons.length !== parsedAddonIds.length) {
        return res.status(422).json({ success: false, error: "Addons invalides" });
      }
    }
    const amounts = computeAmounts({
      plan: sub.plan,
      addons,
      extraLocations,
      interval: sub.interval,
    });
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.subscriptionAddon.updateMany({
        where: { subscriptionId: sub.id },
        data: { status: "inactive", deactivatedAt: now },
      });

      for (const addon of addons) {
        await tx.subscriptionAddon.upsert({
          where: {
            subscriptionId_addonId: { subscriptionId: sub.id, addonId: addon.id },
          },
          update: {
            status: "active",
            amount: addon.price,
            activatedAt: now,
            deactivatedAt: null,
          },
          create: {
            subscriptionId: sub.id,
            addonId: addon.id,
            amount: addon.price,
            status: "active",
          },
        });
      }

      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          addonsAmount: amounts.addonsAmount,
          totalAmount: amounts.totalAmount,
          metadata: { ...(sub.metadata ?? {}), extraLocations },
        },
      });
    });

    const fresh = await prisma.subscription.findUnique({
      where: { companyId },
      include: {
        plan: true,
        addons: { include: { addon: true }, where: { status: "active" } },
      },
    });

    res.json({
      success: true,
      message: "Add-ons mis à jour",
      data: formatSubscription(fresh),
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// PATCH /api/admin/plan-builder/interval
// ═══════════════════════════════════════════════════════════
export const updateInterval = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const { interval } = req.body;

    if (!["monthly", "yearly"].includes(interval)) {
      return res.status(422).json({ success: false, error: "interval invalide" });
    }

    const sub = await prisma.subscription.findUnique({
      where: { companyId },
      include: {
        plan: true,
        addons: { include: { addon: true }, where: { status: "active" } },
      },
    });
    if (!sub) return res.status(404).json({ success: false, error: "Aucun abonnement" });

    if (sub.status === "canceled") {
      return res.status(409).json({ success: false, error: "Abonnement annulé" });
    }

    const activeAddons = sub.addons.map((sa) => sa.addon);
    const extraLocations = sub.metadata?.extraLocations ?? 0;
    const amounts = computeAmounts({ plan: sub.plan, addons: activeAddons, extraLocations, interval });

    const now = new Date();
    const periodEnd = new Date(now);
    interval === "yearly"
      ? periodEnd.setFullYear(periodEnd.getFullYear() + 1)
      : periodEnd.setMonth(periodEnd.getMonth() + 1);

    const factor = intervalFactor(interval);
    await prisma.$transaction(async (tx) => {
      for (const sa of sub.addons) {
        await tx.subscriptionAddon.update({
          where: { id: sa.id },
          data: { amount: Math.round(sa.addon.price * factor * 100) / 100 },
        });
      }

      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          interval,
          baseAmount: amounts.baseAmount,
          addonsAmount: amounts.addonsAmount,
          totalAmount: amounts.totalAmount,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          nextBillingDate: periodEnd,
        },
      });
    });

    const fresh = await prisma.subscription.findUnique({
      where: { companyId },
      include: {
        plan: true,
        addons: { include: { addon: true }, where: { status: "active" } },
      },
    });

    res.json({
      success: true,
      message: `Facturation ${interval === "yearly" ? "annuelle" : "mensuelle"}`,
      data: formatSubscription(fresh),
    });
  } catch (e) {
    next(e);
  }
};