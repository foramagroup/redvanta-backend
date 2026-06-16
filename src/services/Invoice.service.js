

import prisma from "../config/database.js";



export async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  // Cherche le numéro le plus élevé pour l'année en cours uniquement
  const lastInvoice = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  let nextNumber = 1;
  if (lastInvoice?.invoiceNumber) {
    const parts = lastInvoice.invoiceNumber.split("-");
    const seq = parseInt(parts[parts.length - 1]);
    if (!isNaN(seq)) nextNumber = seq + 1;
  }

  return `${prefix}${String(nextNumber).padStart(6, "0")}`;
}


export async function createInvoiceFromOrder(order) {
  const existing = await prisma.invoice.findUnique({
    where: { orderId: order.id },
  });
  if (existing) return existing;

  const invoiceNumber = await generateInvoiceNumber();

  const invoiceItems = order.items.map((item) => {
    const productName = item.product?.translations?.[0]?.title ?? "Smart Review Card";
    const subtotal    = Number(item.totalPrice);
    // TVA estimée à 0% par défaut (personnalisable)
    return {
      service:     productName,
      description: `${item.totalCards} cartes × ${Number(item.unitPrice).toFixed(2)} EUR/carte`,
      quantity:    item.totalCards,
      unit:        "pcs",
      unitPrice:   Number(item.unitPrice),
      discount:    0,
      taxRate:     0,
      taxAmount:   0,
      subtotal,
      total:       subtotal,
    };
  });

  if (Number(order.shippingCost) > 0) {
    const shippingLabels = {
      standard:      "Livraison standard (5-7 jours)",
      express:       "Livraison express (2-3 jours)",
      international: "Livraison internationale (10-14 jours)",
    };
    invoiceItems.push({
      service:     shippingLabels[order.shippingMethod] ?? "Livraison",
      description: null,
      quantity:    1,
      unit:        "pcs",
      unitPrice:   Number(order.shippingCost),
      discount:    0,
      taxRate:     0,
      taxAmount:   0,
      subtotal:    Number(order.shippingCost),
      total:       Number(order.shippingCost),
    });
  }

  const dueDate = order.paidAt ? new Date(order.paidAt) : new Date();

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      orderId:     order.id,
      companyId:   order.companyId,
      userId:      order.userId,
      status:      "paid",
      subtotal:    Number(order.subtotal),
      taxAmount:   0,
      shippingCost: Number(order.shippingCost),
      total:       Number(order.total),
      currency:    order.currency    ?? "EUR",
      exchangeRate: Number(order.exchangeRate ?? 1),
      displayTotal: order.displayTotal ? Number(order.displayTotal) : Number(order.total),
      stripePaymentIntentId: order.stripePaymentIntentId,
      paidAt:      order.paidAt ?? new Date(),
    
      billingName:    order.shippingFullName,
      billingEmail:   order.user?.email,
      billingPhone:   order.user?.phone,
      billingAddress: [
        order.shippingAddress,
        order.shippingCity,
        order.shippingState,
        order.shippingZip,
        order.shippingCountry,
      ].filter(Boolean).join(", "),
      billingVat:  order.company?.vatNumber ?? null,
      invoiceDate: order.paidAt ?? new Date(),
      dueDate,
      items: {
        create: invoiceItems,
      },
    },
    include: { items: true },
  });

  console.log(`[invoice] Facture ${invoiceNumber} créée pour commande #${order.orderNumber}`);
  return invoice;
}


export function formatInvoice(inv) {
  const payments = (inv.payments ?? []).map((payment) => ({
    id: payment.id,
    amount: Number(payment.amount),
    currency: payment.currency,
    method: payment.method,
    methodLabel: payment.methodLabel,
    transactionId: payment.transactionId,
    stripePaymentIntentId: payment.stripePaymentIntentId,
    status: payment.status,
    paidAt: payment.paidAt,
  }));

  const refunds = (inv.refunds ?? []).map((refund) => ({
    id: refund.id,
    amount: Number(refund.amount),
    reason: refund.reason,
    stripeRefundId: refund.stripeRefundId,
    createdAt: refund.createdAt,
  }));

  const completedPayments = payments.filter((payment) => payment.status === "completed");
  const paidAmount = completedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const refundedAmount = refunds.reduce((sum, refund) => sum + refund.amount, 0);
  const balanceDue = Math.max(Number(inv.total) - paidAmount, 0);
  const lastPayment = [...payments]
    .sort((a, b) => new Date(b.paidAt ?? 0).getTime() - new Date(a.paidAt ?? 0).getTime())[0] ?? null;

  // Pour les factures d'abonnement (plan uniquement) et d'addon (indépendant)
  const bh = inv.billingHistory?.[0] ?? null;
  // Auto-détection : ancienne facture addon sans reference="addon" mais BH baseAmount=0
  const isAddonBh = bh && Number(bh.baseAmount ?? 0) === 0 && Number(bh.addonsAmount ?? 0) > 0;
  const effectiveReference = inv.reference ?? (isAddonBh ? "addon" : null);

  let effectiveDisplayTotal = null;
  if (inv.isRecurring && bh != null) {
    if (effectiveReference === "addon") {
      // Facture addon : montant = addonsAmount
      const addonAmt = Number(bh.addonsAmount ?? 0);
      effectiveDisplayTotal = addonAmt > 0 ? addonAmt : Number(bh.totalAmount ?? 0) || null;
    } else {
      // Facture plan : montant = baseAmount uniquement (pas d'addons)
      const baseAmt = Number(bh.baseAmount ?? 0);
      effectiveDisplayTotal = baseAmt > 0 ? baseAmt : (inv.displayTotal ? Number(inv.displayTotal) : null);
    }
  } else {
    effectiveDisplayTotal = inv.displayTotal ? Number(inv.displayTotal) : null;
  }

  return {
    id:            inv.id,
    invoiceNumber: inv.invoiceNumber,
    orderId:       inv.orderId,
    companyId:     inv.companyId,
    company:       inv.company ? { id: inv.company.id, name: inv.company.name } : null,
    status:        inv.status,
    subtotal:      Number(inv.subtotal),
    taxAmount:     Number(inv.taxAmount),
    shippingCost:  Number(inv.shippingCost),
    total:         Number(inv.total),
    currency:      inv.company?.settings?.currency || inv.currency || "EUR",
    exchangeRate:  Number(inv.exchangeRate),
    displayTotal:  effectiveDisplayTotal,
    paymentMethod: inv.paymentMethod,
    paidAmount,
    refundedAmount,
    balanceDue,
    lastPaymentMethod: inv.paymentMethod ?? lastPayment?.methodLabel ?? lastPayment?.method ?? null,
    paidAt:        inv.paidAt,
    billing: {
      name:    inv.billingName,
      email:   inv.billingEmail,
      phone:   inv.billingPhone,
      address: inv.billingAddress,
      vat:     inv.billingVat,
    },
    isRecurring:       inv.isRecurring,
    recurringInterval: inv.recurringInterval,
    nextBillingDate:   inv.nextBillingDate,
    invoiceDate:       inv.invoiceDate,
    dueDate:           inv.dueDate,
    notes:             inv.notes,
    terms:             inv.terms,
    reference:         effectiveReference,
    emailStatus:       inv.emailStatus ?? "Not Sent",
    emailSentAt:       inv.emailSentAt ?? null,
    emailError:        inv.emailError  ?? null,
    payments,
    refunds,
    items: inv.items?.map((i) => ({
      id:          i.id,
      service:     i.service,
      description: i.description,
      quantity:    i.quantity,
      unit:        i.unit,
      unitPrice:   Number(i.unitPrice),
      discount:    Number(i.discount),
      taxRate:     Number(i.taxRate),
      taxAmount:   Number(i.taxAmount),
      subtotal:    Number(i.subtotal),
      total:       Number(i.total),
    })),
    subscriptionAddons: inv.isRecurring && inv.company?.subscription
      ? (inv.company.subscription.addons ?? [])
          .filter((a) => a.status === "active")
          .map((a) => ({
            id:       a.id,
            name:     a.addon?.name ?? "Add-on",
            quantity: a.quantity ?? 1,
            amount:   Number(a.amount ?? 0),
          }))
      : [],
    createdAt: inv.createdAt,
  };
}


export async function createUnpaidInvoice(order) {
  // Idempotence — si une invoice existe déjà pour cette commande, la retourner
  const existing = await prisma.invoice.findUnique({ where: { orderId: order.id } });
  if (existing) {
    console.log(`[invoice] Invoice ${existing.invoiceNumber} already exists for order #${order.orderNumber} — skipping creation`);
    return existing;
  }

  const items = (order.items ?? []).map((i) => {
    const sub = Number(i.totalPrice);
    return {
      service:     i.product?.translations?.[0]?.title ?? "Product",
      description: null,
      quantity:    i.totalCards  ?? i.quantity ?? 1,
      unit:        "pcs",
      unitPrice:   Number(i.unitPrice),
      discount:    0,
      taxRate:     0,
      taxAmount:   0,
      subtotal:    sub,
      total:       sub,
    };
  });

  const invoiceData = {
    orderId:      order.id,
    companyId:    order.companyId,
    userId:       order.userId,
    status:       "unpaid",
    subtotal:     Number(order.subtotal),
    taxAmount:    0,
    shippingCost: Number(order.shippingCost),
    total:        Number(order.total),
    currency:     order.currency     ?? "EUR",
    exchangeRate: Number(order.exchangeRate ?? 1),
    displayTotal: order.displayTotal ? Number(order.displayTotal) : Number(order.total),
    billingName:  order.user?.name        ?? null,
    billingEmail: order.user?.email       ?? null,
    paymentMethod: order.manualPaymentMethod?.name ?? "Manuel",
    invoiceDate:  new Date(),
    dueDate:      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    items: { create: items },
  };

  // Retry sur collision de numéro (race condition entre requêtes simultanées)
  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const invoiceNumber = await generateInvoiceNumber();
    try {
      const invoice = await prisma.invoice.create({ data: { invoiceNumber, ...invoiceData } });
      console.log(`[invoice] ${invoiceNumber} créée (status=unpaid) pour commande #${order.orderNumber}`);
      return invoice;
    } catch (err) {
      const isNumberCollision = err?.code === "P2002" &&
        (err?.meta?.target?.includes("invoiceNumber") || err?.message?.includes("invoiceNumber"));
      if (isNumberCollision && attempt < MAX_RETRIES - 1) {
        console.warn(`[invoice] Collision sur ${invoiceNumber} (tentative ${attempt + 1}/${MAX_RETRIES}), nouvelle tentative…`);
        await new Promise((r) => setTimeout(r, 30 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}



