// ═══════════════════════════════════════════════════════════
// src/cron/blogScheduled.cron.js
// Publication automatique des articles planifiés (toutes les 5 min)
// ═══════════════════════════════════════════════════════════

import cron from "node-cron";
import prisma from "../config/database.js";

// Toutes les 5 minutes
cron.schedule("*/5 * * * *", async () => {
  try {
    const now = new Date();

    const scheduled = await prisma.blogArticle.findMany({
      where: {
        published:  false,
        scheduledAt: { lte: now },
      },
      select: { id: true, slug: true },
    });

    if (!scheduled.length) return;

    await prisma.blogArticle.updateMany({
      where: { id: { in: scheduled.map((a) => a.id) } },
      data:  { published: true, publishedAt: now, scheduledAt: null },
    });

    console.log(`[CRON] 📅 ${scheduled.length} article(s) publiés automatiquement:`,
      scheduled.map((a) => a.slug).join(", "));
  } catch (err) {
    console.error("[CRON] blogScheduled error:", err.message);
  }
});
