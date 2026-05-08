// ═══════════════════════════════════════════════════════════
// src/controllers/superadmin/subscriptions.controller.js
// Gestion des abonnements côté superadmin
// ═══════════════════════════════════════════════════════════

import prisma from "../../config/database.js";
import {
  sendSubscriptionWelcomeEmail,
  formatSubscription,
} from "../../services/stripeSubscription.service.js";

// ═══════════════════════════════════════════════════════════
// GET /api/superadmin/subscriptions
// Liste toutes les subscriptions (avec filtres)
// ═══════════════════════════════════════════════════════════
export const listAllSubscriptions = async (req, res, next) => {
  try {
    const { status, companyId, planId, page = 1, limit = 50 } = req.query;

    const where = {};

    if (status) {
      where.status = status;
    }

    if (companyId) {
      where.companyId = parseInt(companyId);
    }

    if (planId) {
      where.planId = parseInt(planId);
    }

    const subscriptions = await prisma.subscription.findMany({
      where,
      include: {
        plan: true,
        company: { select: { id: true, name: true, email: true } },
        addons: { include: { addon: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    });

    const total = await prisma.subscription.count({ where });

    res.json({
      success: true,
      data: subscriptions.map(formatSubscription),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// GET /api/superadmin/subscriptions/:id
// Détails d'un abonnement
// ═══════════════════════════════════════════════════════════
export const getSubscriptionDetails = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        plan: true,
        company: true,
        addons: { include: { addon: true } },
        billingHistory: {
          include: { invoice: true },
          orderBy: { createdAt: "desc" },
        },
        usageRecords: {
          orderBy: { recordedAt: "desc" },
          take: 100,
        },
      },
    });

    if (!subscription) {
      return res.status(404).json({ success: false, error: req.t("superadmin.subscription.not_found") });
    }

    res.json({
      success: true,
      data: {
        ...formatSubscription(subscription),
        company: {
          id: subscription.company.id,
          name: subscription.company.name,
          email: subscription.company.email,
        },
        billingHistory: subscription.billingHistory.map(bh => ({
          id: bh.id,
          periodStart: bh.periodStart,
          periodEnd: bh.periodEnd,
          status: bh.status,
          totalAmount: Number(bh.totalAmount),
          paidAt: bh.paidAt,
          invoice: bh.invoice ? {
            id: bh.invoice.id,
            invoiceNumber: bh.invoice.invoiceNumber,
            status: bh.invoice.status,
          } : null,
        })),
        usageRecords: subscription.usageRecords.map(ur => ({
          id: ur.id,
          type: ur.type,
          quantity: ur.quantity,
          recordedAt: ur.recordedAt,
          metadata: ur.metadata,
        })),
      },
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// POST /api/superadmin/subscriptions/invoices/:invoiceId/mark-paid
// Marquer facture abonnement comme payée (paiement manuel)
// IDENTIQUE au workflow webhook Stripe
// ═══════════════════════════════════════════════════════════
export const markSubscriptionInvoicePaid = async (req, res, next) => {
  try {
    const invoiceId = parseInt(req.params.invoiceId);
    const {
      paidAmount,
      paymentMethod = "Manual Payment",
      transactionId = null,
      notes = null,
    } = req.body;

    // Charger facture + BillingHistory + Subscription + Order
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        order: true,
        billingHistory: {
          include: {
            subscription: {
              include: {
                plan: true,
                company: true,
                addons: { include: { addon: true } },
              },
            },
          },
        },
        company: true,
      },
    });

    if (!invoice) {
      return res.status(404).json({ success: false, error: req.t("superadmin.billing.invoice_not_found") });
    }

    if (!invoice.isRecurring) {
      return res.status(422).json({
        success: false,
        error: req.t("superadmin.subscription.not_subscription_invoice"),
      });
    }

    if (invoice.status === "paid") {
      return res.status(422).json({
        success: false,
        error: req.t("superadmin.billing.already_paid"),
      });
    }

    const billingHistory = invoice.billingHistory[0];

    if (!billingHistory) {
      return res.status(422).json({
        success: false,
        error: req.t("superadmin.subscription.billing_not_found"),
      });
    }

    const subscription = billingHistory.subscription;

    if (!subscription) {
      return res.status(422).json({
        success: false,
        error: req.t("superadmin.subscription.not_found"),
      });
    }

    const order = invoice.order;

    if (!order) {
      return res.status(422).json({
        success: false,
        error: req.t("superadmin.subscription.order_not_found"),
      });
    }

    const amountToPay = paidAmount ? Number(paidAmount) : Number(invoice.total);

    // ═══════════════════════════════════════════════════════════
    // TRANSACTION : IDENTIQUE WEBHOOK STRIPE
    // ═══════════════════════════════════════════════════════════
    await prisma.$transaction([
      // 1. Order → paid
      prisma.order.update({
        where: { id: order.id },
        data: {
          status: "paid",
          paidAt: new Date(),
        },
      }),

      // 2. BillingHistory → paid
      prisma.billingHistory.update({
        where: { id: billingHistory.id },
        data: {
          status: "paid",
          paidAt: new Date(),
          paymentMethod,
        },
      }),

      // 3. Invoice → paid
      prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "paid",
          paidAt: new Date(),
          paidAmount: amountToPay,
          paymentMethod,
        },
      }),

      // 4. Subscription → active
      prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "active" },
      }),

      // 5. Payment record
      prisma.payment.create({
        data: {
          orderId: order.id,
          invoiceId: invoice.id,
          companyId: invoice.companyId,
          userId: invoice.userId,
          amount: amountToPay,
          currency: invoice.currency || "EUR",
          exchangeRate: Number(invoice.exchangeRate || 1),
          displayAmount: invoice.displayTotal
            ? Number(invoice.displayTotal)
            : amountToPay,
          method: "manual",
          methodLabel: paymentMethod,
          transactionId,
          status: "completed",
          notes,
          paidAt: new Date(),
        },
      }),
    ]);

    // ═══════════════════════════════════════════════════════════
    // Email Welcome (identique webhook)
    // ═══════════════════════════════════════════════════════════
    const user = await prisma.user.findFirst({
      where: { companyId: subscription.companyId, isAdmin: true },
    });

    const updatedInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
    });

    sendSubscriptionWelcomeEmail(subscription, user, subscription.company, updatedInvoice).catch(
      console.error
    );

    console.log(
      `[Superadmin] ✅ Facture ${invoice.invoiceNumber} marquée payée - Order ${order.orderNumber} paid - Subscription ${subscription.id} activée`
    );

    res.json({
      success: true,
      message: req.t("superadmin.subscription.invoice_paid", { invoiceNumber: invoice.invoiceNumber }),
      data: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        orderId: order.id,
        orderNumber: order.orderNumber,
        paidAmount: amountToPay,
        subscriptionId: subscription.id,
        subscriptionStatus: "active",
      },
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// PUT /api/superadmin/subscriptions/:id/status
// Changer le statut d'un abonnement
// ═══════════════════════════════════════════════════════════
export const updateSubscriptionStatus = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { status, reason } = req.body;

    const validStatuses = ["active", "trialing", "past_due", "canceled", "incomplete", "paused"];

    if (!validStatuses.includes(status)) {
      return res.status(422).json({
        success: false,
        error: `Status invalide. Valeurs possibles: ${validStatuses.join(", ")}`,
      });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      return res.status(404).json({ success: false, error: req.t("superadmin.subscription.not_found") });
    }

    const updateData = { status };

    if (status === "canceled") {
      updateData.canceledAt = new Date();
      if (reason) {
        updateData.cancelReason = reason;
      }
    }

    await prisma.subscription.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      message: req.t("superadmin.subscription.status_updated", { id, status }),
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// GET /api/superadmin/subscriptions/invoices/pending
// Liste factures d'abonnement en attente de paiement
// ═══════════════════════════════════════════════════════════
export const getPendingSubscriptionInvoices = async (req, res, next) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: {
        isRecurring: true,
        status: "unpaid",
      },
      include: {
        order: true,
        company: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
        billingHistory: {
          include: {
            subscription: {
              include: { plan: true },
            },
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    res.json({
      success: true,
      data: invoices.map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        orderId: inv.order?.id,
        orderNumber: inv.order?.orderNumber,
        total: Number(inv.total),
        currency: inv.currency,
        status: inv.status,
        dueDate: inv.dueDate,
        invoiceDate: inv.invoiceDate,
        company: {
          id: inv.company.id,
          name: inv.company.name,
        },
        user: {
          id: inv.user.id,
          name: inv.user.name,
          email: inv.user.email,
        },
        subscription: inv.billingHistory[0]?.subscription
          ? {
              id: inv.billingHistory[0].subscription.id,
              planName: inv.billingHistory[0].subscription.plan.name,
              status: inv.billingHistory[0].subscription.status,
            }
          : null,
      })),
    });
  } catch (e) {
    next(e);
  }
};