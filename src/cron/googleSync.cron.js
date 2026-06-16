// Sync des avis Google Business Profile — toutes les 15 minutes
// Ce cron tourne côté serveur : fonctionne même si aucun onglet n'est ouvert.

import cron from "node-cron";
import prisma from "../config/database.js";
import { runSync } from "../controllers/googleSync.controller.js";

export default function startGoogleSyncCron() {
  // Toutes les 15 minutes
  cron.schedule("*/15 * * * *", async () => {
    console.log("[CRON] 🔄 Google sync — démarrage...");

    // Récupère toutes les companies avec une connexion Google active
    const connections = await prisma.googleConnection.findMany({
      where: { needsReauth: false },
      select: { companyId: true },
    }).catch((err) => {
      console.error("[CRON] ❌ Erreur lecture connections Google:", err.message);
      return [];
    });

    if (connections.length === 0) {
      console.log("[CRON] Google sync — aucune company connectée.");
      return;
    }

    console.log(`[CRON] Google sync — ${connections.length} company(ies) à synchroniser.`);

    const results = await Promise.allSettled(
      connections.map(({ companyId }) =>
        runSync(companyId).then((r) => ({ companyId, ...r }))
      )
    );

    let ok = 0, failed = 0, totalNew = 0;
    for (const r of results) {
      if (r.status === "fulfilled") {
        ok++;
        totalNew += r.value.newReviews ?? 0;
      } else {
        failed++;
        console.error(`[CRON] ❌ Sync échoué (company ${results.indexOf(r)}):`, r.reason?.message);
      }
    }

    console.log(`[CRON] ✅ Google sync terminé — ${ok} ok / ${failed} échoués / ${totalNew} nouveaux avis.`);
  });

  console.log("[CRON] ✅ Google sync cron démarré (toutes les 15 minutes).");
}
