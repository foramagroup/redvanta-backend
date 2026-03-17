import prisma from "../prismaClient.js";
import { sendEmail } from "../services/emailService.js";

export async function processQueuedEmails() {
  const items = await prisma.emailQueue.findMany({ where: { processed: false }, take: 20 });
  for (const item of items) {
    try {
      await sendEmail({ to: item.to, subject: item.subject, html: item.html });
      await prisma.emailQueue.update({ where: { id: item.id }, data: { processed: true, processedAt: new Date() } });
    } catch (err) {
      await prisma.emailQueue.update({ where: { id: item.id }, data: { attempts: item.attempts + 1, lastError: String(err) }});
    }
  }
}
