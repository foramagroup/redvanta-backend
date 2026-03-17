/**
 * cron.js
 * Déclaration des tâches planifiées (reviews invites, retries, workers).
 * Ce fichier est importé au démarrage (server.js).
 */

import cron from 'node-cron';
import prisma from '../config/database.js';
import { sendEmail } from './mailer.js'; // wrapper
import { processQueuedEmails } from '../jobs/emailWorker.js';

function startReviewInvites() {
  // every day at 09:00
  cron.schedule('0 9 * * *', async () => {
    console.log('[cron] Running daily review invites');
    try {
      const from = new Date();
      from.setDate(from.getDate() - 2); // orders from 2 days ago
      const orders = await prisma.order.findMany({ where: { status: 'paid', createdAt: { gte: from } } });
      for (const o of orders) {
        if (!o.customerEmail) continue;
        const url = `${process.env.URL_PROD_FRONTEND || process.env.URL_DEV_FRONTEND}/leave-review?order=${o.id}`;
        const text = `Bonjour,\nMerci pour votre commande. Laissez un avis ici: ${url}`;
        await sendEmail({ to: o.customerEmail, subject: 'Laissez-nous un avis', text });
      }
    } catch (err) {
      console.error('[cron] review invites error', err);
    }
  });
}

function startQueueProcessors() {
  // every minute process queued emails (example)
  cron.schedule('* * * * *', async () => {
    try {
      await processQueuedEmails();
    } catch (err) {
      console.error('[cron] processQueuedEmails error', err);
    }
  });
}

startReviewInvites();
startQueueProcessors();

console.log('[cron] Cron tasks started');
