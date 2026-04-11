import prisma from "../config/database.js";
import { formatOrder } from "../services/order.service.js";


function getActiveCompanyId(req) {
  const id = req.user.companyId; 
  if (!id) {
    throw Object.assign(new Error("Aucune entreprise sélectionnée ou active"), { status: 403 });
  }
  return parseInt(id);
}

export const listMyOrders = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const companyId = getActiveCompanyId(req);
    
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    const { status, search } = req.query;


    const where = {
      userId: userId,
      companyId: companyId,
      ...(status && status !== 'all' && { status: status }),
      ...(search && {
        OR: [
          { orderNumber: { contains: search } },
          { items: { some: { product: { name: { contains: search } } } } }
        ]
      })
    };

    const [orders, totalCount, statsData] = await Promise.all([
      // Récupération des données paginées
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: true,
              packageTier: true,
              cardType: true
            }
          },
        payments: true,
        invoice: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
      
      prisma.order.groupBy({
        by: ['status'],
        where: { userId, companyId },
        _count: { _all: true },
        _sum: { total: true }
      })
    ]);

  
    const stats = {
      total: statsData.reduce((acc, curr) => acc + curr._count._all, 0),
      active: statsData
        .filter(s => ["paid", "production", "shipped"].includes(s.status))
        .reduce((acc, curr) => acc + curr._count._all, 0),
      delivered: statsData.find(s => s.status === "delivered")?._count._all || 0,
      totalSpent: statsData
        .filter(s => s.status !== "cancelled")
        .reduce((acc, curr) => acc + (curr._sum.total || 0), 0),
    };

  
    res.json({
      success: true,
      data: orders.map(formatOrder),
      meta: {
        total: totalCount,
        page,
        last_page: Math.ceil(totalCount / limit),
        limit
      },
      stats
    });
  } catch (e) {
    next(e);
  }
};



// GET /api/customer/orders/:orderNumber
export const getOrderDetails = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;
    const userId = req.user.userId;
    const companyId = getActiveCompanyId(req);

    const order = await prisma.order.findFirst({
      where: {
        orderNumber: orderNumber,
        userId: userId,
        companyId: companyId
      },
      include: {
        items: {
          include: {
            product: true,
            packageTier: true,
            cardType: true
          }
        },
        company: true
      }
    });

    if (!order) {
      return res.status(404).json({ success: false, error: "Commande introuvable dans cette entreprise" });
    }
    res.json({
      success: true,
      data: formatOrder(order)
    });
  } catch (e) {
    next(e);
  }
};

