// backend/src/config/payoutCron.js
import cron from "node-cron";
import prisma from "../prismaClient.js";
import { approveAndProcessPayout } from "../services/payoutService.js";

/**
 * Cron job: toutes les nuits à 02:30 -> traite les payouts "approved" ou "scheduled" dont processedAt is null
 * Attention: limiter le nombre par ex 20 par run pour éviter bursts.
 */
cron.schedule("30 2 * * *", async () => {
  console.log("[payoutCron] running scheduled payout job");
  try {
    // find approved/processing requests or scheduled with scheduledDate <= now (if you added scheduledDate)
    const items = await prisma.payoutRequest.findMany({
      where: { status: { in: ["approved", "pending"] } },
      orderBy: { requestedAt: "asc" },
      take: 20,
      include: { affiliate: true }
    });

    for (const p of items) {
      try {
        // Only process those we can (affiliate has stripeAccountId)
        if (!p.affiliate || !p.affiliate.stripeAccountId) {
          // skip or mark as approved for manual payment later
          await prisma.payoutRequest.update({ where: { id: p.id }, data: { status: "approved" }});
          continue;
        }
        console.log(`[payoutCron] processing payout ${p.id} -> affiliate ${p.affiliateId}`);
        await approveAndProcessPayout(p.id);
      } catch (err) {
        console.error(`[payoutCron] error processing payout ${p.id}`, err);
        // mark failed
        await prisma.payoutRequest.update({ where: { id: p.id }, data: { status: "failed" }});
      }
    }

  } catch (err) {
    console.error("[payoutCron] failed", err);
  }
});
