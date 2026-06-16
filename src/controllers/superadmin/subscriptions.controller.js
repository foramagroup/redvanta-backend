// ═══════════════════════════════════════════════════════════
// src/controllers/superadmin/subscriptions.controller.js
// Gestion des abonnements côté superadmin
// ═══════════════════════════════════════════════════════════

import prisma from "../../config/database.js";
import {
  sendSubscriptionWelcomeEmail,
  formatSubscription,
} from "../../services/stripeSubscription.service.js";
import { sendTemplatedMail } from "../../services/client/mail.service.js";

// ═══════════════════════════════════════════════════════════
// GET /api/superadmin/subscriptions
// Liste toutes les subscriptions (avec filtres)
// ═══════════════════════════════════════════════════════════
export const listAllSubscriptions = async (req, res, next) => {
  try {
    const { status, companyId, planId, search, page = 1, limit = 200 } = req.query;

    const where = {};

    if (status) where.status = status;
    if (companyId) where.companyId = parseInt(companyId);
    if (planId) where.planId = parseInt(planId);
    if (search) {
      where.company = {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
        ],
      };
    }

    const [subscriptions, total, activeCount, mrrAgg, companiesCount] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: {
          plan: {
            include: {
              translations: { include: { language: { select: { code: true } } } },
            },
          },
          company: { select: { id: true, name: true, email: true } },
          addons: { include: { addon: true } },
          billingHistory: {
            where: { baseAmount: { gt: 0 } }, // Renouvellements plan uniquement (pas achats addon)
            include: { invoice: { select: { id: true, invoiceNumber: true, total: true, status: true } } },
            orderBy: { createdAt: "desc" },
            take: 3,
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.subscription.count({ where }),
      prisma.subscription.count({ where: { status: "active" } }),
      prisma.subscription.aggregate({
        where: { status: "active" },
        _sum: { totalAmount: true },
      }),
      prisma.subscription.findMany({
        where,
        select: { companyId: true },
        distinct: ["companyId"],
      }),
    ]);

    // Batch-fetch subscription plan invoices (fallback) — exclure les factures addon
    const companyIds = [...new Set(subscriptions.map((s) => s.companyId))];
    const recurringInvoices = companyIds.length
      ? await prisma.invoice.findMany({
          where: {
            companyId: { in: companyIds },
            isRecurring: true,
            OR: [{ reference: null }, { reference: { not: "addon" } }],
          },
          orderBy: { createdAt: "desc" },
          select: { id: true, invoiceNumber: true, total: true, status: true, companyId: true },
        })
      : [];

    // Map companyId → { latestAny, latestUnpaid }
    const invByCompany = {};
    for (const inv of recurringInvoices) {
      if (!invByCompany[inv.companyId]) invByCompany[inv.companyId] = { latestAny: null, latestUnpaid: null };
      const e = invByCompany[inv.companyId];
      if (!e.latestAny) e.latestAny = inv;
      if (!e.latestUnpaid && inv.status !== "paid") e.latestUnpaid = inv;
    }

    const lang = req.locale || "en";

    res.json({
      success: true,
      data: subscriptions.map((sub) => {
        const trs = sub.plan?.translations ?? [];
        const tr =
          trs.find((t) => t.language?.code === lang) ??
          trs.find((t) => t.language?.code === "en") ??
          trs[0];
        const planName = tr?.name ?? sub.plan?.name ?? sub.plan?.slug ?? null;

        // via billingHistory (linked invoiceId)
        const unpaidBh = (sub.billingHistory ?? []).find((bh) => bh.status !== "paid" && bh.invoice);
        const latestBh = (sub.billingHistory ?? []).find((bh) => bh.invoice);

        // fallback: recurring invoices by companyId
        const cInv = invByCompany[sub.companyId] ?? {};

        const rawUnpaid = unpaidBh?.invoice ?? cInv.latestUnpaid ?? null;
        const rawLatest = latestBh?.invoice ?? cInv.latestAny ?? null;

        const latestUnpaidInvoice = rawUnpaid
          ? { id: rawUnpaid.id, invoiceNumber: rawUnpaid.invoiceNumber, total: Number(rawUnpaid.total) }
          : null;
        const latestInvoice = rawLatest
          ? { id: rawLatest.id, invoiceNumber: rawLatest.invoiceNumber, total: Number(rawLatest.total), status: rawLatest.status }
          : null;

        return {
          ...formatSubscription(sub),
          planName,
          company: sub.company ?? null,
          addons: (sub.addons ?? []).map((a) => ({
            id: a.id,
            name: a.addon?.name ?? null,
            amount: Number(a.amount ?? 0),
            quantity: a.quantity ?? 1,
            status: a.status,
          })),
          latestUnpaidInvoice,
          latestInvoice,
        };
      }),
      stats: {
        total,
        active: activeCount,
        mrr: Number(mrrAgg._sum.totalAmount ?? 0),
        companies: companiesCount.length,
      },
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
        plan: { include: { translations: true } },
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

    const lang = req.locale || "en";
    const trs = subscription.plan?.translations ?? [];
    const tr = trs.find((t) => t.language?.code === lang) ?? trs.find((t) => t.language?.code === "en") ?? trs[0];
    const planName = tr?.name ?? subscription.plan?.name ?? subscription.plan?.slug ?? null;

    res.json({
      success: true,
      data: {
        ...formatSubscription(subscription),
        planName,
        company: {
          id: subscription.company.id,
          name: subscription.company.name,
          email: subscription.company.email,
        },
        addons: subscription.addons.map(a => ({
          id: a.id,
          name: a.addon?.name ?? null,
          description: a.addon?.description ?? null,
          amount: Number(a.amount ?? 0),
          quantity: a.quantity ?? 1,
          status: a.status,
        })),
        billingHistory: subscription.billingHistory.map(bh => ({
          id: bh.id,
          periodStart: bh.periodStart,
          periodEnd: bh.periodEnd,
          status: bh.status,
          baseAmount: Number(bh.baseAmount ?? 0),
          addonsAmount: Number(bh.addonsAmount ?? 0),
          totalAmount: Number(bh.totalAmount),
          paidAt: bh.paidAt,
          paymentMethod: bh.paymentMethod ?? null,
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

    const billingHistory = invoice.billingHistory[0];

    if (invoice.status === "paid") {
      // Si l'invoice est déjà payée mais le BillingHistory ne l'est pas
      // (désync possible si paiement fait via billing/page.js), on synchronise le BH.
      if (billingHistory && billingHistory.status !== "paid") {
        await prisma.billingHistory.update({
          where: { id: billingHistory.id },
          data:  { status: "paid", paidAt: new Date(), paymentMethod },
        });
        if (invoice.reference === "addon" && billingHistory.subscription) {
          await prisma.subscriptionAddon.updateMany({
            where: { subscriptionId: billingHistory.subscription.id, status: "inactive" },
            data:  { status: "active", activatedAt: new Date() },
          });
        }
        return res.json({
          success: true,
          message: req.t("superadmin.subscription.invoice_paid", { invoiceNumber: invoice.invoiceNumber }),
          data: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
        });
      }
      return res.status(422).json({
        success: false,
        error: req.t("superadmin.billing.already_paid"),
      });
    }

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
    // Si facture addon → activer les SubscriptionAddon en attente
    // ═══════════════════════════════════════════════════════════
    if (invoice.reference === "addon") {
      await prisma.subscriptionAddon.updateMany({
        where: { subscriptionId: subscription.id, status: "inactive" },
        data: { status: "active", activatedAt: new Date() },
      });
    }

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
              include: {
                plan: {
                  include: {
                    translations: { include: { language: { select: { code: true } } } },
                  },
                },
              },
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
              planName: (() => {
                const plan = inv.billingHistory[0].subscription.plan;
                if (!plan) return null;
                const lang = req.locale || "en";
                const trs = plan.translations ?? [];
                const tr = trs.find(t => t.language?.code === lang)
                  ?? trs.find(t => t.language?.code === "en")
                  ?? trs[0];
                return tr?.name ?? plan.slug;
              })(),
              status: inv.billingHistory[0].subscription.status,
            }
          : null,
      })),
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// POST /api/superadmin/subscription/:id/cancel
// ═══════════════════════════════════════════════════════════
export const cancelSubscription = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body;
    const sub = await prisma.subscription.findUnique({ where: { id } });
    if (!sub) return res.status(404).json({ success: false, error: req.t("superadmin.subscription.not_found") });
    if (sub.status === "canceled") return res.status(422).json({ success: false, error: "Subscription is already canceled." });
    await prisma.subscription.update({
      where: { id },
      data: { status: "canceled", canceledAt: new Date(), ...(reason ? { cancelReason: reason } : {}) },
    });
    res.json({ success: true, message: `Subscription #${id} has been canceled.` });
  } catch (e) { next(e); }
};

// ═══════════════════════════════════════════════════════════
// POST /api/superadmin/subscription/:id/activate
// ═══════════════════════════════════════════════════════════
export const activateSubscription = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const sub = await prisma.subscription.findUnique({ where: { id } });
    if (!sub) return res.status(404).json({ success: false, error: req.t("superadmin.subscription.not_found") });
    await prisma.subscription.update({ where: { id }, data: { status: "active" } });
    res.json({ success: true, message: `Subscription #${id} activated.` });
  } catch (e) { next(e); }
};

// ═══════════════════════════════════════════════════════════
// POST /api/superadmin/subscription/:id/pause
// ═══════════════════════════════════════════════════════════
export const pauseSubscription = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const sub = await prisma.subscription.findUnique({ where: { id } });
    if (!sub) return res.status(404).json({ success: false, error: req.t("superadmin.subscription.not_found") });
    await prisma.subscription.update({ where: { id }, data: { status: "paused" } });
    res.json({ success: true, message: `Subscription #${id} paused.` });
  } catch (e) { next(e); }
};

// ═══════════════════════════════════════════════════════════
// GET /api/superadmin/subscription/addon-billing
// Liste tous les achats d'addons (BillingHistory baseAmount=0)
// ═══════════════════════════════════════════════════════════
export const listAllAddonBilling = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 200, status } = req.query;

    const where = {
      baseAmount: 0,
      addonsAmount: { gt: 0 },
    };

    if (status) where.status = status;
    if (search) {
      where.subscription = {
        company: {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
          ],
        },
      };
    }

    const [histories, total, paidCount, totalRevenue] = await Promise.all([
      prisma.billingHistory.findMany({
        where,
        include: {
          subscription: {
            include: {
              company: { select: { id: true, name: true, email: true } },
              addons: { include: { addon: true } },
            },
          },
          invoice: {
            include: {
              items: true,
              company: { include: { settings: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.billingHistory.count({ where }),
      prisma.billingHistory.count({ where: { ...where, status: "paid" } }),
      prisma.billingHistory.aggregate({
        where: { ...where, status: "paid" },
        _sum: { addonsAmount: true },
      }),
    ]);

    res.json({
      success: true,
      data: histories.map((bh) => ({
        id: bh.id,
        company: bh.subscription?.company ?? null,
        subscriptionId: bh.subscriptionId,
        amount: Number(bh.addonsAmount ?? 0),
        status: bh.status,
        periodStart: bh.periodStart,
        periodEnd: bh.periodEnd,
        paidAt: bh.paidAt,
        paymentMethod: bh.paymentMethod,
        createdAt: bh.createdAt,
        subscriptionAddons: (bh.subscription?.addons ?? [])
          .filter((a) => a.status === "active")
          .map((a) => ({
            name: a.addon?.name ?? "Add-on",
            quantity: Number(a.quantity ?? 1),
            amount: Number(a.amount ?? 0),
          })),
        invoice: bh.invoice
          ? {
              id: bh.invoice.id,
              invoiceNumber: bh.invoice.invoiceNumber,
              status: bh.invoice.status,
              total: Number(bh.invoice.total),
              currency: bh.invoice.company?.settings?.currency || bh.invoice.currency || "EUR",
              billingName: bh.invoice.billingName,
              billingEmail: bh.invoice.billingEmail,
              billingPhone: bh.invoice.billingPhone,
              billingAddress: bh.invoice.billingAddress,
              invoiceDate: bh.invoice.invoiceDate,
              dueDate: bh.invoice.dueDate,
              paymentMethod: bh.invoice.paymentMethod,
              emailStatus: bh.invoice.emailStatus ?? "Not Sent",
              items: (bh.invoice.items ?? []).map((i) => ({
                service: i.service,
                description: i.description,
                quantity: Number(i.quantity),
                unit: i.unit,
                unitPrice: Number(i.unitPrice),
                total: Number(i.total),
              })),
            }
          : null,
      })),
      stats: {
        total,
        paid: paidCount,
        pending: total - paidCount,
        revenue: Number(totalRevenue._sum.addonsAmount ?? 0),
      },
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
// POST /api/superadmin/subscription/:id/send-invoice
// Envoie la dernière facture impayée de l'abonnement par email
// ═══════════════════════════════════════════════════════════
export const sendSubscriptionInvoiceEmail = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { to } = req.body;

    const billingHistory = await prisma.billingHistory.findFirst({
      where: {
        subscriptionId: id,
        status: { not: "paid" },
        invoiceId: { not: null },
      },
      include: {
        invoice: { include: { items: true, company: true, user: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!billingHistory?.invoice) {
      return res.status(404).json({ success: false, error: "No pending invoice found for this subscription." });
    }

    const inv = billingHistory.invoice;
    const recipientEmail = (to || "").trim() || inv.billingEmail || inv.user?.email;
    if (!recipientEmail) return res.status(422).json({ success: false, error: "No recipient email available." });

    const currency = inv.currency || "EUR";
    const total = Number(inv.displayTotal ?? inv.total ?? 0);

    const vars = {
      invoice_number: inv.invoiceNumber,
      company_name:   inv.company?.name ?? inv.billingName ?? "Client",
      billing_name:   inv.billingName   ?? inv.company?.name ?? "Client",
      billing_email:  recipientEmail,
      invoice_date:   inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString("fr-FR") : "-",
      due_date:       inv.dueDate     ? new Date(inv.dueDate).toLocaleDateString("fr-FR")     : "-",
      total:          total.toFixed(2),
      currency,
      status:         inv.status,
      year:           String(new Date().getFullYear()),
      items_html:     (inv.items ?? []).map((i) =>
        `<tr>
          <td style="padding:6px 8px;border-bottom:1px solid #eee">${i.service}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${Number(i.unitPrice).toFixed(2)} ${currency}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${Number(i.total).toFixed(2)} ${currency}</td>
        </tr>`
      ).join(""),
    };

    const buildFallback = () => ({
      subject: `Invoice ${inv.invoiceNumber} — ${vars.company_name}`,
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
        body{font-family:sans-serif;color:#222;margin:0;padding:0;background:#f6f6f6}
        .wrap{max-width:600px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
        .header{background:#e11d48;padding:28px 32px;color:#fff}.header h1{margin:0;font-size:22px}.header p{margin:4px 0 0;font-size:13px;opacity:.85}
        .body{padding:28px 32px}table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14px}
        th{background:#f1f5f9;padding:8px;text-align:left;font-size:13px}th:last-child,td:last-child{text-align:right}
        .total-row td{padding:10px 8px;font-weight:700;border-top:2px solid #e11d48;font-size:15px}
        .footer{padding:16px 32px;background:#f9f9f9;font-size:12px;color:#888;text-align:center}
      </style></head><body><div class="wrap">
        <div class="header"><h1>Invoice ${inv.invoiceNumber}</h1>
          <p>Date: ${vars.invoice_date}${vars.due_date !== "-" ? ` &nbsp;·&nbsp; Due: ${vars.due_date}` : ""}</p></div>
        <div class="body">
          <p>Hello <strong>${vars.billing_name}</strong>,</p>
          <p>Please find your subscription invoice details below.</p>
          <table><thead><tr><th>Service</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit price</th><th style="text-align:right">Total</th></tr></thead>
            <tbody>${vars.items_html}</tbody>
            <tfoot><tr class="total-row"><td colspan="3">Total</td><td>${vars.total} ${vars.currency}</td></tr></tfoot>
          </table>
          <p style="font-size:13px;color:#555">Status: <strong>${vars.status}</strong></p>
          <p>Thank you for your business.</p>
        </div>
        <div class="footer">&copy; ${vars.year} ${vars.company_name}. All rights reserved.</div>
      </div></body></html>`,
      text: `Invoice ${inv.invoiceNumber}\nDate: ${vars.invoice_date}\nTotal: ${vars.total} ${vars.currency}\nStatus: ${vars.status}`,
    });

    let emailStatus = "Sent";
    let emailSentAt = new Date();
    let emailError  = null;

    try {
      await sendTemplatedMail({
        slug:       "invoice_email",
        to:         recipientEmail,
        variables:  vars,
        fallbackFn: buildFallback,
      });
    } catch (err) {
      emailStatus = "Failed";
      emailError  = err.message?.slice(0, 495) ?? "Send failed";
    }

    await prisma.invoice.update({
      where: { id: inv.id },
      data:  { emailStatus, emailSentAt, emailError, ...(to?.trim() && { billingEmail: to.trim() }) },
    });

    res.json({
      success: emailStatus === "Sent",
      message: emailStatus === "Sent"
        ? `Invoice ${inv.invoiceNumber} sent to ${recipientEmail}.`
        : `Email delivery failed: ${emailError}`,
      invoiceNumber: inv.invoiceNumber,
      emailStatus,
    });
  } catch (e) { next(e); }
};