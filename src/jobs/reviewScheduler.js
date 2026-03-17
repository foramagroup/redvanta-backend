import cron from "node-cron";
import prisma from "../prismaClient.js";
import { sendEmail } from "../services/emailService.js";

export function startReviewsScheduler() {
  cron.schedule("0 9 * * *", async () => {
    const from = new Date(); from.setDate(from.getDate() - 2);
    const orders = await prisma.order.findMany({ where: { status: "paid", createdAt: { gte: from } }});
    for (const order of orders) {
      if (!order.customerEmail) continue;
      await sendEmail({ to: order.customerEmail, subject: "Merci pour votre achat — Laissez un avis", html: `<a href="${process.env.URL_DEV_FRONTEND}/review/${order.id}">Laisser un avis</a>` });
    }
  });
}
