import prisma from "../../config/database.js";
 import { activateCardsForOrder, updateCardsStatusForOrder } from "../../services/nfc.service.js";

const TIMELINE_META = {
  pending:    { label: "Order Pending",      desc: "Awaiting payment confirmation" },
  paid:       { label: "Payment Received",   desc: "Your payment has been confirmed" },
  production: { label: "In Production",      desc: "Your cards are being manufactured" },
  printed:    { label: "Printed",            desc: "Cards printed and quality checked" },
  shipped:    { label: "Shipped",            desc: "Your order is on its way" },
  delivered:  { label: "Delivered",          desc: "Order has been delivered" },
};


const STATUS_ORDER = [
  "pending", "paid", "production", "printed", "shipped", "delivered",
];


// const formatAdminOrder = (order) => ({
//   id: order.id,
//   orderNumber: order.orderNumber,
//   status: order.status,
//   customer: {
//     name: order.user?.name,
//     email: order.user?.email,
//     company: order.company?.name
//   },
//   financials: {
//     subtotal: order.subtotal,
//     shipping: order.shippingCost,
//     total: order.total,
//     currency: order.currency,
//     paidAt: order.paidAt
//   },
//   items: order.items?.map(item => ({
//     productName: item.product?.name,
//     quantity: item.quantity,
//     price: item.unitPrice
//   })),
//   invoice: order.invoice ? {
//     number: order.invoice.invoiceNumber,
//     status: order.invoice.status,
//     refunds: order.invoice.refunds // Inclus via le findMany
//   } : null
// });


function formatOrderTracking(o) {
  const history    = o.statusHistory ?? [];
  const currentIdx = STATUS_ORDER.indexOf(o.status);

  // Construire la timeline enrichie
  const timeline = STATUS_ORDER.map((status, i) => {
    const histEntry = history.find((h) => h.status === status);
    return {
      status,
      label:      TIMELINE_META[status]?.label ?? status,
      desc:       TIMELINE_META[status]?.desc  ?? "",
      isComplete: i <= currentIdx,
      isCurrent:  status === o.status,
      completedAt: histEntry?.changedAt ?? null,
      note:        histEntry?.note      ?? null,
    };
  });

  // Cards NFC des items
  const nfcCards = (o.items ?? [])
  .filter((item) => item.nfccards)
  .map((item) => ({
    id:          item.nfcCard.id,
    uid:         item.nfcCard.uid,
    payload:     item.nfcCard.payload,
    isActive:    item.nfcCard.active,
    status:      item.nfcCard.status,
    scanCount:   item.nfcCard.scanCount ?? 0,
    location:    item.nfcCard.locationName ?? "Non assigné",
  }));

  return {
    id:                o.id,
    orderNumber:       o.orderNumber,
    status:            o.status,
    currentStep:       currentIdx + 1,
    totalSteps:        STATUS_ORDER.filter((s) => s !== "pending").length,
    progressPercent:   Math.round(((currentIdx) / (STATUS_ORDER.length - 1)) * 100),
    // Dates
    createdAt:         o.createdAt,
    paidAt:            o.paidAt,
    estimatedDelivery: o.estimatedDelivery,
    // Shipping
    shippingMethod:    o.shippingMethod,
    shippingFullName:  o.shippingFullName,
    shippingAddress:   o.shippingAddress,
    shippingCity:      o.shippingCity,
    shippingCountry:   o.shippingCountry,
    trackingNumber:    o.trackingNumber,
    trackingUrl:       o.trackingUrl,
    // Montants
    total:             Number(o.total),
    currency:          o.currency ?? "EUR",
    displayTotal:      o.displayTotal ? Number(o.displayTotal) : null,
    // Items
    items:             (o.items ?? []).map((i) => ({
      id:          i.id,
      productName: i.product?.translations?.[0]?.title ?? "Product",
      totalCards:  i.totalCards,
      unitPrice:   Number(i.unitPrice),
      totalPrice:  Number(i.totalPrice),
    })),
    // Timeline
    timeline,
    // NFC tags
    nfcCards,
    // Customer
    customer: o.user ? {
      name:  o.user.name,
      email: o.user.email,
    } : null,
    company: o.company ? {
      id:   o.company.id,
      name: o.company.name,
    } : null,
  };
}

// GET /api/admin/orders
export const getAllOrders = async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const skip   = (page - 1) * limit;
    const search = req.query.search?.trim() || "";
    const status = req.query.status || undefined;

    const where = {
      ...(status && status !== "all" && { status }),
      ...(search && {
        OR: [
          { orderNumber:  { contains: search } },
          { user:         { name:  { contains: search } } },
          { user:         { email: { contains: search } } },
          { company:      { name:  { contains: search } } },
        ],
      }),
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: { include: { translations: { take: 1 } } },
              nfccards:  { include: { _count: { select: { scans: true } } } },
            },
          },
          user:    { select: { name: true, email: true } },
          company: { select: { id: true, name: true } },
          statusHistory: { orderBy: { changedAt: "desc" }, take: 1 }, // dernier changement
        },
        orderBy: { createdAt: "desc" },
        skip, take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    // Stats rapides
    const [statsResult] = await Promise.all([
      prisma.order.groupBy({
        by: ["status"],
        _count: { id: true },
        _sum:   { total: true },
      }),
    ]);

    const stats = {
      total:    total,
      revenue:  orders.filter((o) => !["cancelled","refunded"].includes(o.status)).reduce((s, o) => s + Number(o.total), 0),
      active:   orders.filter((o) => ["paid","production","printed","shipped"].includes(o.status)).length,
      customers: new Set(orders.map((o) => o.user?.email)).size,
    };

    res.json({
      success: true,
      data:    orders.map(formatOrderTracking),
      stats,
      meta:    { total, page, last_page: Math.ceil(total / limit) },
    });
  } catch (e) { next(e); }
};

// ─── PATCH /api/superadmin/orders/:id/status ──────────────────
// Action principale du superadmin depuis la vue Orders
// Déclenche les mises à jour NFC selon le statut

export const updateOrderStatus = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { status, note, trackingNumber, trackingUrl, estimatedDelivery } = req.body;
    const changedBy = req.user.userId;
    if (!status) return res.status(422).json({ success: false, error: "status requis" });
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ success: false, error: "Commande introuvable" });
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: {
          status,
          ...(trackingNumber    && { trackingNumber }),
          ...(trackingUrl       && { trackingUrl }),
          ...(estimatedDelivery && { estimatedDelivery: new Date(estimatedDelivery) }),
          ...(status === "paid" && !order.paidAt && { paidAt: new Date() }),
        },
      });
      await tx.orderStatusHistory.create({ data: { orderId: id, status, note: note || null, changedBy: changedBy || null, changedAt: new Date() } });
    });
 
    // ── Actions NFC selon le statut ───────────────────────────
    if (status === "delivered") {
      // ✅ LIVRAISON → activer les NFCCards (active=true, status=ACTIVE)
      await activateCardsForOrder(id).catch((e) => console.error("[tracking] Erreur activation NFC:", e.message));
    } else if (["production", "printed", "shipped"].includes(status)) {
      // Mettre à jour le statut sans activer
      await updateCardsStatusForOrder(id, status).catch((e) => console.error("[tracking] Erreur update NFC:", e.message));
    }
    res.json({ success: true, message: `Statut mis à jour : ${status}` });
  } catch (e) { next(e); }
};

// GET /api/superadmin/orders/:id/full-details
export const getOrderDetail = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        statusHistory: { orderBy: { changedAt: "asc" } },
        items: {
          include: {
            product:  { include: { translations: { take: 1, orderBy: { langId: "asc" } } } },
            design:   true,
            cardType: true,
            nfccards:   { include: { _count: { select: { scans: true } } } },
          },
        },
        user:    { select: { id: true, name: true, email: true } },
        company: { select: { id: true, name: true } },
        invoice: true,
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!order) return res.status(404).json({ success: false, error: "Commande introuvable" });
    res.json({ success: true, data: formatOrderTracking(order) });
  } catch (e) { next(e); }
};


export const processRefund = async (req, res, next) => {
  try {
    const { invoiceId, amount, reason } = req.body;

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { order: true }
    });

    if (!invoice) throw new Error("Facture introuvable");

    // 1. Création du record Refund
    const refund = await prisma.$transaction(async (tx) => {
      const newRefund = await tx.refund.create({
        data: {
          invoiceId,
          amount,
          reason,
          // stripeRefundId: stripeRes.id (si lié à Stripe)
        }
      });

      if (amount >= invoice.total) {
        await tx.order.update({
          where: { id: invoice.orderId },
          data: { status: 'refunded' }
        });
      }

      return newRefund;
    });

    res.json({ success: true, data: refund });
  } catch (e) {
    next(e);
  }
};


// GET /api/superadmin/orders/:id/history — historique des statuts
export const getOrderHistory = async (req, res, next) => {
  try {
    const id      = parseInt(req.params.id);
    const history = await prisma.orderStatusHistory.findMany({
      where:   { orderId: id },
      include: { admin: { select: { name: true, email: true } } },
      orderBy: { changedAt: "asc" },
    });
    res.json({ success: true, data: history });
  } catch (e) { next(e); }
};