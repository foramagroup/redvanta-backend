// src/services/reviewAutomationService.js
import { sendEmail } from "./emailService.js";

export const sendReviewRequest = async (user, order) => {
  const url = `${process.env.FRONTEND_URL}/review/${order.id}`;

  await sendEmail({
    to: user.email,
    subject: "Merci pour votre achat ! Laissez-nous un avis",
    html: `
      <h2>Merci pour votre confiance</h2>
      <p>Votre avis compte énormément.</p>
      <a href="${url}">Laisser un avis</a>
    `
  });
};
