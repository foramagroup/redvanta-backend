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
import { generateNfcCardsForOrder } from "../../services/nfc.service.js";


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

export const listInvoices = async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)   || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 10);
    const skip   = (page - 1) * limit;
    const search = req.query.search?.trim() || "";
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
    const inv = await prisma.invoice.findUnique({
      where:   { id },
      include: { items: true, company: true, refunds: true },
    });
    if (!inv) return res.status(404).json({ success: false, error: "Facture introuvable" });
    res.json({ success: true, data: formatInvoice(inv) });
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
      return res.status(422).json({ success: false, error: "companyId et userId requis" });
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
    const { status, dueDate, notes, terms, billingVat, reference } = req.body;

    const inv = await prisma.invoice.findUnique({ where: { id } });
    if (!inv) return res.status(404).json({ success: false, error: "Facture introuvable" });

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        ...(status               && { status }),
        ...(dueDate              && { dueDate: new Date(dueDate) }),
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
    const amount = req.body.amount ? parseFloat(req.body.amount) : null;
    const reason = req.body.reason || null;

    const inv = await prisma.invoice.findUnique({
      where:   { id },
      include: { order: true },
    });
    if (!inv) return res.status(404).json({ success: false, error: "Facture introuvable" });
    if (inv.status !== "paid") {
      return res.status(422).json({ success: false, error: "Seules les factures payées peuvent être remboursées" });
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

    res.json({ success: true, message: "Remboursement effectué", stripeRefundId });
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
      return res.status(422).json({ success: false, error: "invoiceId et amount requis" });
    }

    const amountPaid = parseFloat(amount);
    if (isNaN(amountPaid) || amountPaid <= 0) {
      return res.status(422).json({ success: false, error: "Montant invalide" });
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
      return res.status(404).json({ success: false, error: "Facture introuvable" });
    }
    if (invoice.status === "paid") {
      return res.status(422).json({ success: false, error: "Cette facture est déjà payée" });
    }
    if (invoice.status === "refunded") {
      return res.status(422).json({ success: false, error: "Cette facture a été remboursée" });
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
              method:       "manual",   // PaymentMethodType enum
              methodLabel,
              status:       "completed", // PaymentStatus enum
              paidAt,
              ...(transactionId && { transactionId }),
            },
          }),
        ]);

        console.log(`[billing] Facture #${invoice.invoiceNumber} payée (sans commande)`);
        return res.json({
          success: true,
          message: "Paiement enregistré — facture marquée comme payée",
          data:    formatInvoice(updatedInvoice),
        });
      }

      // ── Cas 2 : commande associée → même flux que le webhook Stripe ──
      // FIX 1 : accepter "unpaid" (cash) ET "pending" (Stripe incomplet)
      const allowedStatuses = ["unpaid", "pending"];
      if (!allowedStatuses.includes(order.status)) {
        return res.status(422).json({
          success: false,
          error:   `La commande est déjà au statut "${order.status}"`,
        });
      }

      // FIX 2 : order + invoice + payment dans UNE SEULE transaction atomique
      // Avant : payment.create était hors transaction → si il échouait,
      // la facture passait à "paid" sans aucune ligne de paiement enregistrée
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
        // 3. Payment créé dans la même transaction
        //    → si ce create échoue, order et invoice reviennent en arrière (rollback)
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
            method:      "manual",    // PaymentMethodType enum — valeur valide
            methodLabel,
            status:      "completed", // PaymentStatus enum — seule valeur correcte ici
            paidAt,
            notes:       notes ?? null,
            ...(transactionId && { transactionId }), // champ transactionId du modèle
          },
        }),
      ]);

      console.log(
        `[billing] Paiement #${newPayment.id} enregistré` +
        ` | commande #${order.orderNumber} | montant=${amountPaid} | méthode=${methodLabel}`
      );

      // 4. NFC Cards — même logique que le webhook Stripe
      //    active=false, status=NOT_PROGRAMMED — activées uniquement à la livraison
      const fullOrder = { ...order, status: "paid", paidAt };

      generateNfcCardsForOrder(fullOrder).catch((e) =>
        console.error("[billing] Erreur génération NFC:", e.message)
      );

      // 5. Emails — même logique que le webhook Stripe
      sendOrderEmails(fullOrder, updatedInvoice).catch((e) =>
        console.error("[billing] Erreur envoi emails:", e.message)
      );

      console.log(`[billing] Commande #${order.orderNumber} payée — NFC en cours de génération`);

      return res.json({
        success: true,
        message: `Commande #${order.orderNumber} marquée comme payée — NFC en cours de génération`,
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
          method:       "manual",   // PaymentMethodType enum
          methodLabel,
          status:       "pending",  // PaymentStatus enum — "partial" N'EXISTE PAS dans l'enum
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
      message:          `Paiement partiel enregistré — reste ${remainingBalance.toFixed(2)} ${invoice.currency ?? "EUR"} à recevoir`,
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
    if (!inv) return res.status(404).json({ success: false, error: "Facture introuvable" });
    if (!inv.stripePaymentIntentId) {
      return res.status(422).json({ success: false, error: "Pas de PaymentIntent Stripe associé" });
    }

    const stripe = await getStripe();
    const pi     = await stripe.paymentIntents.confirm(inv.stripePaymentIntentId);

    res.json({ success: true, status: pi.status, message: `PaymentIntent: ${pi.status}` });
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