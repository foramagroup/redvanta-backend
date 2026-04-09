import prisma from "../config/database.js";

const STATUS_ORDER = [
  "pending",
  "paid",
  "production",
  "printed",
  "shipped",
  "delivered",
];

const TIMELINE_META = {
  pending: { label: "Order Pending", desc: "Awaiting payment confirmation" },
  paid: { label: "Payment Received", desc: "Your payment has been confirmed" },
  production: { label: "In Production", desc: "Your cards are being manufactured" },
  printed: { label: "Printed", desc: "Cards printed and quality checked" },
  shipped: { label: "Shipped", desc: "Your order is on its way" },
  delivered: { label: "Delivered", desc: "Order has been delivered" },
};

function formatOrderTracking(order) {
  const history = order.statusHistory ?? [];
  const currentIdx = STATUS_ORDER.indexOf(order.status);

  const timeline = STATUS_ORDER.map((status, index) => {
    const entry = history.find((item) => item.status === status);
    return {
      status,
      label: TIMELINE_META[status]?.label ?? status,
      desc: TIMELINE_META[status]?.desc ?? "",
      isComplete: index <= currentIdx,
      isCurrent: status === order.status,
      completedAt: entry?.changedAt ?? null,
      note: entry?.note ?? null,
    };
  });

  const nfcCards = (order.items ?? []).flatMap((item) =>
    (item.nfcCards ?? []).map((card) => ({
      id: card.id,
      uid: card.uid,
      payload: card.payload,
      isActive: card.active,
      status: card.status,
      scanCount: card._count?.scans ?? card.scanCount ?? 0,
      location: card.locationName ?? "Non assigne",
    }))
  );

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    currentStep: currentIdx + 1,
    totalSteps: STATUS_ORDER.filter((s) => s !== "pending").length,  // = 5,
    progressPercent: currentIdx >= 0 ? Math.round((currentIdx / (STATUS_ORDER.length - 1)) * 100) : 0,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    estimatedDelivery: order.estimatedDelivery ?? null,
    shippingMethod: order.shippingMethod,
    shippingFullName: order.shippingFullName,
    shippingAddress: order.shippingAddress,
    shippingCity: order.shippingCity,
    shippingCountry: order.shippingCountry,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    total: Number(order.total),
    currency: order.currency ?? "EUR",
    displayTotal: order.displayTotal ? Number(order.displayTotal) : null,
    items: (order.items ?? []).map((item) => ({
      id: item.id,
      productName: item.product?.translations?.[0]?.title ?? "Product",
      totalCards: item.totalCards,
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
      hasNfc: !!item.nfcCards?.length,
    })),
    timeline,
    nfcCards,
    customer: order.user
      ? {
          name: order.user.name,
          email: order.user.email,
        }
      : null,
    company: order.company
      ? {
          id: order.company.id,
          name: order.company.name,
        }
      : null,
  };
}

const ORDER_INCLUDE = {
  statusHistory: { orderBy: { changedAt: "asc" } },
  items: {
    include: {
      product: { include: { translations: { take: 1, orderBy: { langId: "asc" } } } },
      nfcCards: { include: { _count: { select: { scans: true } } } },
    },
  },
  user: { select: { name: true, email: true } },
  company: { select: { id: true, name: true } },
};

export const getMyOrders = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const companyId = parseInt(req.user.companyId);
    const search = req.query.search?.trim() || "";

    const orders = await prisma.order.findMany({
      where: {
        userId,
        companyId,
        status: { notIn: ["cancelled", "refunded"] },
        ...(search && {
          OR: [{ orderNumber: { contains: search } }, { trackingNumber: { contains: search } }],
        }),
      },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: orders.map(formatOrderTracking) });
  } catch (error) {
    next(error);
  }
};

export const getOrderTracking = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const companyId = parseInt(req.user.companyId);
    const { orderNumber } = req.params;

    const order = await prisma.order.findFirst({
      where: { orderNumber, userId, companyId },
      include: ORDER_INCLUDE,
    });

    if (!order) {
      return res.status(404).json({ success: false, error: "Commande introuvable" });
    }

    res.json({ success: true, data: formatOrderTracking(order) });
  } catch (error) {
    next(error);
  }
};
