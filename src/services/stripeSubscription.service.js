// ═══════════════════════════════════════════════════════════
// src/services/Subscription.service.js
// ═══════════════════════════════════════════════════════════

import prisma from "../config/database.js";
import { getStripe } from "./Stripe.service.js";
import { sendTemplatedMail, resolveCompanyLangId } from "./client/mail.service.js";

// ─── Génération numéros ───────────────────────────────────────

export async function generateSubscriptionInvoiceNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.invoice.count({
    where: { invoiceNumber: { startsWith: `SUB-${year}-` } },
  });
  return `SUB-${year}-${String(count + 1).padStart(6, "0")}`;
}

export async function generateSubscriptionOrderNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.order.count({
    where: { orderNumber: { startsWith: `OSUB-${year}-` } },
  });
  return `OSUB-${year}-${String(count + 1).padStart(6, "0")}`;
}

// ─── Calculs ──────────────────────────────────────────────────

export function calculateSubscriptionAmounts(plan, interval, addons = []) {
  const baseAmount = interval === "monthly" ? plan.price : plan.annual;
  const addonsAmount = addons.reduce((sum, a) => sum + Number(a.amount || 0), 0);
  
  return {
    baseAmount: Number(baseAmount),
    addonsAmount: Number(addonsAmount),
    totalAmount: Number(baseAmount) + addonsAmount,
  };
}

export function calculatePeriodDates(interval, startDate = new Date()) {
  const start = new Date(startDate);
  const end = new Date(start);
  
  if (interval === "monthly") {
    end.setMonth(end.getMonth() + 1);
  } else {
    end.setFullYear(end.getFullYear() + 1);
  }

  return {
    currentPeriodStart: start,
    currentPeriodEnd: end,
    nextBillingDate: end,
  };
}

// ─── Stripe ───────────────────────────────────────────────────

export async function getOrCreateStripeCustomer(user, company) {
  const stripe = await getStripe();
  
  const existingSub = await prisma.subscription.findFirst({
    where: { companyId: company.id, stripeCustomerId: { not: null } },
    select: { stripeCustomerId: true },
  });

  if (existingSub?.stripeCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(existingSub.stripeCustomerId);
      if (!customer.deleted) return customer;
    } catch (err) {
      console.warn(`[Subscription] Customer introuvable:`, err.message);
    }
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: company.name || user.name,
    metadata: {
      companyId: String(company.id),
      userId: String(user.id),
    },
  });
  console.log(`[Subscription] Customer créé: ${customer.id}`);
  return customer;
}

export async function getDefaultPaymentMethod(stripeCustomerId) {
  const stripe = await getStripe();
  
  const paymentMethods = await stripe.paymentMethods.list({
    customer: stripeCustomerId,
    type: 'card',
  });

  return paymentMethods.data[0] || null;
}

export async function chargeSubscription({
  stripeCustomerId,
  amount,
  description,
  metadata = {},
}) {
  const stripe = await getStripe();

  const paymentMethod = await getDefaultPaymentMethod(stripeCustomerId);

  if (!paymentMethod) {
    throw new Error('NO_PAYMENT_METHOD');
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: 'eur',
    customer: stripeCustomerId,
    payment_method: paymentMethod.id,
    off_session: true,
    confirm: true,
    description,
    metadata,
  });

  console.log(`[Subscription] PaymentIntent: ${paymentIntent.id} - €${amount}`);
  return paymentIntent;
}

export async function createSetupIntent(stripeCustomerId) {
  const stripe = await getStripe();

  const setupIntent = await stripe.setupIntents.create({
    customer: stripeCustomerId,
    payment_method_types: ['card'],
  });

  return setupIntent;
}

// ─── Factures ─────────────────────────────────────────────────

export async function createSubscriptionInvoice({
  subscription,
  billingHistory,
  user,
  company,
  paymentMethod = null,
  orderId = null,
  invoiceType = "subscription",   // "subscription" | "addon"
  addonLines = [],                // lignes d'addons achetés (pour invoiceType === "addon")
}) {
  const invoiceNumber = await generateSubscriptionInvoiceNumber();
  const isAddon = invoiceType === "addon";

  // Devise de la compagnie depuis les paramètres système
  const companySettings = await prisma.companySettings.findUnique({
    where: { companyId: company.id },
    select: { currency: true },
  });
  const invoiceCurrency = companySettings?.currency || "EUR";

  // Pour les factures d'addons, le total est celui des addons uniquement
  const invoiceSubtotal = isAddon ? Number(billingHistory.addonsAmount) : Number(subscription.baseAmount);
  const invoiceTotal    = isAddon ? Number(billingHistory.addonsAmount) : Number(subscription.totalAmount);

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      orderId,
      companyId: company.id,
      userId: user.id,

      status: billingHistory.status === "paid" ? "paid" : "unpaid",

      subtotal: invoiceSubtotal,
      taxAmount: 0,
      shippingCost: 0,
      total: invoiceTotal,
      paidAmount: billingHistory.status === "paid" ? invoiceTotal : 0,

      currency: invoiceCurrency,
      exchangeRate: 1,

      paymentMethod,
      stripePaymentIntentId: billingHistory.stripePaymentIntentId || null,
      paidAt: billingHistory.paidAt || null,

      billingName: company.name,
      billingEmail: user.email,
      billingPhone: company.phone,
      billingAddress: company.address,
      billingVat: company.vatNumber,

      isRecurring: true,
      recurringInterval: subscription.interval,
      nextBillingDate: subscription.nextBillingDate,
      reference: invoiceType,    // tag pour distinguer plan vs addon

      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  if (isAddon) {
    // Facture d'achat d'addons — uniquement les lignes d'addons, pas le plan
    for (const line of addonLines) {
      await prisma.invoiceItem.create({
        data: {
          invoiceId:   invoice.id,
          service:     line.addon?.name ?? "Add-on",
          description: line.addon?.description || "",
          quantity:    line.qty ?? 1,
          unit:        "month",
          unitPrice:   Number(line.unitPrice ?? 0),
          discount:    0,
          taxRate:     0,
          taxAmount:   0,
          subtotal:    Number(line.total ?? 0),
          total:       Number(line.total ?? 0),
        },
      });
    }
  } else {
    const _planName = subscription.plan?.translations?.[0]?.name ?? subscription.plan?.slug ?? `Plan #${subscription.planId}`;

    // Ligne plan principal
    await prisma.invoiceItem.create({
      data: {
        invoiceId:   invoice.id,
        service:     `${_planName} - ${subscription.interval === "monthly" ? "Monthly" : "Yearly"}`,
        description: `Period: ${billingHistory.periodStart.toLocaleDateString("en-US")} - ${billingHistory.periodEnd.toLocaleDateString("en-US")}`,
        quantity:    1,
        unit:        subscription.interval === "monthly" ? "month" : "year",
        unitPrice:   Number(subscription.baseAmount),
        discount:    0,
        taxRate:     0,
        taxAmount:   0,
        subtotal:    Number(subscription.baseAmount),
        total:       Number(subscription.baseAmount),
      },
    });

    // Addons actifs sur l'abonnement
    if (subscription.addons?.length > 0) {
      for (const addon of subscription.addons) {
        await prisma.invoiceItem.create({
          data: {
            invoiceId:   invoice.id,
            service:     addon.addon.name,
            description: addon.addon.description || "",
            quantity:    1,
            unit:        "month",
            unitPrice:   Number(addon.amount),
            discount:    0,
            taxRate:     0,
            taxAmount:   0,
            subtotal:    Number(addon.amount),
            total:       Number(addon.amount),
          },
        });
      }
    }
  }

  await prisma.billingHistory.update({
    where: { id: billingHistory.id },
    data: { invoiceId: invoice.id },
  });

  return invoice;
}

// ─── Emails ───────────────────────────────────────────────────

export async function sendSubscriptionWelcomeEmail(subscription, user, company, invoice) {
  const langId = await resolveCompanyLangId(company?.id);
  const planName = subscription.plan?.translations?.[0]?.name ?? subscription.plan?.slug ?? `Plan #${subscription.planId}`;
  const vars = {
    customer_name: user?.name || user?.email || "",
    company_name: company?.name || "",
    plan_name: planName,
    plan_price: String(Number(subscription.totalAmount).toFixed(2)),
    billing_cycle: subscription.interval === "monthly" ? "Monthly" : "Yearly",
    next_billing_date: subscription.nextBillingDate?.toLocaleDateString("en-US") || "",
    invoice_number: invoice?.invoiceNumber || "",
    currency: "EUR",
    year: String(new Date().getFullYear()),
  };

  await sendTemplatedMail({
    slug: "subscription_welcome",
    to: user.email,
    variables: vars,
    langId,
    fallbackFn: () => ({
      subject: `Welcome to ${subscription.plan.name}!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #E10600;">Welcome to ${subscription.plan.name}!</h2>
          <p>Hi ${vars.customer_name},</p>
          <p>Your subscription is now active.</p>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Plan:</strong> ${vars.plan_name}</p>
            <p><strong>Price:</strong> €${vars.plan_price}/${subscription.interval}</p>
            <p><strong>Next billing:</strong> ${vars.next_billing_date}</p>
            <p><strong>Invoice:</strong> ${vars.invoice_number}</p>
          </div>
          
          <p>Thank you!</p>
        </div>
      `,
      text: `Welcome! ${vars.plan_name} - €${vars.plan_price}`,
    }),
  });

  console.log(`[Subscription] Email welcome envoyé à ${user.email}`);
}

export async function sendSubscriptionPendingEmail(subscription, user, company, invoice, manualMethod) {
  const langId = await resolveCompanyLangId(company.id);
  const vars = {
    customer_name: user.name || user.email,
    plan_name: subscription.plan.name,
    invoice_number: invoice.invoiceNumber,
    total: String(Number(subscription.totalAmount).toFixed(2)),
    payment_method: manualMethod?.name || "Manual Payment",
    payment_instructions: manualMethod?.instructions || "",
    due_date: invoice.dueDate?.toLocaleDateString("en-US") || "",
  };

  await sendTemplatedMail({
    slug: "subscription_pending_payment",
    to: user.email,
    variables: vars,
    langId,
    fallbackFn: () => ({
      subject: `Subscription ${vars.plan_name} — Awaiting Payment`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Subscription Created - Payment Pending</h2>
          <p>Hi ${vars.customer_name},</p>
          <p>Invoice <strong>${vars.invoice_number}</strong> - €${vars.total}</p>
          <p>Payment Method: ${vars.payment_method}</p>
          ${vars.payment_instructions ? `<div style="background: #f5f5f5; padding: 15px;"><p>${vars.payment_instructions}</p></div>` : ""}
          <p>Your subscription will be activated once payment is received.</p>
        </div>
      `,
      text: `Subscription pending: ${vars.invoice_number} - €${vars.total}`,
    }),
  });

  console.log(`[Subscription] Email pending envoyé à ${user.email}`);
}


// ─── Email carte expirée / paiement échoué ────────────────────

export async function sendSubscriptionPaymentFailedEmail(subscription, user, company, reason) {
  const langId = await resolveCompanyLangId(company.id);
  const vars = {
    customer_name: user.name || user.email,
    company_name: company.name,
    plan_name: subscription.plan?.translations?.[0]?.name ?? subscription.plan?.slug ?? `Plan #${subscription.planId}`,
    total: String(Number(subscription.totalAmount).toFixed(2)),
    currency: "EUR",
    reason: reason || "Carte refusée",
    update_card_url: `${process.env.APP_URL}/dashboard/billing`,
  };
  await sendTemplatedMail({
    slug: "subscription_payment_failed",
    to: user.email,
    variables: vars,
    langId,
    fallbackFn: () => ({
      subject: `Payment Failed - ${subscription.plan.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #E10600;">Payment Failed</h2>
          <p>Hi ${vars.customer_name},</p>
          <p>We were unable to process your payment for <strong>${vars.plan_name}</strong>.</p>
          
          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
            <p><strong>Amount:</strong> €${vars.total}</p>
            <p><strong>Reason:</strong> ${vars.reason}</p>
          </div>
          
          <p>Please update your payment method to avoid service interruption.</p>
          <a href="${vars.update_card_url}" style="display: inline-block; background: #E10600; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0;">
            Update Payment Method
          </a>
        </div>
      `,
      text: `Payment failed for ${vars.plan_name}. Amount: €${vars.total}. Please update your payment method.`,
    }),
  });

  console.log(`[Subscription] Email payment failed envoyé à ${user.email}`);
}

// ─── Email rappel d'expiration (J-7, J-3, J-1) ───────────────

export async function sendSubscriptionExpiryReminderEmail(subscription, user, company, daysLeft) {
  const langId  = await resolveCompanyLangId(company?.id);
  const planName = subscription.plan?.translations?.[0]?.name ?? subscription.plan?.slug ?? `Plan #${subscription.planId}`;
  const renewDate = subscription.nextBillingDate?.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  }) ?? '';
  const isTrialing = subscription.status === 'trialing';

  const vars = {
    customer_name:  user?.name  || user?.email || '',
    company_name:   company?.name || '',
    plan_name:      planName,
    days_left:      String(daysLeft),
    renew_date:     renewDate,
    total:          String(Number(subscription.totalAmount).toFixed(2)),
    billing_cycle:  subscription.interval === 'monthly' ? 'Monthly' : 'Yearly',
    billing_url:    `${process.env.APP_URL || process.env.FRONT_URL}/dashboard/billing`,
    year:           String(new Date().getFullYear()),
  };

  const urgencyColor = daysLeft === 1 ? '#E10600' : daysLeft === 3 ? '#f59e0b' : '#3b82f6';
  const subject = isTrialing
    ? `Your free trial ends in ${daysLeft} day${daysLeft > 1 ? 's' : ''} — ${planName}`
    : `Your subscription renews in ${daysLeft} day${daysLeft > 1 ? 's' : ''} — ${planName}`;

  await sendTemplatedMail({
    slug: 'subscription_expiry_reminder',
    to:   user.email,
    variables: vars,
    langId,
    fallbackFn: () => ({
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
          <!-- Header -->
          <div style="background: #0B0D0F; padding: 28px 32px; border-radius: 8px 8px 0 0;">
            <h1 style="color: #E10600; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">
              RedVanta
            </h1>
          </div>

          <!-- Body -->
          <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">

            <!-- Countdown badge -->
            <div style="display: inline-block; background: ${urgencyColor}; color: #fff; padding: 6px 16px; border-radius: 999px; font-size: 13px; font-weight: 700; margin-bottom: 24px;">
              ${daysLeft === 1 ? '⚠️ ' : '🔔 '}${daysLeft} day${daysLeft > 1 ? 's' : ''} remaining
            </div>

            <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 700;">
              ${isTrialing ? 'Your trial is ending soon' : 'Your subscription renews soon'}
            </h2>
            <p style="color: #6b7280; margin: 0 0 24px; font-size: 15px; line-height: 1.6;">
              Hi ${vars.customer_name}, your ${isTrialing ? 'free trial for' : ''} <strong>${planName}</strong>
              ${isTrialing ? 'ends' : 'renews'} on <strong>${renewDate}</strong>.
              ${isTrialing
                ? 'Subscribe now to keep full access to all features.'
                : 'Your card on file will be automatically charged.'}
            </p>

            <!-- Plan summary card -->
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 28px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Plan</td>
                  <td style="padding: 6px 0; font-weight: 600; text-align: right; font-size: 14px;">${planName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Billing</td>
                  <td style="padding: 6px 0; font-weight: 600; text-align: right; font-size: 14px;">${vars.billing_cycle}</td>
                </tr>
                <tr style="border-top: 1px solid #e5e7eb;">
                  <td style="padding: 10px 0 4px; font-weight: 700; font-size: 15px;">
                    ${isTrialing ? 'Amount due' : 'Renewal amount'}
                  </td>
                  <td style="padding: 10px 0 4px; font-weight: 700; text-align: right; font-size: 18px; color: #E10600;">
                    €${vars.total}
                  </td>
                </tr>
              </table>
            </div>

            <!-- CTA -->
            <div style="text-align: center; margin-bottom: 24px;">
              <a href="${vars.billing_url}"
                style="display: inline-block; background: #E10600; color: #ffffff; padding: 14px 32px;
                       text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 15px;">
                ${isTrialing ? 'Subscribe now' : 'Manage subscription'}
              </a>
            </div>

            <p style="font-size: 13px; color: #9ca3af; text-align: center; margin: 0;">
              ${isTrialing
                ? 'No action needed if you don\'t want to continue — your account will revert to the free tier.'
                : 'No action needed if everything looks good — your subscription renews automatically.'}
            </p>
          </div>

          <!-- Footer -->
          <div style="padding: 20px 32px; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              © ${vars.year} RedVanta · <a href="${vars.billing_url}" style="color: #6b7280;">Manage billing</a>
            </p>
          </div>
        </div>
      `,
      text: `${subject}\n\nHi ${vars.customer_name},\n\nYour ${planName} plan ${isTrialing ? 'trial ends' : 'renews'} on ${renewDate} (${daysLeft} day${daysLeft > 1 ? 's' : ''} left).\nAmount: €${vars.total}\n\nManage your subscription: ${vars.billing_url}`,
    }),
  });
}

// ─────────────────────────────────────────────────────────────
// Relance POST-expiration : J+0, J+3, J+7
// daysOverdue = 0 → jour même, 3 → 3 jours après, 7 → 7 jours après
// ─────────────────────────────────────────────────────────────
export async function sendSubscriptionOverdueEmail(subscription, user, company, daysOverdue) {
  const langId   = await resolveCompanyLangId(company?.id);
  const planName = subscription.plan?.translations?.[0]?.name ?? subscription.plan?.slug ?? `Plan #${subscription.planId}`;
  const expiredOn = subscription.nextBillingDate?.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  }) ?? '';

  const urgencyColor = daysOverdue === 0 ? '#f59e0b' : daysOverdue <= 3 ? '#E10600' : '#991b1b';
  const label = daysOverdue === 0
    ? 'expired today'
    : `expired ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} ago`;
  const subject = `Action required: Your ${planName} subscription has ${label}`;

  const vars = {
    customer_name:  user?.name || user?.email || '',
    company_name:   company?.name || '',
    plan_name:      planName,
    days_overdue:   String(daysOverdue),
    expired_on:     expiredOn,
    total:          String(Number(subscription.totalAmount).toFixed(2)),
    billing_cycle:  subscription.interval === 'monthly' ? 'Monthly' : 'Yearly',
    billing_url:    `${process.env.APP_URL || process.env.FRONT_URL}/dashboard/billing`,
    year:           String(new Date().getFullYear()),
  };

  await sendTemplatedMail({
    slug: 'subscription_overdue_reminder',
    to:   user.email,
    variables: vars,
    langId,
    fallbackFn: () => ({
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
          <div style="background: #0B0D0F; padding: 28px 32px; border-radius: 8px 8px 0 0;">
            <h1 style="color: #E10600; margin: 0; font-size: 20px; font-weight: 700;">RedVanta</h1>
          </div>
          <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <div style="display: inline-block; background: ${urgencyColor}; color: #fff; padding: 6px 16px; border-radius: 999px; font-size: 13px; font-weight: 700; margin-bottom: 24px;">
              ⚠️ Subscription ${label}
            </div>
            <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 700;">Your subscription has expired</h2>
            <p style="color: #6b7280; margin: 0 0 24px; line-height: 1.6;">
              Hi ${vars.customer_name},<br><br>
              Your <strong>${planName}</strong> subscription for <strong>${vars.company_name}</strong>
              ${daysOverdue === 0 ? 'expired today' : `expired on <strong>${expiredOn}</strong> (${daysOverdue} days ago)`}.
              Your access to premium features may be restricted.
            </p>
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="margin: 0; font-size: 14px; color: #991b1b;">
                <strong>Plan:</strong> ${planName} · <strong>Amount:</strong> €${vars.total}/${vars.billing_cycle === 'Monthly' ? 'mo' : 'yr'}
              </p>
            </div>
            <a href="${vars.billing_url}" style="display: inline-block; background: #E10600; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 15px;">
              Renew Subscription
            </a>
            <p style="color: #9ca3af; font-size: 13px; margin-top: 24px;">
              If you have already renewed, please ignore this email.
            </p>
          </div>
          <div style="padding: 20px 32px; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              © ${vars.year} RedVanta · <a href="${vars.billing_url}" style="color: #6b7280;">Manage billing</a>
            </p>
          </div>
        </div>
      `,
      text: `${subject}\n\nHi ${vars.customer_name},\n\nYour ${planName} subscription ${label}.\nRenew now: ${vars.billing_url}`,
    }),
  });
}

// ─────────────────────────────────────────────────────────────

export function formatSubscription(sub) {
  return {
    id: sub.id,
    planId: sub.planId,
    planName: sub.plan?.translations?.[0]?.name ?? sub.plan?.slug ?? null,
    status: sub.status,
    interval: sub.interval,
    baseAmount: Number(sub.baseAmount),
    addonsAmount: Number(sub.addonsAmount),
    totalAmount: Number(sub.totalAmount),
    currentPeriodStart: sub.currentPeriodStart,
    currentPeriodEnd: sub.currentPeriodEnd,
    nextBillingDate: sub.nextBillingDate,
    createdAt: sub.createdAt,
  };
}