import prisma from "../config/prisma.js";

/**
 * computeCrossSell(productId):
 * - find same category
 * - prefer items frequently purchased together (orders table)
 * - fallback top-selling items
 */
export async function computeCrossSell(productId, limit = 4) {
  const prod = await prisma.product.findUnique({ where: { id: productId } });
  if (!prod) return [];

  // 1) products frequently bought in same orders
  const raw = await prisma.$queryRaw`
    SELECT op.productId as id, COUNT(*) as cnt
    FROM OrderItem op
    JOIN "Order" o ON op.orderId = o.id
    WHERE o.id IN (SELECT o2.id FROM "Order" o2 JOIN OrderItem oi ON oi.orderId = o2.id WHERE oi.productId = ${productId})
      AND op.productId != ${productId}
    GROUP BY op.productId
    ORDER BY cnt DESC
    LIMIT ${limit}
  `;

  if (raw.length >= limit) return raw.map(r => r.id);

  // fallback: same category top sales
  const fallback = await prisma.product.findMany({
    where: { category: prod.category, id: { not: productId } },
    orderBy: { sales: "desc" },
    take: limit
  });

  return [...raw.map(r=>r.id), ...fallback.map(f=>f.id)].slice(0, limit);
}
