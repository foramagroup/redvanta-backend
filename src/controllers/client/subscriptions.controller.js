// ═══════════════════════════════════════════════════════════
// src/controllers/subscription.controller.js
// ═══════════════════════════════════════════════════════════

import prisma from "../../config/database.js";
import { getStripe, getWebhookSecret } from "../../services/Stripe.service.js";
import {
  getOrCreateStripeCustomer,
  getDefaultPaymentMethod,
  calculatePeriodDates,
  calculateSubscriptionAmounts,
  generateSubscriptionOrderNumber,
  createSubscriptionInvoice,
  sendSubscriptionWelcomeEmail,
  sendSubscriptionPendingEmail,
  formatSubscription,
  chargeSubscription,
} from "../../services/stripeSubscription.service.js";

function getCompanyId(req) {
  const id = req.user?.companyId;
  if (!id) throw Object.assign(new Error(req.t("errors.forbidden")), { status: 403 });
  return parseInt(id);
}

// ═══════════════════════════════════════════════════════════
// src/controllers/client/subscriptions.controller.js
// ═══════════════════════════════════════════════════════════

export const listPlans = async (req, res, next) => {
  try {
    const plans = await prisma.planSetting.findMany({
      where: { status: "Active" },
      orderBy: { displayOrder: "asc" },
    });

    res.json({
      success: true,
      data: plans.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: Number(p.price),
        annual: Number(p.annual),
        // ⚠️ PARSER LES FEATURES SI STRING
        features: typeof p.features === 'string' 
          ? JSON.parse(p.features) 
          : (p.features || []),
        apiLimit: p.apiLimit,
        smsLimit: p.smsLimit,
        locationLimit: p.locationLimit,
        userLimit: p.userLimit,
        trialDays: p.trialDays,
        isPopular: p.isPopular,
        isDefault: p.isDefault,
      })),
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// GET /api/subscriptions/current
// ═══════════════════════════════════════════════════════════
export const getCurrentSubscription = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);

    const subscription = await prisma.subscription.findUnique({
      where: { companyId },
      include: {
        plan: true,
        addons: { include: { addon: true } },
      },
    });

    if (!subscription) {
      return res.json({ success: true, data: null });
    }

    res.json({
      success: true,
      data: formatSubscription(subscription),
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// POST /api/subscriptions/checkout
// Créer Order + Subscription + BillingHistory + Invoice
// STRIPE: status pending (confirmé via webhook)
// MANUAL: status unpaid (confirmé par superadmin)
// ═══════════════════════════════════════════════════════════

export const checkoutSubscription = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const companyId = getCompanyId(req);
    
    const {
      planId,
      interval = "monthly",
      paymentMethod,
      paymentMethodId,
    } = req.body;

    // Validation
    if (!planId) {
      return res.status(422).json({ success: false, error: req.t("subscription.plan_id_required") });
    }

    const isStripe = paymentMethod === "stripe";
    const isManual = paymentMethod === "manual";

    if (!isStripe && !isManual) {
      return res.status(422).json({
        success: false,
        error: req.t("order.invalid_payment_method")
      });
    }

    if (!["monthly", "yearly"].includes(interval)) {
      return res.status(422).json({ success: false, error: req.t("subscription.invalid_interval") });
    }

    // Méthode manuelle
    let manualMethod = null;
    if (isManual) {
      if (!paymentMethodId) {
        return res.status(422).json({ success: false, error: req.t("order.payment_method_id_required") });
      }

      manualMethod = await prisma.manualPaymentMethod.findFirst({
        where: { id: parseInt(paymentMethodId), status: "Active" },
      });

      if (!manualMethod) {
        return res.status(422).json({ success: false, error: req.t("subscription.invalid_manual_method") });
      }
    }

    // Charger plan
    const plan = await prisma.planSetting.findUnique({
      where: { id: parseInt(planId) },
    });

    if (!plan || plan.status !== "Active") {
      return res.status(404).json({ success: false, error: req.t("subscription.plan_not_found") });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const company = await prisma.company.findUnique({ where: { id: companyId } });

    // Vérifier abonnement existant
    const existingSub = await prisma.subscription.findUnique({
      where: { companyId },
    });

    // if (existingSub) {
    //   return res.status(422).json({
    //     success: false,
    //     error: req.t("subscription.already_exists"),
    //   });
    // }

    // Calculer montants
    const amounts = calculateSubscriptionAmounts(plan, interval, []);
    const periods = calculatePeriodDates(interval, new Date());

    // ═══════════════════════════════════════════════════════════
    // STRIPE
    // ═══════════════════════════════════════════════════════════
    if (isStripe) {
      const stripe = await getStripe();

      // Créer/récupérer customer
      const customer = await getOrCreateStripeCustomer(user, company);

      const savedCard = await getDefaultPaymentMethod(customer.id);

      if (!savedCard) {
        // Première souscription : aucune carte enregistrée.
        // On crée un PaymentIntent avec setup_future_usage pour que le paiement
        // et l'enregistrement de la carte se fassent en une seule étape.
        const orderNumber = await generateSubscriptionOrderNumber();

        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amounts.totalAmount * 100),
          currency: 'eur',
          customer: customer.id,
          automatic_payment_methods: { enabled: true },
          setup_future_usage: 'off_session',
          metadata: {
            type: 'subscription',
            companyId: String(companyId),
            userId: String(userId),
            planId: String(planId),
            interval,
            orderNumber,
          },
        });

        await prisma.$transaction(async (tx) => {
          await tx.order.create({
            data: {
              userId,
              companyId,
              orderNumber,
              status: "pending",
              subtotal: amounts.totalAmount,
              shippingCost: 0,
              total: amounts.totalAmount,
              currency: "EUR",
              exchangeRate: 1,
              methodPayment: "Stripe",
              stripePaymentIntentId: paymentIntent.id,
              stripeClientSecret: paymentIntent.client_secret,
            },
          });

          await tx.subscription.upsert({
            where: { companyId },
            create: {
              companyId,
              planId: plan.id,
              status: "incomplete",
              interval,
              baseAmount: amounts.baseAmount,
              addonsAmount: amounts.addonsAmount,
              totalAmount: amounts.totalAmount,
              currentPeriodStart: periods.currentPeriodStart,
              currentPeriodEnd: periods.currentPeriodEnd,
              nextBillingDate: periods.nextBillingDate,
              stripeCustomerId: customer.id,
            },
            update: {
              planId: plan.id,
              status: "incomplete",
              interval,
              baseAmount: amounts.baseAmount,
              addonsAmount: amounts.addonsAmount,
              totalAmount: amounts.totalAmount,
              currentPeriodStart: periods.currentPeriodStart,
              currentPeriodEnd: periods.currentPeriodEnd,
              nextBillingDate: periods.nextBillingDate,
              stripeCustomerId: customer.id,
            },
          });

          const subscription = await tx.subscription.findUnique({ where: { companyId } });

          await tx.billingHistory.create({
            data: {
              subscriptionId: subscription.id,
              baseAmount: amounts.baseAmount,
              addonsAmount: amounts.addonsAmount,
              totalAmount: amounts.totalAmount,
              periodStart: periods.currentPeriodStart,
              periodEnd: periods.currentPeriodEnd,
              status: "pending",
              stripePaymentIntentId: paymentIntent.id,
              paymentMethod: "Stripe",
            },
          });
        });

        return res.json({
          success: true,
          clientSecret: paymentIntent.client_secret,
          message: req.t("subscription.confirm_payment"),
          data: {
            orderNumber,
            totalAmount: amounts.totalAmount,
            status: "pending",
          },
        });
      }

      const orderNumber = await generateSubscriptionOrderNumber();

      // Créer PaymentIntent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amounts.totalAmount * 100),
        currency: 'eur',
        customer: customer.id,
        payment_method: savedCard.id,
        automatic_payment_methods: { enabled: true },
        metadata: {
          type: 'subscription',
          companyId: String(companyId),
          userId: String(userId),
          planId: String(planId),
          interval,
          orderNumber,
        },
      });

      // Créer Order + Subscription + BillingHistory (status pending)
      await prisma.$transaction(async (tx) => {
        // 1. Order
        await tx.order.create({
          data: {
            userId,
            companyId,
            orderNumber,
            status: "pending",
            subtotal: amounts.totalAmount,
            shippingCost: 0,
            total: amounts.totalAmount,
            currency: "EUR",
            exchangeRate: 1,
            methodPayment: "Stripe",
            stripePaymentIntentId: paymentIntent.id,
            stripeClientSecret: paymentIntent.client_secret,
          },
        });

        // 2. Subscription (upsert : peut déjà exister depuis la phase !savedCard)
        await tx.subscription.upsert({
          where: { companyId },
          create: {
            companyId,
            planId: plan.id,
            status: "incomplete",
            interval,
            baseAmount: amounts.baseAmount,
            addonsAmount: amounts.addonsAmount,
            totalAmount: amounts.totalAmount,
            currentPeriodStart: periods.currentPeriodStart,
            currentPeriodEnd: periods.currentPeriodEnd,
            nextBillingDate: periods.nextBillingDate,
            stripeCustomerId: customer.id,
          },
          update: {
            planId: plan.id,
            status: "incomplete",
            interval,
            baseAmount: amounts.baseAmount,
            addonsAmount: amounts.addonsAmount,
            totalAmount: amounts.totalAmount,
            currentPeriodStart: periods.currentPeriodStart,
            currentPeriodEnd: periods.currentPeriodEnd,
            nextBillingDate: periods.nextBillingDate,
            stripeCustomerId: customer.id,
          },
        });

        // 3. BillingHistory
        const subscription = await tx.subscription.findUnique({
          where: { companyId },
        });

        await tx.billingHistory.create({
          data: {
            subscriptionId: subscription.id,
            baseAmount: amounts.baseAmount,
            addonsAmount: amounts.addonsAmount,
            totalAmount: amounts.totalAmount,
            periodStart: periods.currentPeriodStart,
            periodEnd: periods.currentPeriodEnd,
            status: "pending",
            stripePaymentIntentId: paymentIntent.id,
            paymentMethod: "Stripe",
          },
        });
      });

      return res.json({
        success: true,
        clientSecret: paymentIntent.client_secret,
        message: req.t("subscription.confirm_payment"),
        data: {
          orderNumber,
          totalAmount: amounts.totalAmount,
          status: "pending",
        },
      });
    }

    // ═══════════════════════════════════════════════════════════
    // MANUEL
    // ═══════════════════════════════════════════════════════════
    if (isManual) {
      const orderNumber = await generateSubscriptionOrderNumber();

      const result = await prisma.$transaction(async (tx) => {
        // 1. Order
        const order = await tx.order.create({
          data: {
            userId,
            companyId,
            orderNumber,
            status: "unpaid",
            subtotal: amounts.totalAmount,
            shippingCost: 0,
            total: amounts.totalAmount,
            currency: "EUR",
            exchangeRate: 1,
            methodPayment: manualMethod.name,
            manualPaymentMethodId: manualMethod.id,
          },
        });

        // 2. Subscription
        const subscription = await tx.subscription.create({
          data: {
            companyId,
            planId: plan.id,
            status: "incomplete",
            interval,
            baseAmount: amounts.baseAmount,
            addonsAmount: amounts.addonsAmount,
            totalAmount: amounts.totalAmount,
            currentPeriodStart: periods.currentPeriodStart,
            currentPeriodEnd: periods.currentPeriodEnd,
            nextBillingDate: periods.nextBillingDate,
          },
        });

        // 3. BillingHistory
        const billingHistory = await tx.billingHistory.create({
          data: {
            subscriptionId: subscription.id,
            baseAmount: amounts.baseAmount,
            addonsAmount: amounts.addonsAmount,
            totalAmount: amounts.totalAmount,
            periodStart: periods.currentPeriodStart,
            periodEnd: periods.currentPeriodEnd,
            status: "pending",
            paymentMethod: manualMethod.name,
          },
        });

        // 4. Invoice
        const invoice = await createSubscriptionInvoice({
          subscription: { ...subscription, plan },
          billingHistory,
          user,
          company,
          paymentMethod: manualMethod.name,
          orderId: order.id,
        });

        return { order, subscription, invoice };
      });

      // Email pending
      await sendSubscriptionPendingEmail(
        { ...result.subscription, plan },
        user,
        company,
        result.invoice,
        manualMethod
      );

      return res.json({
        success: true,
        message: req.t("subscription.order_created", { orderNumber: result.order.orderNumber, invoiceNumber: result.invoice.invoiceNumber }),
        data: {
          orderNumber: result.order.orderNumber,
          invoiceNumber: result.invoice.invoiceNumber,
          totalAmount: amounts.totalAmount,
          status: "unpaid",
          manualInstructions: manualMethod.instructions,
        },
      });
    }
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// POST /api/subscriptions/webhook
// Webhook Stripe pour confirmer paiement subscriptions
// ═══════════════════════════════════════════════════════════
export const stripeWebhook = async (req, res, next) => {
  const webhookSecret = await getWebhookSecret();
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const stripe = await getStripe();
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("[Webhook] Signature invalide:", err.message);
    return res.status(400).json({ error: `Webhook invalide: ${err.message}` });
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object;
    const metadata = pi.metadata || {};

    console.log(`[Webhook] PaymentIntent succeeded: ${pi.id}`);

    // ─────────────────────────────────────────────────────────
    // SUBSCRIPTION
    // ─────────────────────────────────────────────────────────
    if (metadata.type === "subscription") {
      try {
        const companyId = parseInt(metadata.companyId);

        // Chercher Order pending
        const order = await prisma.order.findFirst({
          where: {
            stripePaymentIntentId: pi.id,
            status: "pending",
          },
        });

        if (!order) {
          console.warn('[Webhook] Order introuvable:', pi.id);
          return res.json({ received: true });
        }

        // Chercher Subscription
        const subscription = await prisma.subscription.findFirst({
          where: {
            companyId,
            status: "incomplete",
          },
          include: {
            plan: true,
            addons: { include: { addon: true } },
          },
        });

        if (!subscription) {
          console.warn('[Webhook] Subscription introuvable');
          return res.json({ received: true });
        }

        // Chercher BillingHistory
        const billingHistory = await prisma.billingHistory.findFirst({
          where: {
            subscriptionId: subscription.id,
            status: "pending",
            stripePaymentIntentId: pi.id,
          },
        });

        if (!billingHistory) {
          console.warn('[Webhook] BillingHistory introuvable');
          return res.json({ received: true });
        }

        // Récupérer charge info
        const stripe = await getStripe();
        const charges = await stripe.charges.list({ payment_intent: pi.id, limit: 1 });
        const charge = charges.data[0];

        const methodLabel = charge?.payment_method_details?.card
          ? `${charge.payment_method_details.card.brand} •••• ${charge.payment_method_details.card.last4}`
          : "Stripe";
        const last4 = charge?.payment_method_details?.card?.last4 ?? null;
        const brand = charge?.payment_method_details?.card?.brand ?? null;
        const stripeChargeId = charge?.id ?? null;

        const user = await prisma.user.findUnique({ where: { id: order.userId } });
        const company = await prisma.company.findUnique({ where: { id: companyId } });

        // Transaction
        await prisma.$transaction(async (tx) => {
          // 1. Order → paid
          await tx.order.update({
            where: { id: order.id },
            data: { status: "paid", paidAt: new Date() },
          });

          // 2. BillingHistory → paid
          await tx.billingHistory.update({
            where: { id: billingHistory.id },
            data: { status: "paid", paidAt: new Date() },
          });

          // 3. Créer/update Invoice
          let invoice;
          if (!billingHistory.invoiceId) {
            invoice = await createSubscriptionInvoice({
              subscription,
              billingHistory,
              user,
              company,
              paymentMethod: methodLabel,
              orderId: order.id,
            });

            await tx.billingHistory.update({
              where: { id: billingHistory.id },
              data: { invoiceId: invoice.id },
            });
          } else {
            invoice = await tx.invoice.findUnique({
              where: { id: billingHistory.invoiceId },
            });
          }

          // 4. Invoice → paid
          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              status: "paid",
              paidAt: new Date(),
              paidAmount: subscription.totalAmount,
              paymentMethod: methodLabel,
            },
          });

          // 5. Subscription → active
          await tx.subscription.update({
            where: { id: subscription.id },
            data: { status: "active" },
          });

          // 6. Payment record
          await tx.payment.create({
            data: {
              orderId: order.id,
              invoiceId: invoice.id,
              companyId,
              userId: user.id,
              amount: subscription.totalAmount,
              currency: "EUR",
              exchangeRate: 1,
              displayAmount: subscription.totalAmount,
              method: "card",
              methodLabel,
              last4,
              brand,
              stripePaymentIntentId: pi.id,
              stripeChargeId,
              status: "completed",
              paidAt: new Date(),
            },
          });
        });

        // Email welcome
        const invoice = await prisma.invoice.findUnique({
          where: { id: billingHistory.invoiceId },
        });

        await sendSubscriptionWelcomeEmail(subscription, user, company, invoice);

        console.log(`[Webhook] ✅ Subscription ${subscription.id} activée`);

      } catch (error) {
        console.error('[Webhook] Erreur subscription:', error);
      }

      return res.json({ received: true });
    }

    // ─────────────────────────────────────────────────────────
    // ORDER NORMAL (produits NFC)
    // ─────────────────────────────────────────────────────────
    // ... (ton code existant pour orders)
  }

  res.json({ received: true });
};

// ═══════════════════════════════════════════════════════════
// GET /api/orders/payment-methods
// ═══════════════════════════════════════════════════════════
export const getPaymentMethods = async (req, res, next) => {
  try {
    const manualMethods = await prisma.manualPaymentMethod.findMany({
      where: { status: "Active" },
      orderBy: { name: "asc" },
    });

    res.json({
      success: true,
      data: manualMethods.map((m) => ({
        id: m.id,
        type: "manual",
        name: m.name,
        instructions: m.instructions ?? null,
        verificationRequired: m.verificationRequired,
        supportedCurrencies: m.supportedCurrencies === "all"
          ? ["all"]
          : m.supportedCurrencies?.split(",").map((c) => c.trim()) || [],
      })),
    });
  } catch (e) {
    next(e);
  }
};