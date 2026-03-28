

import prisma   from "../../config/database.js";
import { getStripe }  from "../../services/Stripe.service.js";
import {
  generateInvoiceNumber,
  formatInvoice,
} from "../../services/Invoice.service.js";

function formatPayment(p) {
  return {
    id:            `PAY-${String(p.id).padStart(3, "0")}`,
    rawId:         p.id,
    invoiceNumber: p.invoice?.invoiceNumber ?? null,
    invoiceId:     p.invoiceId,
    orderId:       p.orderId,
    orderNumber:   p.order?.orderNumber     ?? null,
    account:       p.company?.name          ?? "-",
    companyId:     p.companyId,
    amount:        `€${Number(p.amount).toFixed(2)}`,
    amountRaw:     Number(p.amount),
    displayAmount: p.displayAmount ? `${p.currency} ${Number(p.displayAmount).toFixed(2)}` : null,
    currency:      p.currency,
    method:        p.methodLabel ?? p.method,
    methodType:    p.method,
    last4:         p.last4,
    brand:         p.brand,
    date:          p.paidAt?.toISOString().split("T")[0] ?? "-",
    status:        p.status === "completed" ? "Completed" : p.status,
    txId:          p.stripePaymentIntentId ?? p.transactionId ?? "-",
    notes:         p.notes,
  };
}
 
// ─── GET /api/superadmin/billing/stats ───────────────────────
export const getStats = async (req, res, next) => {
  try {
    const now       = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalPaidThisMonth,
      totalPaidLastMonth,
      failedCount,
      pendingCount,
      overdueCount,
      mrrResult,
    ] = await Promise.all([
      prisma.invoice.aggregate({
        where: { status: "paid", invoiceDate: { gte: thisMonth } },
        _sum: { total: true },
      }),
      prisma.invoice.aggregate({
        where: { status: "paid", invoiceDate: { gte: lastMonth, lt: thisMonth } },
        _sum: { total: true },
      }),
      prisma.invoice.count({ where: { status: "failed" } }), 
      prisma.invoice.count({ where: { status: "sent" } }),
      prisma.invoice.count({ where: { status: "overdue" } }),
      prisma.invoice.aggregate({
        where: { status: "paid", isRecurring: true, invoiceDate: { gte: thisMonth } },
        _sum: { total: true },
      }),
    ]);

    const mrr       = Number(mrrResult._sum?.total || 0);
    const arr       = mrr * 12;
    const current   = Number(totalPaidThisMonth._sum?.total || 0);
    const prevMrr   = Number(totalPaidLastMonth._sum?.total || 0);
    const expansion = Math.max(0, current - prevMrr);

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
  } catch (e) { 
    next(e); 
  }
};
 
// ─── GET /api/superadmin/billing/invoices ─────────────────────

export const listInvoices = async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 10);
    const skip   = (page - 1) * limit;
    
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : "";
    const status = req.query.status || undefined;
    const from   = req.query.from   || undefined;
    const to     = req.query.to     || undefined;

    const where = {
      ...(status && { status }),
      ...(from   && { invoiceDate: { gte: new Date(from) } }),
      ...(to     && { invoiceDate: { lte: new Date(to + "T23:59:59") } }),
      ...(search && {
        OR: [
          { invoiceNumber: { contains: search } },
          { company:       { name: { contains: search } } },
          { billingEmail:  { contains: search } },
        ],
      }),
    };

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: { items: true, company: true, refunds: true, payments: true },
        orderBy: { invoiceDate: "desc" },
        skip, 
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({
      success: true,
      data:    invoices.map(formatInvoice),
      meta:    { 
        total, 
        page, 
        last_page: Math.ceil(total / limit) 
      },
    });
  } catch (e) { 
    next(e); 
  }
};
 
// ─── GET /api/superadmin/billing/invoices/:id ─────────────────
export const getInvoice = async (req, res, next) => {
  try {
    const id  = parseInt(req.params.id);
    const inv = await prisma.invoice.findUnique({
      where:   { id },
      include: { items: true, company: true, refunds: true, payments: true, order: true },
    });
    if (!inv) return res.status(404).json({ success: false, error: "Facture introuvable" });
    res.json({ success: true, data: formatInvoice(inv) });
  } catch (e) { next(e); }
};
 
// ─── POST /api/superadmin/billing/invoices ────────────────────
// Créer une facture manuelle depuis la vue BillingRevenue
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

    // Calcul du sous-total (Nettoyé du typage TS)
    const subtotal = items.reduce((s, i) => s + (i.qty * i.price - (i.discount ?? 0)), 0);
    
    // Calcul de la taxe (Nettoyé du typage TS)
    const taxAmount = items.reduce((s, i) => {
      const sub = i.qty * i.price - (i.discount ?? 0);
      return s + sub * ((i.taxRate ?? 0) / 100);
    }, 0);

    const total        = subtotal + taxAmount;
    const rate         = parseFloat(exchangeRate) || 1;
    const displayTotal = Math.round(total * rate * 100) / 100;

    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        companyId: parseInt(companyId),
        userId:    parseInt(userId),
        status,
        subtotal, taxAmount, shippingCost: 0, total,
        currency, exchangeRate: rate, displayTotal,
        billingName, billingEmail, billingPhone, billingAddress, billingVat,
        notes, terms, reference,
        dueDate:         dueDate         ? new Date(dueDate)         : null,
        nextBillingDate: nextBillingDate ? new Date(nextBillingDate) : null,
        isRecurring,
        recurringInterval: isRecurring ? recurringInterval : null,
        items: {
          create: items.map((i) => { // Suppression du ": any"
            const sub     = i.qty * i.price - (i.discount ?? 0);
            const itemTax = sub * ((i.taxRate ?? 0) / 100);
            return {
              service:     i.service,
              description: i.description ?? null,
              quantity:    i.qty,
              unit:        i.unit ?? "pcs",
              unitPrice:   i.price,
              discount:    i.discount ?? 0,
              taxRate:     i.taxRate  ?? 0,
              taxAmount:   itemTax,
              subtotal:    sub,
              total:       sub + itemTax,
            };
          }),
        },
      },
      include: { items: true },
    });

    res.status(201).json({ success: true, data: formatInvoice(invoice) });
  } catch (e) { 
    next(e); 
  }
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
 
// ─── DELETE /api/superadmin/billing/invoices/:id ──────────────
export const deleteInvoice = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const inv = await prisma.invoice.findUnique({ where: { id } });
    if (!inv) return res.status(404).json({ success: false, error: "Facture introuvable" });
    if (inv.status === "paid") {
      return res.status(409).json({ success: false, error: "Impossible de supprimer une facture payée. Faites un remboursement d'abord." });
    }
    await prisma.invoice.delete({ where: { id } });
    res.json({ success: true, message: "Facture supprimée" });
  } catch (e) { next(e); }
};
 
// ─── POST /api/superadmin/billing/invoices/:id/refund ─────────
export const refundInvoice = async (req, res, next) => {
  try {
    const id     = parseInt(req.params.id);
    const amount = req.body.amount ? parseFloat(req.body.amount) : null;
    const reason = req.body.reason || null;
 
    const inv = await prisma.invoice.findUnique({
      where:   { id },
      include: { order: true, payments: { where: { status: "completed" }, orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!inv) return res.status(404).json({ success: false, error: "Facture introuvable" });
    if (inv.status !== "paid") {
      return res.status(422).json({ success: false, error: "Seules les factures payées peuvent être remboursées" });
    }
 
    let stripeRefundId = null;
    const refundAmount = amount ?? Number(inv.total);
 
    // Si lié à Stripe
    const stripePI = inv.stripePaymentIntentId ?? inv.payments[0]?.stripePaymentIntentId;
    if (stripePI) {
      const stripe  = await getStripe();
      const charges = await stripe.charges.list({ payment_intent: stripePI, limit: 1 });
      if (charges.data.length) {
        const refund = await stripe.refunds.create({
          charge: charges.data[0].id,
          ...(amount && { amount: Math.round(amount * 100) }),
        });
        stripeRefundId = refund.id;
      }
    }
 
    // Mettre à jour invoice + créer refund + mettre à jour payment
    await prisma.$transaction([
      prisma.invoice.update({ where: { id }, data: { status: "refunded" } }),
      prisma.refund.create({
        data: { invoiceId: id, amount: refundAmount, reason, stripeRefundId },
      }),
      ...(inv.orderId ? [prisma.order.update({ where: { id: inv.orderId }, data: { status: "refunded" } })] : []),
      ...(inv.payments[0] ? [
        prisma.payment.update({
          where: { id: inv.payments[0].id },
          data:  { status: "refunded", stripeRefundId: stripeRefundId ?? undefined },
        }),
      ] : []),
    ]);
 
    res.json({ success: true, message: "Remboursement effectué", stripeRefundId });
  } catch (e) { next(e); }
};
 
// ─── POST /api/superadmin/billing/payments ────────────────────
// Enregistrer un paiement manuel (virement, chèque, etc.)

export const addManualPayment = async (req, res, next) => {
  try {
    const {
      invoiceId, amount, method = "wire",
      transactionId, paymentDate, notes,
    } = req.body;
    if (!invoiceId || !amount) {
      return res.status(422).json({ success: false, error: "invoiceId et amount requis" });
    }
    const inv = await prisma.invoice.findUnique({
      where:   { id: parseInt(invoiceId) },
      include: { company: true, user: true },
    });
    if (!inv) return res.status(404).json({ success: false, error: "Facture introuvable" });
    const paidAt = paymentDate ? new Date(paymentDate) : new Date();

    const payment = await prisma.payment.create({
      data: {
        invoiceId:     parseInt(invoiceId),
        orderId:       inv.orderId ?? null,
        companyId:     inv.companyId,
        userId:        inv.userId,
        amount:        parseFloat(amount),
        currency:      inv.currency,
        exchangeRate:  Number(inv.exchangeRate || 1),
        displayAmount: inv.displayTotal ? Number(inv.displayTotal) : Number(inv.total),
        method:        method,
        methodLabel:   method === "wire" ? "Virement bancaire" : method === "check" ? "Chèque" : "Autre",
        transactionId: transactionId || null,
        status:        "completed",
        notes:         notes || null,
        paidAt,
      },
    });

    await prisma.invoice.update({
      where: { id: parseInt(invoiceId) },
      data: {
        status:        "paid",
        paymentMethod: payment.methodLabel,
        paidAt,
      },
    });

    res.json({
      success: true,
      message: "Paiement enregistré",
      data:    formatPayment({ ...payment, invoice: inv, company: inv.company }),
    });
  } catch (e) { 
    next(e); 
  }
};
 
// ─── GET /api/superadmin/billing/payments ─────────────────────

export const listPayments = async (req, res, next) => {
  try {
    // 1. Nettoyage des paramètres de pagination (Suppression des "as string")
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 10);
    const skip   = (page - 1) * limit;

    // On s'assure que search est bien une chaîne avant d'utiliser .trim()
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : "";
    const status = req.query.status || undefined;

    // 2. Construction de l'objet de filtrage (Suppression du ": any")
    const where = {
      ...(status && { status }),
      ...(search && {
        OR: [
          { company: { name: { contains: search } } },
          { methodLabel: { contains: search } },
          { stripePaymentIntentId: { contains: search } },
        ],
      }),
    };

    // 3. Exécution des requêtes Prisma en parallèle
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: { 
          company: true, 
          invoice: true, 
          order: true 
        },
        orderBy: { paidAt: "desc" },
        skip, 
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    // 4. Réponse formatée pour le frontend
    res.json({
      success: true,
      data:    payments.map(formatPayment),
      meta:    { 
        total, 
        page, 
        last_page: Math.ceil(total / limit) 
      },
    });
  } catch (e) { 
    next(e); 
  }
};
 
// ─── POST /api/superadmin/billing/invoices/retry ─────────────

export const retryPayment = async (req, res, next) => {
  try {
    const { invoiceId } = req.body;
    const inv = await prisma.invoice.findUnique({
      where:   { id: parseInt(invoiceId) },
      include: { payments: { where: { status: "failed" }, take: 1 } },
    });
    if (!inv) return res.status(404).json({ success: false, error: "Facture introuvable" });
    const pi = inv.stripePaymentIntentId ?? inv.payments[0]?.stripePaymentIntentId;
    if (!pi) return res.status(422).json({ success: false, error: "Pas de PaymentIntent Stripe associé" });
 
    const stripe    = await getStripe();
    const piResult  = await stripe.paymentIntents.confirm(pi);
 
    res.json({ success: true, status: piResult.status, message: `PaymentIntent: ${piResult.status}` });
  } catch (e) { next(e); }
};
 
// ─── GET /api/superadmin/billing/payments/:id ─────────────────
export const getPayment = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const p  = await prisma.payment.findUnique({
      where:   { id },
      include: { company: true, invoice: true, order: true },
    });
    if (!p) return res.status(404).json({ success: false, error: "Paiement introuvable" });
    res.json({ success: true, data: formatPayment(p) });
  } catch (e) { next(e); }
};