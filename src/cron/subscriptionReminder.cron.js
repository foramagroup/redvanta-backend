// ═══════════════════════════════════════════════════════════
// src/cron/subscriptionReminder.cron.js
// Rappels d'expiration d'abonnement (J-7, J-3, J-1)
// Tourne tous les jours à 9h du matin
// ═══════════════════════════════════════════════════════════

import cron   from 'node-cron';
import prisma from '../config/database.js';
import { sendSubscriptionExpiryReminderEmail } from '../services/stripeSubscription.service.js';

const REMIND_DAYS = [7, 3, 1]; // Nombre de jours avant expiration

async function runSubscriptionReminders() {
  console.log('[REMINDER] 🔔 Vérification rappels d\'expiration...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let totalSent = 0;

  for (const days of REMIND_DAYS) {
    // Fenêtre : nextBillingDate dans exactement `days` jours (de minuit à minuit+1j)
    const windowStart = new Date(today);
    windowStart.setDate(windowStart.getDate() + days);
    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() + 1);

    const subscriptions = await prisma.subscription.findMany({
      where: {
        status:          { in: ['active', 'trialing'] },
        nextBillingDate: { gte: windowStart, lt: windowEnd },
      },
      include: {
        plan: {
          include: {
            translations: { take: 1, orderBy: { languageId: 'asc' } },
          },
        },
        company: true,
      },
    });

    if (subscriptions.length === 0) continue;

    console.log(`[REMINDER] 📅 J-${days} : ${subscriptions.length} abonnement(s) trouvé(s)`);

    for (const sub of subscriptions) {
      try {
        // Récupérer le propriétaire principal de la company
        const uc = await prisma.userCompany.findFirst({
          where:   { companyId: sub.companyId, isOwner: true },
          include: { user: true },
        });

        const user = uc?.user ?? await prisma.user.findFirst({
          where: { companies: { some: { companyId: sub.companyId } } },
        });

        if (!user) {
          console.warn(`[REMINDER] ⚠️ Aucun admin pour company ${sub.companyId}`);
          continue;
        }

        await sendSubscriptionExpiryReminderEmail(sub, user, sub.company, days);
        totalSent++;

        console.log(
          `[REMINDER] ✉️ Rappel J-${days} envoyé → ${user.email} (${sub.company.name})`
        );
      } catch (err) {
        console.error(
          `[REMINDER] ❌ Erreur rappel J-${days} subscription ${sub.id}:`,
          err.message
        );
      }
    }
  }

  console.log(`[REMINDER] ✅ Terminé. ${totalSent} rappel(s) envoyé(s).`);
}

// Tous les jours à 9h du matin
cron.schedule('0 9 * * *', runSubscriptionReminders);

export default function startSubscriptionReminderCron() {
  console.log('[REMINDER] ⏰ Subscription reminder cron démarré (0 9 * * *)');
  console.log('[REMINDER] 📅 Rappels J-7, J-3, J-1 avant expiration');
}
