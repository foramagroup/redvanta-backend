import cron from "node-cron";
import prisma from "../config/prisma.js";
import { computeCrossSell } from "../services/crossSellService.js";

cron.schedule("0 4 * * *", async () => {
  const prods = await prisma.product.findMany();
  for (const p of prods) {
    const ids = await computeCrossSell(p.id, 6);
    await prisma.product.update({ where: { id: p.id }, data: { crossSell: ids } });
  }
  console.log("Cross-sell recomputed");
});
