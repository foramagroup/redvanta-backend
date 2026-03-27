

import prisma from "../config/database.js";


export async function generateInvoiceNumber() {
  const year  = new Date().getFullYear();
  const count = await prisma.invoice.count();
  return `INV-${year}-${String(count + 1).padStart(6, "0")}`;
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
  return {
    id:            inv.id,
    invoiceNumber: inv.invoiceNumber,
    orderId:       inv.orderId,
    companyId:     inv.companyId,
    status:        inv.status,
    subtotal:      Number(inv.subtotal),
    taxAmount:     Number(inv.taxAmount),
    shippingCost:  Number(inv.shippingCost),
    total:         Number(inv.total),
    currency:      inv.currency,
    exchangeRate:  Number(inv.exchangeRate),
    displayTotal:  inv.displayTotal ? Number(inv.displayTotal) : null,
    paymentMethod: inv.paymentMethod,
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
    reference:         inv.reference,
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
    createdAt: inv.createdAt,
  };
}