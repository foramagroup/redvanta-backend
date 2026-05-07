// ═══════════════════════════════════════════════════════════
// src/cron/billing.cron.js
// Facturation récurrente automatique (tous les jours à 2h)
// ═══════════════════════════════════════════════════════════

import cron from 'node-cron';
import prisma from '../config/database.js';
import { getStripe } from '../services/Stripe.service.js';
import {
  getDefaultPaymentMethod,
  calculatePeriodDates,
  createSubscriptionInvoice,
  sendSubscriptionWelcomeEmail,
  sendSubscriptionPaymentFailedEmail
  
} from '../services/stripeSubscription.service.js';

// Tous les jours à 2h du matin
cron.schedule('0 2 * * *', async () => {
  console.log('[CRON] 🕐 Démarrage facturation récurrente...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    // Récupérer subscriptions à facturer
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: 'active',
        nextBillingDate: { lte: today },
      },
      include: {
        plan: true,
        company: true,
        addons: { include: { addon: true }, where: { status: 'active' } },
      },
    });

    console.log(`[CRON] 📋 ${subscriptions.length} abonnement(s) à facturer`);

    for (const sub of subscriptions) {
      try {
        // Vérifier carte enregistrée
        const paymentMethod = await getDefaultPaymentMethod(sub.stripeCustomerId);

        if (!paymentMethod) {
          console.error(`[CRON] ❌ Pas de carte: subscription ${sub.id} (company ${sub.company.name})`);
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: 'past_due' },
          });
            const user = await prisma.user.findFirst({
                where: { companyId: sub.companyId, isAdmin: true },
            });
            if (user) {
                await sendSubscriptionPaymentFailedEmail(
                sub,
                user,
                sub.company,
                "No payment method on file"
                );
            }
          continue;
        }

        const stripe = await getStripe();
        // Charger carte (PaymentIntent one-time)
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(sub.totalAmount * 100),
          currency: 'eur',
          customer: sub.stripeCustomerId,
          payment_method: paymentMethod.id,
          off_session: true,
          confirm: true,
          description: `${sub.plan.name} - ${sub.interval} (récurrent)`,
          metadata: {
            type: 'subscription_recurring',
            subscriptionId: String(sub.id),
            companyId: String(sub.companyId),
          },
        });

        console.log(`[CRON] 💳 PaymentIntent créé: ${paymentIntent.id} - €${sub.totalAmount}`);

        // Calculer prochaine période
        const periods = calculatePeriodDates(sub.interval, sub.nextBillingDate);

        // Récupérer admin
        const user = await prisma.user.findFirst({
          where: { companyId: sub.companyId, isAdmin: true },
        });

        if (!user) {
          console.error(`[CRON] ❌ Aucun admin trouvé pour company ${sub.companyId}`);
          continue;
        }

        // Récupérer charge info
        const charges = await stripe.charges.list({ payment_intent: paymentIntent.id, limit: 1 });
        const charge = charges.data[0];

        const methodLabel = charge?.payment_method_details?.card
          ? `${charge.payment_method_details.card.brand} •••• ${charge.payment_method_details.card.last4}`
          : "Stripe";
        const last4 = charge?.payment_method_details?.card?.last4 ?? null;
        const brand = charge?.payment_method_details?.card?.brand ?? null;
        const stripeChargeId = charge?.id ?? null;

        // Transaction
        const result = await prisma.$transaction(async (tx) => {
          // 1. BillingHistory
          const billingHistory = await tx.billingHistory.create({
            data: {
              subscriptionId: sub.id,
              baseAmount: sub.baseAmount,
              addonsAmount: sub.addonsAmount,
              totalAmount: sub.totalAmount,
              periodStart: sub.currentPeriodStart,
              periodEnd: sub.currentPeriodEnd,
              status: 'paid',
              paidAt: new Date(),
              stripePaymentIntentId: paymentIntent.id,
              paymentMethod: methodLabel,
            },
          });

          // 2. Invoice
          const invoice = await createSubscriptionInvoice({
            subscription: sub,
            billingHistory,
            user,
            company: sub.company,
            paymentMethod: methodLabel,
            orderId: null,
          });

          // 3. Invoice → paid
          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              status: 'paid',
              paidAt: new Date(),
              paidAmount: sub.totalAmount,
              paymentMethod: methodLabel,
            },
          });

          // 4. Payment record
          await tx.payment.create({
            data: {
              invoiceId: invoice.id,
              companyId: sub.companyId,
              userId: user.id,
              amount: sub.totalAmount,
              currency: 'EUR',
              exchangeRate: 1,
              displayAmount: sub.totalAmount,
              method: 'card',
              methodLabel,
              last4,
              brand,
              stripePaymentIntentId: paymentIntent.id,
              stripeChargeId,
              status: 'completed',
              paidAt: new Date(),
            },
          });

          // 5. Subscription → next billing
          await tx.subscription.update({
            where: { id: sub.id },
            data: {
              currentPeriodStart: periods.currentPeriodStart,
              currentPeriodEnd: periods.currentPeriodEnd,
              nextBillingDate: periods.nextBillingDate,
              lastBillingDate: new Date(),
            },
          });

          return { billingHistory, invoice };
        });

        // Email welcome
        await sendSubscriptionWelcomeEmail(sub, user, sub.company, result.invoice);

        console.log(`[CRON] ✅ Facturé: subscription ${sub.id} (${sub.company.name}) - €${sub.totalAmount}`);

      } catch (error) {
        console.error(`[CRON] ❌ Erreur subscription ${sub.id} (${sub.company?.name}):`, error.message);

            // Marquer past_due
            await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: 'past_due' },
            });

            const user = await prisma.user.findFirst({
                where: { companyId: sub.companyId, isAdmin: true },
            });
            if (user) {
                await sendSubscriptionPaymentFailedEmail(
                sub,
                user,
                sub.company,
                error.message
                );
            }
      }
    }
    console.log('[CRON] ✅ Facturation récurrente terminée');
  } catch (error) {
    console.error('[CRON] ❌ Erreur globale:', error);
  }
});

// ═══════════════════════════════════════════════════════════
// Export fonction pour démarrer le cron
// ═══════════════════════════════════════════════════════════
export default function startBillingCron() {
  console.log('[CRON] ⏰ Billing cron job démarré (0 2 * * *)');
  console.log('[CRON] 📅 Facturation automatique tous les jours à 2h du matin');
}