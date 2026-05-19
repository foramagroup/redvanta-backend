// src/services/alertTrigger.service.js
// Fire-and-forget helper — appelé depuis nfc.controller.js après chaque review/feedback
// Ne lève jamais d'exception vers l'appelant.

import prisma     from "../config/database.js";
import { sendEmail } from "../config/mailer.js";

/**
 * @param {number} companyId
 * @param {"negative"|"review"|"summary"} type
 * @param {string} title
 * @param {string} message
 */
export async function fireAlert(companyId, type, title, message) {
  try {
    const settings = await prisma.alertSettings.findUnique({ where: { companyId } });
    if (!settings) return;

    // Vérifie que ce type d'alerte est activé
    if (type === "negative" && !settings.negativeAlert) return;
    if (type === "review"   && !settings.reviewAlert)   return;

    // Enregistre dans l'historique
    await prisma.alertNotification.create({
      data: { companyId, type, title, message },
    });

    // Email
    if (settings.emailNotif) {
      const company = await prisma.company.findUnique({
        where:  { id: companyId },
        select: { name: true },
      });
      await sendEmail({
        to:      settings.emailNotif,
        subject: `[${company?.name ?? "Alert"}] ${title}`,
        html:    `<p>${message}</p><p style="color:#888;font-size:12px">Krootal — notifications automatiques</p>`,
        text:    message,
      });
    }

    // Slack webhook (optionnel)
    if (settings.slackUrl) {
      fetch(settings.slackUrl, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text: `*${title}*\n${message}` }),
      }).catch(() => {});
    }
  } catch (e) {
    console.error("[alertTrigger] error:", e.message);
  }
}
