import prisma from "../../config/database.js";





const formatAdminOrder = (order) => ({
  id: order.id,
  orderNumber: order.orderNumber,
  status: order.status,
  customer: {
    name: order.user?.name,
    email: order.user?.email,
    company: order.company?.name
  },
  financials: {
    subtotal: order.subtotal,
    shipping: order.shippingCost,
    total: order.total,
    currency: order.currency,
    paidAt: order.paidAt
  },
  items: order.items?.map(item => ({
    productName: item.product?.name,
    quantity: item.quantity,
    price: item.unitPrice
  })),
  invoice: order.invoice ? {
    number: order.invoice.invoiceNumber,
    status: order.invoice.status,
    refunds: order.invoice.refunds // Inclus via le findMany
  } : null
});

// GET /api/admin/orders
export const getAllOrders = async (req, res, next) => {
  try {
  
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const { status, search, companyId } = req.query;

    const where = {
      ...(status && status !== 'all' && { status }),
      ...(companyId && { companyId: parseInt(companyId) }),
      ...(search && {
        OR: [
          { orderNumber: { contains: search } },
          { user: { name: { contains: search } } },
          { user: { email: { contains: search } } },
          { company: { name: { contains: search } } }
        ]
      })
    };

    const [orders, totalCount, globalStats] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: { select: { name: true, email: true } },
          company: { select: { name: true } },
          items: true,
          invoice: true 
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    
      prisma.order.aggregate({
        _sum: { total: true },
        _count: { _all: true },
        where: { status: { not: 'cancelled' } }
      })
    ]);


    const statusCounts = await prisma.order.groupBy({
      by: ['status'],
      _count: { _all: true }
    });

    res.json({
      success: true,
      data: orders.map(formatAdminOrder),
      meta: { total: totalCount, page, limit },
      stats: {
        totalRevenue: globalStats._sum.total || 0,
        totalOrders: globalStats._count._all,
        statusBreakdown: statusCounts
      }
    });
  } catch (e) {
    next(e);
  }
};

// PATCH /api/admin/orders/:id/status
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(id) },
      data: { status }
    });

    // envoit de mail pour plutard
    
    res.json({ success: true, data: updatedOrder });
  } catch (e) {
    next(e);
  }
};

// GET /api/admin/orders/:id/full-details
export const getAdminOrderDetails = async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        user: true,
        company: true,
        items: {
          include: {
            product: true,
            packageTier: true
          }
        },
        invoice: {
          include: {
            items: true,
            refunds: true,
            payments: true
          }
        }
      }
    });

    if (!order) return res.status(404).json({ error: "Order not found" });

    res.json({ success: true, data: order });
  } catch (e) {
    next(e);
  }
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