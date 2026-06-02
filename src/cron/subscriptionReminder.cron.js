// ═══════════════════════════════════════════════════════════
// src/cron/subscriptionReminder.cron.js
// Rappels d'expiration d'abonnement
//   PRÉ-expiration  : J-7, J-3, J-1  (avant la date de renouvellement)
//   POST-expiration : J+0, J+3, J+7  (après la date d'expiration)
// Tourne tous les jours à minuit (00:00)
// ═══════════════════════════════════════════════════════════

import cron   from 'node-cron';
import prisma from '../config/database.js';
import {
  sendSubscriptionExpiryReminderEmail,
  sendSubscriptionOverdueEmail,
} from '../services/stripeSubscription.service.js';

const PRE_EXPIRY_DAYS  = [7, 3, 1]; // jours AVANT renouvellement
const POST_EXPIRY_DAYS = [0, 3, 7]; // jours APRÈS expiration

// ── Charge tous les owners en une seule requête ───────────────
// Évite le N+1 : 1 requête pour N subscriptions
async function getOwnersMap(companyIds) {
  const ucs = await prisma.userCompany.findMany({
    where:   { companyId: { in: companyIds }, isOwner: true },
    include: { user: true },
  });
  // Map companyId → user
  return new Map(ucs.map((uc) => [uc.companyId, uc.user]));
}

// ── PRÉ-expiration : J-7, J-3, J-1 ─────────────────────────
async function runPreExpiryReminders(today) {
  let sent = 0;

  for (const days of PRE_EXPIRY_DAYS) {
    // Fenêtre : nextBillingDate dans exactement `days` jours
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
        plan:    { include: { translations: { take: 1, orderBy: { languageId: 'asc' } } } },
        company: true,
      },
    });

    if (!subscriptions.length) continue;
    console.log(`[REMINDER] 📅 PRÉ J-${days} : ${subscriptions.length} abonnement(s)`);

    // 1 requête pour tous les owners (évite le N+1)
    const ownersMap = await getOwnersMap(subscriptions.map((s) => s.companyId));

    // Envoyer les emails par lots de 10 (évite de saturer le serveur SMTP)
    for (let i = 0; i < subscriptions.length; i += 10) {
      const batch = subscriptions.slice(i, i + 10);
      await Promise.allSettled(batch.map(async (sub) => {
        try {
          const user = ownersMap.get(sub.companyId);
          if (!user) { console.warn(`[REMINDER] ⚠️ Aucun admin company ${sub.companyId}`); return; }
          await sendSubscriptionExpiryReminderEmail(sub, user, sub.company, days);
          sent++;
          console.log(`[REMINDER] ✉️ J-${days} → ${user.email} (${sub.company.name})`);
        } catch (err) {
          console.error(`[REMINDER] ❌ Erreur J-${days} sub ${sub.id}:`, err.message);
        }
      }));
    }
  }

  return sent;
}

// ── POST-expiration : J+0, J+3, J+7 ─────────────────────────
async function runPostExpiryReminders(today) {
  let sent = 0;

  for (const days of POST_EXPIRY_DAYS) {
    // Fenêtre : nextBillingDate était il y a exactement `days` jours
    // J+0 → nextBillingDate est aujourd'hui (minuit → minuit+1j)
    // J+3 → nextBillingDate était il y a 3 jours
    const windowStart = new Date(today);
    windowStart.setDate(windowStart.getDate() - days);
    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() + 1);

    const subscriptions = await prisma.subscription.findMany({
      where: {
        status:          { in: ['past_due', 'canceled', 'paused', 'incomplete'] },
        nextBillingDate: { gte: windowStart, lt: windowEnd },
      },
      include: {
        plan:    { include: { translations: { take: 1, orderBy: { languageId: 'asc' } } } },
        company: true,
      },
    });

    if (!subscriptions.length) continue;
    const label = days === 0 ? 'J+0 (jour même)' : `J+${days}`;
    console.log(`[REMINDER] 🚨 POST ${label} : ${subscriptions.length} abonnement(s) expiré(s)`);

    const ownersMap = await getOwnersMap(subscriptions.map((s) => s.companyId));

    for (let i = 0; i < subscriptions.length; i += 10) {
      const batch = subscriptions.slice(i, i + 10);
      await Promise.allSettled(batch.map(async (sub) => {
        try {
          const user = ownersMap.get(sub.companyId);
          if (!user) { console.warn(`[REMINDER] ⚠️ Aucun admin company ${sub.companyId}`); return; }
          await sendSubscriptionOverdueEmail(sub, user, sub.company, days);
          sent++;
          console.log(`[REMINDER] ✉️ POST J+${days} → ${user.email} (${sub.company.name})`);
        } catch (err) {
          console.error(`[REMINDER] ❌ Erreur POST J+${days} sub ${sub.id}:`, err.message);
        }
      }));
    }
  }

  return sent;
}

// ── Point d'entrée principal ─────────────────────────────────
async function runSubscriptionReminders() {
  console.log('[REMINDER] 🔔 Vérification rappels abonnements...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [preSent, postSent] = await Promise.all([
    runPreExpiryReminders(today),
    runPostExpiryReminders(today),
  ]);

  console.log(`[REMINDER] ✅ Terminé. Pré: ${preSent} rappel(s) · Post: ${postSent} relance(s).`);
}

// Tous les jours à minuit (00:00)
cron.schedule('0 0 * * *', runSubscriptionReminders);

export default function startSubscriptionReminderCron() {
  console.log('[REMINDER] ⏰ Cron démarré (0 0 * * * — minuit)');
  console.log('[REMINDER] 📅 Pré-expiration : J-7, J-3, J-1');
  console.log('[REMINDER] 🚨 Post-expiration : J+0, J+3, J+7');
}
