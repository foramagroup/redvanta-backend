// src/cron/weeklyAlerts.cron.js
// Tourne chaque jour à 08h00 et envoie le résumé de performance
// selon la préférence weeklySummary de chaque company.

import cron    from "node-cron";
import prisma  from "../config/database.js";
import { sendEmail } from "../config/mailer.js";

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

async function sendWeeklySummaries() {
  const today = DAY_NAMES[new Date().getDay()]; // ex. "monday"

  // Récupère toutes les companies dont le résumé doit partir aujourd'hui
  const settingsList = await prisma.alertSettings.findMany({
    where: {
      emailNotif:    { not: null },
      weeklySummary: { in: ["daily", today] },
    },
    select: {
      companyId:    true,
      emailNotif:   true,
      weeklySummary: true,
    },
  });

  if (!settingsList.length) return;

  const since = new Date();
  since.setDate(since.getDate() - 7);

  for (const s of settingsList) {
    try {
      const [company, reviewCount, avgRating, feedbackCount] = await Promise.all([
        prisma.company.findUnique({ where: { id: s.companyId }, select: { name: true } }),
        prisma.review.count({ where: { companyId: s.companyId, createdAt: { gte: since } } }),
        prisma.review.aggregate({ where: { companyId: s.companyId, createdAt: { gte: since } }, _avg: { rating: true } }),
        prisma.feedback.count({ where: { companyId: s.companyId, createdAt: { gte: since } } }),
      ]);

      const avg = avgRating._avg.rating ? avgRating._avg.rating.toFixed(1) : "N/A";
      const label = s.weeklySummary === "daily" ? "Daily" : "Weekly";
      const title = `${label} Performance Summary`;
      const message = `In the last 7 days: ${reviewCount} reviews (avg ${avg}★), ${feedbackCount} internal feedbacks.`;

      // Enregistre dans l'historique
      await prisma.alertNotification.create({
        data: { companyId: s.companyId, type: "summary", title, message },
      });

      // Envoie l'email
      await sendEmail({
        to:      s.emailNotif,
        subject: `[${company?.name ?? "Krootal"}] ${title}`,
        html: `
          <h2 style="color:#E10600">${title}</h2>
          <p>Here's your performance summary for the last 7 days:</p>
          <table style="border-collapse:collapse;width:100%;max-width:400px">
            <tr>
              <td style="padding:8px;border:1px solid #eee">Reviews collected</td>
              <td style="padding:8px;border:1px solid #eee;font-weight:bold">${reviewCount}</td>
            </tr>
            <tr>
              <td style="padding:8px;border:1px solid #eee">Average rating</td>
              <td style="padding:8px;border:1px solid #eee;font-weight:bold">${avg} ★</td>
            </tr>
            <tr>
              <td style="padding:8px;border:1px solid #eee">Internal feedbacks</td>
              <td style="padding:8px;border:1px solid #eee;font-weight:bold">${feedbackCount}</td>
            </tr>
          </table>
          <p style="color:#888;font-size:12px;margin-top:24px">Krootal — automated alerts</p>
        `,
        text: message,
      });

      console.log(`[weeklyAlerts] Summary sent to ${s.emailNotif} (company ${s.companyId})`);
    } catch (e) {
      console.error(`[weeklyAlerts] Failed for company ${s.companyId}:`, e.message);
    }
  }
}

export function startWeeklyAlertsCron() {
  // Tous les jours à 08h00
  cron.schedule("0 8 * * *", () => {
    console.log("[weeklyAlerts] Running daily check…");
    sendWeeklySummaries().catch((e) => console.error("[weeklyAlerts] cron error:", e.message));
  });
  console.log("[weeklyAlerts] Cron scheduled — daily at 08:00");
}
