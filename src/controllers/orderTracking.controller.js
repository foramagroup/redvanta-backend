// src/controllers/orderTracking.controller.js
// SuperAdmin : mise à jour statut + tracking
// Client     : suivi commande en temps réel

import prisma  from "../config/database.js";


// ─── Statuts dans l'ordre chronologique ──────────────────────
const STATUS_ORDER = [
  "pending", "paid", "production", "printed", "shipped", "delivered",
];

// ─── Timeline labels pour le front ───────────────────────────
const TIMELINE_META = {
  pending:    { label: "Order Pending",      desc: "Awaiting payment confirmation" },
  paid:       { label: "Payment Received",   desc: "Your payment has been confirmed" },
  production: { label: "In Production",      desc: "Your cards are being manufactured" },
  printed:    { label: "Printed",            desc: "Cards printed and quality checked" },
  shipped:    { label: "Shipped",            desc: "Your order is on its way" },
  delivered:  { label: "Delivered",          desc: "Order has been delivered" },
};

// ─── Format order pour tracking ──────────────────────────────

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
      hasNfc:      !!i.nfccards
    })),
    // Timeline
    timeline,
    // NFC cards
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

// ─────────────────────────────────────────────────────────────
// ENDPOINTS CLIENT
// ─────────────────────────────────────────────────────────────

// GET /api/orders/tracking — toutes les commandes actives du client
export const getMyOrders = async (req, res, next) => {
  try {
    const userId    = req.user.userId;
    const companyId = parseInt(req.user.companyId);
    const search    = req.query.search?.trim() || "";

    const orders = await prisma.order.findMany({
      where: {
        userId, companyId,
        status: { notIn: ["cancelled", "refunded"] },
        ...(search && {
          OR: [
            { orderNumber:     { contains: search } },
            { trackingNumber:  { contains: search } },
          ],
        }),
      },
      include: {
        statusHistory: { orderBy: { changedAt: "asc" } },
        items: {
          include: {
            product: { include: { translations: { take: 1, orderBy: { langId: "asc" } } } },
            nfccards: { include: { _count: { select: { scans: true } } } }, // Changement ici: nfcCard au lieu de nfctag
          },
        },
        user:    { select: { name: true, email: true } },
        company: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: orders.map(formatOrderTracking) });
  } catch (e) { next(e); }
};

// GET /api/orders/tracking/:orderNumber — détail commande par numéro
export const getOrderTracking = async (req, res, next) => {
  try {
    const userId    = req.user.userId;
    const companyId = parseInt(req.user.companyId);
    const { orderNumber } = req.params;

    const order = await prisma.order.findFirst({
      where: {
        orderNumber, userId, companyId,
      },
      include: {
        statusHistory: { orderBy: { changedAt: "asc" } },
        items: {
          include: {
            product: { include: { translations: { take: 1, orderBy: { langId: "asc" } } } },
            nfccards:  { include: { _count: { select: { scans: true } } } },
          },
        },
        user:    { select: { name: true, email: true } },
        company: { select: { id: true, name: true } },
      },
    });

    if (!order) return res.status(404).json({ success: false, error: "Commande introuvable" });
    res.json({ success: true, data: formatOrderTracking(order) });
  } catch (e) { next(e); }
};




// ─────────────────────────────────────────────────────────────
// ENDPOINTS SUPERADMIN
// ─────────────────────────────────────────────────────────────

// GET /api/superadmin/orders — toutes les commandes + filtres
export const listAllOrders = async (req, res, next) => {
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




