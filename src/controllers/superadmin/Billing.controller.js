// src/controllers/billing.controller.js
// Superadmin — gestion complète des factures (vue BillingRevenue)
// ─────────────────────────────────────────────────────────────
// SCÉNARIO CASH (paiement manuel) :
//
//   1. Client choisit "Manuel" → order créée status="unpaid"
//      + facture créée immédiatement status="unpaid"
//      + email "en attente de paiement" envoyé au client
//
//   2. Superadmin reçoit le virement → ouvre la vue BillingRevenue
//      → clique "Ajouter paiement" sur la facture unpaid
//      → saisit le montant reçu
//
//   3. POST /api/superadmin/billing/payments  ← addManualPayment()
//      SI montant >= total de la facture :
//        → order.status    = "paid"  + paidAt = now
//        → invoice.status  = "paid"  + paidAt = now
//        → Payment créé    status="completed"  ← dans la MÊME transaction
//        → NFC Cards générées (même logique que webhook Stripe)
//        → Emails confirmation envoyés (même logique que webhook Stripe)
//      SI montant < total de la facture (paiement partiel) :
//        → Payment créé    status="partial"
//        → invoice.status  = "partial" (en attente du solde)
//        → order inchangé

import prisma  from "../../config/database.js";
import { getStripe }  from "../../services/Stripe.service.js";
import {
  generateInvoiceNumber,
  formatInvoice,
} from "../../services/Invoice.service.js";
import {
  buildOrderConfirmationCustomer,
  buildOrderNotificationAdmin,
  buildOrderNotificationSuperAdmin,
} from "../../templates/client/Orderemails.js";

import { sendTemplatedMail }  from "../../services/client/mail.service.js";
import { fulfillNfcForOrder } from "../../services/nfc.service.js";
import { generateInvoicePdfBuffer } from "../../services/InvoicePdf.service.js";


// ─── GET /api/superadmin/billing/stats ───────────────────────

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
        prisma.invoice.count({ where: { status: { in: ["cancelled"] } } }),
        prisma.invoice.count({ where: { status: "sent" } }),
        prisma.invoice.count({ where: { status: "overdue" } }),
      ]);

    const mrrResult = await prisma.invoice.aggregate({
      where: { status: "paid", isRecurring: true, invoiceDate: { gte: thisMonth } },
      _sum: { total: true },
    });

    const mrr       = Number(mrrResult._sum.total ?? 0);
    const arr       = mrr * 12;
    const prevMrr   = Number(totalPaidLastMonth._sum.total ?? 0);
    const expansion = Math.max(0, mrr - prevMrr);

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
        mrr,
        arr,
        expansion,
        churnRate:   `${churnRate}%`,
        failedCount,
        pendingCount,
        overdueCount,
      },
    });
  } catch (e) { next(e); }
};

// ─── GET /api/superadmin/billing/invoices ─────────────────────

export const listInvoices = async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)   || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 10);
    const skip   = (page - 1) * limit;
    const search = req.query.search?.trim() || "";
    const status = req.query.status || undefined;
    const from   = req.query.from   || undefined;
    const to     = req.query.to     || undefined;

    const type   = req.query.type || "product"; // "product" | "subscription" | "all"

    const where = {
      ...(type === "product"      && { isRecurring: false }),
      ...(type === "subscription" && { isRecurring: true }),
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

// ─── GET /api/superadmin/billing/invoices/:id ─────────────────

export const getInvoice = async (req, res, next) => {
  try {
    const id  = parseInt(req.params.id);
    const [inv, platform] = await Promise.all([
      prisma.invoice.findUnique({
        where:   { id },
        include: { items: true, company: true, refunds: true },
      }),
      prisma.platformSetting.findFirst({
        select: { companyName: true, companyEmail: true, companyAddress: true },
      }),
    ]);
    if (!inv) return res.status(404).json({ success: false, error: req.t("superadmin.billing.invoice_not_found") });
    const data = formatInvoice(inv);
    data.platformName    = platform?.companyName    ?? "RedVanta";
    data.platformEmail   = platform?.companyEmail   ?? "";
    data.platformAddress = platform?.companyAddress ?? "";
    res.json({ success: true, data });
  } catch (e) { next(e); }
};

// ─── POST /api/superadmin/billing/invoices ────────────────────
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
      return res.status(422).json({ success: false, error: req.t("superadmin.billing.required_fields") });
    }

    const subtotal  = items.reduce((s, i) => s + (i.qty * i.price - (i.discount ?? 0)), 0);
    const taxAmount = items.reduce((s, i) => {
      const itemSubtotal = i.qty * i.price - (i.discount ?? 0);
      return s + itemSubtotal * ((i.taxRate ?? 0) / 100);
    }, 0);
    const total        = subtotal + taxAmount;
    const displayTotal = Math.round(total * (parseFloat(exchangeRate) || 1) * 100) / 100;
    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        companyId:     parseInt(companyId),
        userId:        parseInt(userId),
        status,
        subtotal, taxAmount, shippingCost: 0, total,
        currency, exchangeRate: parseFloat(exchangeRate) || 1, displayTotal,
        billingName, billingEmail, billingPhone, billingAddress, billingVat,
        notes, terms, reference,
        dueDate:           dueDate         ? new Date(dueDate)         : null,
        nextBillingDate:   nextBillingDate ? new Date(nextBillingDate) : null,
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
    const { status, dueDate, notes, terms, billingVat, reference, emailStatus, emailSentAt } = req.body;

    const inv = await prisma.invoice.findUnique({ where: { id } });
    if (!inv) return res.status(404).json({ success: false, error: req.t("superadmin.billing.invoice_not_found") });

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        ...(status               && { status }),
        ...(dueDate              && { dueDate: new Date(dueDate) }),
        ...(notes     !== undefined && { notes }),
        ...(terms     !== undefined && { terms }),
        ...(billingVat !== undefined && { billingVat }),
        ...(reference !== undefined && { reference }),
        ...(emailStatus !== undefined && { emailStatus }),
        ...(emailSentAt !== undefined && { emailSentAt: emailSentAt ? new Date(emailSentAt) : null }),
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
    const amount = req.body.amount ? parseFloat(req.body.amount) : null;
    const reason = req.body.reason || null;

    const inv = await prisma.invoice.findUnique({
      where:   { id },
      include: { order: true },
    });
    if (!inv) return res.status(404).json({ success: false, error: req.t("superadmin.billing.invoice_not_found") });
    if (inv.status !== "paid") {
      return res.status(422).json({ success: false, error: req.t("superadmin.billing.only_paid_refundable") });
    }

    let stripeRefundId = null;

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

    await prisma.$transaction([
      prisma.invoice.update({ where: { id }, data: { status: "refunded" } }),
      prisma.refund.create({
        data: { invoiceId: id, amount: amount ?? Number(inv.total), reason, stripeRefundId },
      }),
      ...(inv.orderId ? [
        prisma.order.update({ where: { id: inv.orderId }, data: { status: "refunded" } }),
      ] : []),
    ]);

    res.json({ success: true, message: req.t("superadmin.billing.refund_done"), stripeRefundId });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// POST /api/superadmin/billing/payments — Enregistrer un paiement manuel
// ─────────────────────────────────────────────────────────────

export const addManualPayment = async (req, res, next) => {
  try {
    const {
      invoiceId,
      amount,
      method      = "Manuel",
      transactionId,
      paymentDate,
      notes,
    } = req.body;
 
    if (!invoiceId || !amount) {
      return res.status(422).json({ success: false, error: req.t("superadmin.billing.id_amount_required") });
    }
 
    const amountPaid = parseFloat(amount);
    if (isNaN(amountPaid) || amountPaid <= 0) {
      return res.status(422).json({ success: false, error: req.t("superadmin.billing.invalid_amount") });
    }
 
    const invoice = await prisma.invoice.findUnique({
      where:   { id: parseInt(invoiceId) },
      include: {
        order: {
          include: {
            user:    true,
            company: true,
            items: {
              include: {
                product:  { include: { translations: { take: 1, orderBy: { langId: "asc" } } } },
                design:   true,
                cardType: true,
              },
            },
          },
        },
      },
    });
 
    if (!invoice) {
      return res.status(404).json({ success: false, error: req.t("superadmin.billing.invoice_not_found") });
    }
    if (invoice.status === "paid") {
      return res.status(422).json({ success: false, error: req.t("superadmin.billing.already_paid") });
    }
    if (invoice.status === "refunded") {
      return res.status(422).json({ success: false, error: req.t("superadmin.billing.already_refunded") });
    }
    if (invoice.isRecurring) {
      return res.status(422).json({
        success: false,
        error: req.t("superadmin.billing.subscription_invoice_use_subscription_page"),
      });
    }
 
    const invoiceTotal  = Number(invoice.total);
    const isFullPayment = amountPaid >= invoiceTotal;
    const paidAt        = paymentDate ? new Date(paymentDate) : new Date();
    const methodLabel   = method ?? "Manuel";
 
    // ── Paiement COMPLET ──────────────────────────────────────
    if (isFullPayment) {
      const order = invoice.order;
 
      // ── Cas 1 : facture manuelle sans commande (créée depuis BillingRevenue) ──
      if (!order) {
        const [updatedInvoice] = await prisma.$transaction([
          prisma.invoice.update({
            where: { id: invoice.id },
            data:  { status: "paid", paidAt, paymentMethod: methodLabel },
          }),
          prisma.payment.create({
            data: {
              invoiceId:    invoice.id,
              companyId:    invoice.companyId,
              userId:       invoice.userId,
              amount:       amountPaid,
              currency:     invoice.currency ?? "EUR",
              exchangeRate: Number(invoice.exchangeRate ?? 1),
              displayAmount: amountPaid,
              method:       "manual",
              methodLabel,
              status:       "completed",
              paidAt,
              ...(transactionId && { transactionId }),
            },
          }),
        ]);
 
        console.log(`[billing] Facture #${invoice.invoiceNumber} payée (sans commande)`);
        return res.json({
          success: true,
          message: req.t("superadmin.billing.payment_recorded"),
          data:    formatInvoice(updatedInvoice),
        });
      }
 
      // ── Cas 2 : commande associée → même flux que le webhook Stripe ──
      const allowedStatuses = ["unpaid", "pending"];
      if (!allowedStatuses.includes(order.status)) {
        return res.status(422).json({
          success: false,
          error:   req.t("superadmin.billing.order_already_status", { status: order.status }),
        });
      }
 
      // Transaction atomique : order + invoice + payment + vidage panier
      // Identique au webhook Stripe dans order.controller.js
      const [, updatedInvoice, newPayment] = await prisma.$transaction([
        // 1. Order → paid
        prisma.order.update({
          where: { id: order.id },
          data:  { status: "paid", paidAt },
        }),
        // 2. Invoice → paid
        prisma.invoice.update({
          where: { id: invoice.id },
          data:  { status: "paid", paidAt, paymentMethod: methodLabel },
        }),
        // 3. Payment (rollback automatique si ce create échoue)
        prisma.payment.create({
          data: {
            orderId:      order.id,
            invoiceId:    invoice.id,
            companyId:    order.companyId,
            userId:       order.userId,
            amount:       amountPaid,
            currency:     order.currency ?? "EUR",
            exchangeRate: Number(order.exchangeRate ?? 1),
            displayAmount: order.displayTotal
              ? Number(order.displayTotal)
              : amountPaid,
            method:      "manual",
            methodLabel,
            status:      "completed",
            paidAt,
            notes:       notes ?? null,
            ...(transactionId && { transactionId }),
          },
        }),
        // 4. ✅ Vider le panier — identique au webhook Stripe (order.controller.js)
        //    Le panier est normalement vidé à la création de la commande (createOrder)
        //    On le refait ici par sécurité (relance, panier non vidé, etc.)
        prisma.cartItem.deleteMany({
          where: { userId: order.userId, companyId: order.companyId },
        }),
      ]);
 
      console.log(
        `[billing] Paiement #${newPayment.id} enregistré` +
        ` | commande #${order.orderNumber} | montant=${amountPaid} | méthode=${methodLabel}`
      );
 
      // 5. NFC Cards — même logique que le webhook Stripe
      const fullOrder = { ...order, status: "paid", paidAt };
 
      fulfillNfcForOrder(fullOrder).catch((e) =>
        console.error("[billing] Erreur fulfillment NFC:", e.message)
      );
 
      // 6. Emails — même logique que le webhook Stripe
      sendOrderEmails(fullOrder, updatedInvoice).catch((e) =>
        console.error("[billing] Erreur envoi emails:", e.message)
      );
 
      console.log(`[billing] Commande #${order.orderNumber} payée — NFC en cours de génération`);
 
      return res.json({
        success: true,
        message: req.t("superadmin.billing.order_paid", { orderNumber: order.orderNumber }),
        data:    formatInvoice(updatedInvoice),
      });
    }
 
    // ── Paiement PARTIEL ──────────────────────────────────────
    const existingPaid = await prisma.payment.aggregate({
      where: { invoiceId: invoice.id, status: { in: ["partial", "completed"] } },
      _sum:  { amount: true },
    });
 
    const alreadyPaid      = Number(existingPaid._sum.amount ?? 0);
    const newTotalPaid     = alreadyPaid + amountPaid;
    const remainingBalance = invoiceTotal - newTotalPaid;
 
    await prisma.$transaction([
      prisma.payment.create({
        data: {
          ...(invoice.orderId && { orderId: invoice.orderId }),
          invoiceId:    invoice.id,
          companyId:    invoice.companyId,
          userId:       invoice.userId,
          amount:       amountPaid,
          currency:     invoice.currency ?? "EUR",
          exchangeRate: Number(invoice.exchangeRate ?? 1),
          displayAmount: amountPaid,
          method:       "manual",
          methodLabel,
          status:       "pending",
          paidAt,
          notes:        notes ?? null,
          ...(transactionId && { transactionId }),
        },
      }),
      prisma.invoice.update({
        where: { id: invoice.id },
        data:  {
          paymentMethod: methodLabel,
          paidAmount:    newTotalPaid,
        },
      }),
    ]);
 
    console.log(
      `[billing] Paiement partiel ${amountPaid} pour facture #${invoice.invoiceNumber}` +
      ` | payé: ${newTotalPaid}/${invoiceTotal} | reste: ${remainingBalance}`
    );
 
    return res.json({
      success:          true,
      message:          req.t("superadmin.billing.partial_payment", { remaining: remainingBalance.toFixed(2), currency: invoice.currency ?? "EUR" }),
      paidAmount:       newTotalPaid,
      remainingBalance,
      isFullPayment:    false,
    });
 
  } catch (e) { next(e); }
};

// ─── GET /api/superadmin/billing/payments ─────────────────────

export const listPayments = async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)   || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 10);
    const skip   = (page - 1) * limit;
    const search = req.query.search?.trim() || "";

    const where = {
      ...(search && {
        OR: [
          { invoice: { invoiceNumber: { contains: search } } },
          { invoice: { company: { name: { contains: search } } } },
        ],
      }),
    };

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: { invoice: { select: { invoiceNumber: true } }, company: true },
        orderBy: { paidAt: "desc" },
        skip, take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    const formatted = payments.map((p) => ({
      rawId:         p.id,
      id:            `PAY-${String(p.id).padStart(3, "0")}`,
      invoiceNumber: p.invoice?.invoiceNumber ?? "-",
      account:       p.company?.name          ?? "-",
      amount:        `${p.currency ?? "EUR"} ${Number(p.amount).toFixed(2)}`,
      amountRaw:     Number(p.amount),
      currency:      p.currency ?? "EUR",
      method:        p.methodLabel ?? p.method ?? "-",
      date:          p.paidAt?.toISOString().split("T")[0] ?? "-",
      status:        p.status ?? "completed",
      txId:          p.stripeChargeId ?? p.stripePaymentIntentId ?? "-",
    }));

    res.json({
      success: true,
      data:    formatted,
      meta:    { total, page, last_page: Math.ceil(total / limit) },
    });
  } catch (e) { next(e); }
};

// ─── POST /api/superadmin/billing/invoices/retry ─────────────

export const retryPayment = async (req, res, next) => {
  try {
    const { invoiceId } = req.body;
    const inv = await prisma.invoice.findUnique({ where: { id: parseInt(invoiceId) } });
    if (!inv) return res.status(404).json({ success: false, error: req.t("superadmin.billing.invoice_not_found") });
    if (!inv.stripePaymentIntentId) {
      return res.status(422).json({ success: false, error: req.t("superadmin.billing.no_stripe_intent") });
    }

    const stripe = await getStripe();
    const pi     = await stripe.paymentIntents.confirm(inv.stripePaymentIntentId);

    res.json({ success: true, status: pi.status, message: `PaymentIntent: ${pi.status}` });
  } catch (e) { next(e); }
};

// ─── POST /api/superadmin/billing/invoices/:id/send-email ─────

export const sendInvoiceEmail = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { to, mode = "send" } = req.body;

    const inv = await prisma.invoice.findUnique({
      where:   { id },
      include: { items: true, company: true, user: true },
    });
    if (!inv) return res.status(404).json({ success: false, error: req.t("superadmin.billing.invoice_not_found") });

    const recipientEmail = (to || "").trim() || inv.billingEmail || inv.user?.email;
    if (!recipientEmail) {
      return res.status(422).json({ success: false, error: "No recipient email available" });
    }

    const currency = inv.currency || "EUR";
    const total    = Number(inv.displayTotal ?? inv.total ?? 0);

    const vars = {
      invoice_number:  inv.invoiceNumber,
      company_name:    inv.company?.name ?? inv.billingName ?? "Client",
      billing_name:    inv.billingName   ?? inv.company?.name ?? "Client",
      billing_email:   recipientEmail,
      invoice_date:    inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString("fr-FR") : "-",
      due_date:        inv.dueDate     ? new Date(inv.dueDate).toLocaleDateString("fr-FR")     : "-",
      total:           total.toFixed(2),
      currency,
      status:          inv.status,
      year:            String(new Date().getFullYear()),
      items_html:      (inv.items ?? []).map((i) =>
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
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body { font-family: sans-serif; color: #222; margin: 0; padding: 0; background: #f6f6f6; }
  .wrap { max-width: 600px; margin: 32px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
  .header { background: #e11d48; padding: 28px 32px; color: #fff; }
  .header h1 { margin: 0; font-size: 22px; }
  .header p  { margin: 4px 0 0; font-size: 13px; opacity: .85; }
  .body { padding: 28px 32px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
  th { background: #f1f5f9; padding: 8px; text-align: left; font-size: 13px; }
  th:last-child, td:last-child { text-align: right; }
  .total-row td { padding: 10px 8px; font-weight: 700; border-top: 2px solid #e11d48; font-size: 15px; }
  .footer { padding: 16px 32px; background: #f9f9f9; font-size: 12px; color: #888; text-align: center; }
</style></head>
<body>
<div class="wrap">
  <div class="header">
    <h1>Invoice ${inv.invoiceNumber}</h1>
    <p>Date: ${vars.invoice_date}${vars.due_date !== "-" ? ` &nbsp;·&nbsp; Due: ${vars.due_date}` : ""}</p>
  </div>
  <div class="body">
    <p>Hello <strong>${vars.billing_name}</strong>,</p>
    <p>Please find your invoice details below.</p>
    <table>
      <thead><tr>
        <th>Service</th><th style="text-align:center">Qty</th>
        <th style="text-align:right">Unit price</th><th style="text-align:right">Total</th>
      </tr></thead>
      <tbody>${vars.items_html}</tbody>
      <tfoot><tr class="total-row">
        <td colspan="3">Total</td>
        <td>${vars.total} ${vars.currency}</td>
      </tr></tfoot>
    </table>
    <p style="font-size:13px;color:#555">Status: <strong>${vars.status}</strong></p>
    ${inv.notes ? `<p style="font-size:13px;color:#555">${inv.notes}</p>` : ""}
    ${inv.terms ? `<p style="font-size:12px;color:#888"><em>${inv.terms}</em></p>` : ""}
    <p>Thank you for your business.</p>
  </div>
  <div class="footer">&copy; ${vars.year} ${vars.company_name}. All rights reserved.</div>
</div>
</body></html>`,
      text: `Invoice ${inv.invoiceNumber}\nDate: ${vars.invoice_date}\nTotal: ${vars.total} ${vars.currency}\nStatus: ${vars.status}`,
    });

    // Generate PDF attachment
    let pdfAttachment = null;
    try {
      const pdfBuffer = await generateInvoicePdfBuffer(inv);
      pdfAttachment = {
        filename:    `invoice-${inv.invoiceNumber}.pdf`,
        content:     pdfBuffer,
        contentType: "application/pdf",
      };
    } catch (pdfErr) {
      console.warn(`[billing] PDF generation failed for #${inv.invoiceNumber}:`, pdfErr.message);
    }

    let emailStatus = "Sent";
    let emailSentAt = new Date();
    let emailError  = null;

    try {
      await sendTemplatedMail({
        slug:        "invoice_email",
        to:          recipientEmail,
        variables:   vars,
        fallbackFn:  buildFallback,
        attachments: pdfAttachment ? [pdfAttachment] : [],
      });
    } catch (err) {
      emailStatus = "Failed";
      emailError  = err.message?.slice(0, 495) ?? "Send failed";
      console.error(`[billing] sendInvoiceEmail failed for #${inv.invoiceNumber}:`, err.message);
    }

    const updated = await prisma.invoice.update({
      where:   { id },
      data:    { emailStatus, emailSentAt, emailError, ...(to?.trim() && { billingEmail: to.trim() }) },
      include: { items: true, company: true },
    });

    res.json({ success: true, data: formatInvoice(updated) });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// Emails post-paiement — identique au webhook Stripe
// ─────────────────────────────────────────────────────────────

async function sendOrderEmails(order, invoice) {
  if (order.confirmationEmailSentAt) return;

  const currency     = order.currency ?? "EUR";
  const rate         = Number(order.exchangeRate ?? 1);
  const displayTotal = order.displayTotal ? Number(order.displayTotal) : Number(order.total);

  const items = order.items.map((i) => ({
    productName:      i.product?.translations?.[0]?.title ?? "Product",
    totalCards:       i.totalCards,
    unitPrice:        Number(i.unitPrice),
    totalPrice:       Number(i.totalPrice),
    displayLineTotal: Math.round(Number(i.totalPrice) * rate * 100) / 100,
  }));

  const shippingLabel = {
    standard: "Standard (5-7j)", express: "Express (2-3j)", international: "International (10-14j)",
  }[order.shippingMethod] ?? order.shippingMethod;

  const vars = {
    customer_name:    order.user.name  || order.user.email,
    company_name:     order.company.name,
    admin_email:      order.user.email,
    order_number:     order.orderNumber,
    invoice_number:   invoice?.invoiceNumber ?? "-",
    total:            String(Math.round(Number(order.total) * rate * 100) / 100),
    subtotal:         String(Math.round(Number(order.subtotal) * rate * 100) / 100),
    shipping_cost:    String(Math.round(Number(order.shippingCost) * rate * 100) / 100),
    shipping_method:  shippingLabel,
    shipping_name:    order.shippingFullName  ?? "",
    shipping_address: order.shippingAddress   ?? "",
    shipping_city:    order.shippingCity      ?? "",
    shipping_state:   order.shippingState     ?? "",
    shipping_zip:     order.shippingZip       ?? "",
    shipping_country: order.shippingCountry   ?? "",
    currency,
    order_date: new Date(order.createdAt).toLocaleDateString("fr-FR"),
    year:       String(new Date().getFullYear()),
    items_html: items.map((i) =>
      `<p style="margin:4px 0;font-size:13px">• ${i.productName} × ${i.totalCards} cartes — ${i.displayLineTotal} ${currency}</p>`
    ).join(""),
  };

  const applyV = (p) => {
    const r = (s) => s?.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "") ?? "";
    return { subject: r(p.subject), html: r(p.html), text: r(p.text) };
  };

  await sendTemplatedMail({
    slug:       "order_confirmation_customer",
    to:         order.user.email,
    variables:  vars,
    fallbackFn: () => applyV(buildOrderConfirmationCustomer({ order, items, currency, displayTotal })),
  });

  const ownerLink = await prisma.userCompany.findFirst({
    where: { companyId: order.companyId, isOwner: true },
    include: { user: true },
  });
  if (ownerLink && ownerLink.user.email !== order.user.email) {
    await sendTemplatedMail({
      slug:       "order_confirmation_admin",
      to:         ownerLink.user.email,
      variables:  vars,
      fallbackFn: () => applyV(buildOrderNotificationAdmin({ order, items, companyName: order.company.name, currency, displayTotal })),
    });
  }

  const saEmail = process.env.SUPERADMIN_EMAIL || process.env.MAIL_FROM_ADDRESS;
  if (saEmail) {
    await sendTemplatedMail({
      slug:       "order_notification_superadmin",
      to:         saEmail,
      variables:  vars,
      fallbackFn: () => applyV(buildOrderNotificationSuperAdmin({ order, companyName: order.company.name, adminEmail: order.user.email, currency, displayTotal })),
    });
  }

  await prisma.order.update({ where: { id: order.id }, data: { confirmationEmailSentAt: new Date() } });
  console.log(`[order] Emails envoyés pour #${order.orderNumber}`);
}