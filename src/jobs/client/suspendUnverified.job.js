// src/jobs/suspendUnverified.job.js
// Alternative Node.js au MySQL Event pour suspendre les comptes non confirmés
// À lancer avec node-cron au démarrage de l'app

import cron   from "node-cron";
import prisma  from "../../config/database.js";

// Toutes les 6 heures — suspendre les companies dont l'admin
// n'a pas confirmé son email dans les 48h
export function startSuspendUnverifiedJob() {
  cron.schedule("0 */6 * * *", async () => {
    console.log("[job] Vérification des comptes non confirmés...");
    try {
      const deadline = new Date(Date.now() - 48 * 60 * 60 * 1000); // il y a 48h

      // Trouver les UserCompany dont le user n'a pas confirmé son email
      // et dont la company est encore active
      //
      // ⚠️  RÈGLE IMPORTANTE :
      //   - Companies créées par le SUPERADMIN → emailVerifyToken = null dès le départ
      //     (le superadmin crée l'admin manuellement, pas de flux de confirmation)
      //   - Companies créées par le CLIENT via /api/auth/signup → emailVerifyToken défini
      //     (le token est effacé seulement après confirmation)
      //
      // On ne suspend QUE les comptes issus du signup client :
      //   emailVerifiedAt IS NULL  → pas encore confirmé
      //   emailVerifyExp  IS NOT NULL → le token de vérification avait une date d'expiration
      //                                 (preuve que c'est un compte client, pas superadmin)
      const links = await prisma.userCompany.findMany({
        where: {
          isOwner: true,
          user: {
            emailVerifiedAt: null,              // pas encore confirmé
            emailVerifyExp:  { not: null },     // ← UNIQUEMENT les comptes client signup
            createdAt:       { lt: deadline },  // créé il y a plus de 48h
          },
          company: {
            status: "active",
          },
        },
        select: { companyId: true },
      });

      if (!links.length) {
        console.log("[job] Aucun compte à suspendre.");
        return;
      }

      const companyIds = links.map((l) => l.companyId);

      const { count } = await prisma.company.updateMany({
        where: { id: { in: companyIds }, status: "active" },
        data:  { status: "suspended" },
      });

      console.log(`[job] ${count} entreprise(s) suspendue(s) pour email non confirmé.`);
    } catch (err) {
      console.error("[job] Erreur suspendUnverified:", err.message);
    }
  });

  console.log("[job] suspendUnverified démarré (toutes les 6h)");
}

// ─── Intégration dans app.js ──────────────────────────────────
// import { startSuspendUnverifiedJob } from "./src/jobs/suspendUnverified.job.js";
// startSuspendUnverifiedJob();
// npm install node-cron