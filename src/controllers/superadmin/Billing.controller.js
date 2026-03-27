

import prisma   from "../../config/database.js";
import { getStripe }  from "../../services/Stripe.service.js";
import {
  generateInvoiceNumber,
  formatInvoice,
} from "../../services/Invoice.service.js";

// ─── GET /api/superadmin/billing/stats ───────────────────────
// Métriques MRR, ARR, churn, etc.
export const getStats = async (req, res, next) => {
  try {
    const now       = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [totalPaidThisMonth, totalPaidLastMonth, failedCount, pendingCount, overdueCount] =
      await Promise.all([
        prisma.invoice.aggregate({
          where: { status: "paid", invoiceDate: { gte: thisMonth } },
          _sum: { total: true },
        }),
        prisma.invoice.aggregate({
          where: { status: "paid", invoiceDate: { gte: lastMonth, lt: thisMonth } },
          _sum: { total: true },
        }),
        prisma.invoice.count({ where: { status: { in: ["failed"] } } }),
        prisma.invoice.count({ where: { status: "sent" } }),
        prisma.invoice.count({ where: { status: "overdue" } }),
      ]);

    // MRR = total factures récurrentes payées ce mois
    const mrrResult = await prisma.invoice.aggregate({
      where: { status: "paid", isRecurring: true, invoiceDate: { gte: thisMonth } },
      _sum: { total: true },
    });

    const mrr  = Number(mrrResult._sum.total ?? 0);
    const arr  = mrr * 12;
    const prevMrr = Number(totalPaidLastMonth._sum.total ?? 0);
    const expansion = Math.max(0, mrr - prevMrr);

    // Churn simplifié : companies sans facture payée ce mois / total companies actives
    const [activeCompanies, billedThisMonth] = await Promise.all([
      prisma.company.count({ where: { status: "active" } }),
      prisma.invoice.groupBy({
        by: ["companyId"],
        where: { status: "paid", invoiceDate: { gte: thisMonth } },
      }),
    ]);
    const churnRate = activeCompanies > 0
      ? (((activeCompanies - billedThisMonth.length) / activeCompanies) * 100).toFixed(1)
      : "0.0";

    res.json({
      success: true,
      data: {
        mrr:         `€${mrr.toFixed(2)}`,
        arr:         `€${arr.toFixed(2)}`,
        expansion:   `€${expansion.toFixed(2)}`,
        churnRate:   `${churnRate}%`,
        failedCount,
        pendingCount,
        overdueCount,
      },
    });
  } catch (e) { next(e); }
};

// ─── GET /api/superadmin/billing/invoices ─────────────────────
// Liste avec filtres + pagination
export const listInvoices = async (req, res, next) => {
  try {
    const page    = Math.max(1, parseInt(req.query.page)  || 1);
    const limit   = Math.min(100, parseInt(req.query.limit) || 10);
    const skip    = (page - 1) * limit;
    const search  = req.query.search?.trim() || "";
    const status  = req.query.status || undefined;
    const from    = req.query.from || undefined;
    const to      = req.query.to   || undefined;

    const where = {
      ...(status && { status }),
      ...(from   && { invoiceDate: { gte: new Date(from) } }),
      ...(to     && { invoiceDate: { lte: new Date(to + "T23:59:59") } }),
      ...(search && {
        OR: [
          { invoiceNumber: { contains: search } },
          { company: { name: { contains: search } } },
          { billingEmail: { contains: search } },
        ],
      }),
    };

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: { items: true, company: true, refunds: true },
        orderBy: { invoiceDate: "desc" },
        skip, take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({
      success: true,
      data:    invoices.map(formatInvoice),
      meta:    { total, page, last_page: Math.ceil(total / limit) },
    });
  } catch (e) { next(e); }
};



export const getInvoice = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const inv = await prisma.invoice.findUnique({
      where:   { id },
      include: { items: true, company: true, refunds: true },
    });
    if (!inv) return res.status(404).json({ success: false, error: "Facture introuvable" });
    res.json({ success: true, data: formatInvoice(inv) });
  } catch (e) { next(e); }
};

// ─── POST /api/superadmin/billing/invoices ────────────────────
// Créer une facture manuelle (depuis la vue BillingRevenue)
export const createInvoice = async (req, res, next) => {
  try {
    const {
      companyId, userId,
      status = "draft",
      currency = "EUR", exchangeRate = 1,
      billingName, billingEmail, billingPhone, billingAddress, billingVat,
      notes, terms, reference,
      dueDate, isRecurring = false, recurringInterval, nextBillingDate,
      items = [],
    } = req.body;

    if (!companyId || !userId) {
      return res.status(422).json({ success: false, error: "companyId et userId requis" });
    }

    // Calculer les totaux depuis les lignes
    const subtotal  = items.reduce((s, i) => s + (i.qty * i.price - (i.discount ?? 0)), 0);
    const taxAmount = items.reduce((s, i) => {
      const itemSubtotal = i.qty * i.price - (i.discount ?? 0);
      return s + itemSubtotal * ((i.taxRate ?? 0) / 100);
    }, 0);
    const total = subtotal + taxAmount;
    const displayTotal = Math.round(total * (parseFloat(exchangeRate) || 1) * 100) / 100;

    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        companyId: parseInt(companyId),
        userId:    parseInt(userId),
        status,
        subtotal, taxAmount, shippingCost: 0, total,
        currency, exchangeRate: parseFloat(exchangeRate) || 1, displayTotal,
        billingName, billingEmail, billingPhone, billingAddress, billingVat,
        notes, terms, reference,
        dueDate:           dueDate           ? new Date(dueDate)           : null,
        nextBillingDate:   nextBillingDate   ? new Date(nextBillingDate)   : null,
        isRecurring,
        recurringInterval: isRecurring ? recurringInterval : null,
        items: {
          create: items.map((i) => {
            const itemSubtotal = i.qty * i.price - (i.discount ?? 0);
            const itemTax      = itemSubtotal * ((i.taxRate ?? 0) / 100);
            return {
              service:     i.service,
              description: i.description ?? null,
              quantity:    i.qty,
              unit:        i.unit ?? "pcs",
              unitPrice:   i.price,
              discount:    i.discount ?? 0,
              taxRate:     i.taxRate ?? 0,
              taxAmount:   itemTax,
              subtotal:    itemSubtotal,
              total:       itemSubtotal + itemTax,
            };
          }),
        },
      },
      include: { items: true },
    });

    res.status(201).json({ success: true, data: formatInvoice(invoice) });
  } catch (e) { next(e); }
};

// ─── PUT /api/superadmin/billing/invoices/:id ─────────────────
export const updateInvoice = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { status, dueDate, notes, terms, billingVat, reference } = req.body;

    const inv = await prisma.invoice.findUnique({ where: { id } });
    if (!inv) return res.status(404).json({ success: false, error: "Facture introuvable" });

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        ...(status    && { status }),
        ...(dueDate   && { dueDate: new Date(dueDate) }),
        ...(notes     !== undefined && { notes }),
        ...(terms     !== undefined && { terms }),
        ...(billingVat !== undefined && { billingVat }),
        ...(reference !== undefined && { reference }),
      },
      include: { items: true },
    });

    res.json({ success: true, data: formatInvoice(updated) });
  } catch (e) { next(e); }
};

// ─── POST /api/superadmin/billing/invoices/:id/refund ─────────
export const refundInvoice = async (req, res, next) => {
  try {
    const id     = parseInt(req.params.id);
    const amount = req.body.amount  ? parseFloat(req.body.amount) : null;
    const reason = req.body.reason  || null;

    const inv = await prisma.invoice.findUnique({
      where:   { id },
      include: { order: true },
    });
    if (!inv) return res.status(404).json({ success: false, error: "Facture introuvable" });
    if (inv.status !== "paid") {
      return res.status(422).json({ success: false, error: "Seules les factures payées peuvent être remboursées" });
    }

    let stripeRefundId = null;

    // Si lié à Stripe, procéder au remboursement
    if (inv.stripePaymentIntentId) {
      const stripe  = await getStripe();
      const charges = await stripe.charges.list({ payment_intent: inv.stripePaymentIntentId, limit: 1 });

      if (charges.data.length) {
        const refund = await stripe.refunds.create({
          charge: charges.data[0].id,
          ...(amount && { amount: Math.round(amount * 100) }),
        });
        stripeRefundId = refund.id;
      }
    }

    // Mettre à jour la facture et créer l'entrée refund
    await prisma.$transaction([
      prisma.invoice.update({
        where: { id },
        data:  { status: "refunded" },
      }),
      prisma.refund.create({
        data: {
          invoiceId:    id,
          amount:       amount ?? Number(inv.total),
          reason,
          stripeRefundId,
        },
      }),
      ...(inv.orderId ? [
        prisma.order.update({ where: { id: inv.orderId }, data: { status: "refunded" } }),
      ] : []),
    ]);

    res.json({ success: true, message: "Remboursement effectué", stripeRefundId });
  } catch (e) { next(e); }
};

// ─── POST /api/superadmin/billing/payments ────────────────────
// Enregistrer un paiement manuel (virement, chèque, etc.)
export const addManualPayment = async (req, res, next) => {
  try {
    const { invoiceId, amount, method, transactionId, paymentDate, notes } = req.body;

    if (!invoiceId || !amount) {
      return res.status(422).json({ success: false, error: "invoiceId et amount requis" });
    }

    const inv = await prisma.invoice.findUnique({ where: { id: parseInt(invoiceId) } });
    if (!inv) return res.status(404).json({ success: false, error: "Facture introuvable" });

    const updated = await prisma.invoice.update({
      where: { id: parseInt(invoiceId) },
      data: {
        status:        "paid",
        paymentMethod: method || "Manuel",
        paidAt:        paymentDate ? new Date(paymentDate) : new Date(),
      },
    });

    res.json({ success: true, message: "Paiement enregistré", data: formatInvoice(updated) });
  } catch (e) { next(e); }
};

// ─── GET /api/superadmin/billing/payments ─────────────────────
// Liste des paiements (commandes payées + méthode)
export const listPayments = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where:   { status: "paid" },
        include: { company: true },
        orderBy: { paidAt: "desc" },
        skip, take: limit,
      }),
      prisma.invoice.count({ where: { status: "paid" } }),
    ]);

    const payments = invoices.map((inv) => ({
      id:            `PAY-${String(inv.id).padStart(3, "0")}`,
      invoiceNumber: inv.invoiceNumber,
      account:       inv.company?.name ?? "-",
      amount:        `€${Number(inv.total).toFixed(2)}`,
      displayAmount: inv.displayTotal ? `${inv.currency} ${Number(inv.displayTotal).toFixed(2)}` : null,
      method:        inv.paymentMethod ?? "Stripe",
      date:          inv.paidAt?.toISOString().split("T")[0] ?? "-",
      status:        "Completed",
      txId:          inv.stripePaymentIntentId ?? "-",
    }));

    res.json({ success: true, data: payments, meta: { total, page, last_page: Math.ceil(total / limit) } });
  } catch (e) { next(e); }
};

// ─── POST /api/superadmin/billing/invoices/retry ─────────────
// Réessayer un paiement échoué via Stripe
export const retryPayment = async (req, res, next) => {
  try {
    const { invoiceId } = req.body;
    const inv = await prisma.invoice.findUnique({
      where:   { id: parseInt(invoiceId) },
      include: { order: true },
    });
    if (!inv) return res.status(404).json({ success: false, error: "Facture introuvable" });
    if (!inv.stripePaymentIntentId) {
      return res.status(422).json({ success: false, error: "Pas de PaymentIntent Stripe associé" });
    }

    const stripe = await getStripe();
    const pi     = await stripe.paymentIntents.confirm(inv.stripePaymentIntentId);

    res.json({ success: true, status: pi.status, message: `PaymentIntent: ${pi.status}` });
  } catch (e) { next(e); }
};