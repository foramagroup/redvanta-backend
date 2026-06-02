import prisma from "../config/database.js";
import { getStripe } from "../services/Stripe.service.js";
import {
  getOrCreateStripeCustomer,
  getDefaultPaymentMethod,
  calculatePeriodDates,
  generateSubscriptionOrderNumber,
  createSubscriptionInvoice,
  sendSubscriptionPendingEmail,
} from "../services/stripeSubscription.service.js";
import { invalidateLimitsCache } from "../services/limits.service.js";

function getCompanyId(req) {
  const id = req.user?.companyId;
  if (!id) throw Object.assign(new Error("Forbidden"), { status: 403 });
  return parseInt(id);
}

function slugify(name) {
  return name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// Auto-crée l'Addon lié si un AddonSetting n'en a pas encore (migration en douceur)
async function ensureAddonLinked(setting) {
  if (setting.addonId && setting.addon) return setting;

  const slug      = slugify(setting.name);
  const addonType = setting.type === "Quantity" ? "capacity" : "feature";
  const price     = parseFloat(setting.price) || 0;

  const addon = await prisma.$transaction(async (tx) => {
    let existing = await tx.addon.findUnique({ where: { slug } });
    if (!existing) {
      existing = await tx.addon.create({
        data: { name: setting.name, slug, description: "", price, type: addonType, status: "active", displayOrder: 0 },
      });
    }
    await tx.addonSetting.update({
      where: { id: setting.id },
      data:  { addonId: existing.id, updatedAt: new Date() },
    });
    return existing;
  });

  return { ...setting, addonId: addon.id, addon };
}

// ─────────────────────────────────────────────────────────────
// GET /api/client/addons
// Liste les AddonSettings actifs + statut de la company
// ─────────────────────────────────────────────────────────────
export const listAddons = async (req, res) => {
  try {
    const companyId = getCompanyId(req);

    const [addonSettings, subscription] = await Promise.all([
      prisma.addonSetting.findMany({
        where: { active: true },
        orderBy: { id: "asc" },
        include: { addon: true },
      }),
      prisma.subscription.findUnique({
        where: { companyId },
        include: {
          addons: {
            where: { status: { in: ["active", "inactive"] } },
            include: { addon: true },
          },
        },
      }),
    ]);

    const activeMap = new Map(
      (subscription?.addons ?? []).map((sa) => [sa.addonId, sa])
    );

    const data = addonSettings.map((s) => {
      const sa = s.addonId ? activeMap.get(s.addonId) : null;
      return {
        id: s.id,
        name: s.name,
        type: s.type,
        price: parseFloat(s.price) || 0,
        description: s.description,
        addonId: s.addonId,
        isActive: sa?.status === "active",
        purchasedQuantity: sa?.quantity ?? 0,
        subscriptionAddonId: sa?.id ?? null,
      };
    });

    return res.json({ success: true, data });
  } catch (err) {
    console.error("[listAddons]", err);
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/admin/addons/payment-methods
// Même format que getPaymentMethods dans subscriptions.controller.js :
// tableau unifié → Stripe en tête + méthodes manuelles de la DB
// ─────────────────────────────────────────────────────────────
export const getAddonPaymentMethods = async (req, res) => {
  try {
    const manualMethods = await prisma.manualPaymentMethod.findMany({
      where: { status: "Active" },
      orderBy: { name: "asc" },
    });

    // Même format que getPaymentMethods dans subscriptions.controller.js
    // Le frontend ajoute l'entrée Stripe lui-même (pas retournée ici)
    const methods = manualMethods.map((m) => ({
      id: m.id,
      type: "manual",
      name: m.name,
      description: m.instructions ?? null,
      instructions: m.instructions ?? null,
      verificationRequired: m.verificationRequired ?? false,
      supportedCurrencies:
        m.supportedCurrencies === "all"
          ? ["all"]
          : m.supportedCurrencies?.split(",").map((c) => c.trim()) || [],
    }));

    return res.json({ success: true, data: methods });
  } catch (err) {
    console.error("[getAddonPaymentMethods]", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/client/addons/purchase
// Body: { addons:[{addonSettingId,quantity}], paymentMethod:"stripe"|"manual",
//         paymentMethodId?, promoCode? }
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// POST /api/admin/addons/purchase
// Même pattern que checkoutSubscription :
//   STRIPE: Order pending + BillingHistory pending + SubscriptionAddon inactive
//           → clientSecret retourné pour confirmation PaymentElement
//   MANUAL: Order "unpaid" + BillingHistory pending + Invoice + email pending
// ─────────────────────────────────────────────────────────────
export const purchaseAddons = async (req, res) => {
  try {
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);
    const { addons: selections, paymentMethod, paymentMethodId, promoCode } = req.body;

    if (!selections?.length) {
      return res.status(422).json({ success: false, error: "No addons selected" });
    }

    const isStripe = paymentMethod === "stripe";
    const isManual = paymentMethod === "manual";
    if (!isStripe && !isManual) {
      return res.status(422).json({ success: false, error: "paymentMethod must be 'stripe' or 'manual'" });
    }

    // ── Validation méthode manuelle (identique à checkoutSubscription) ──
    let manualMethod = null;
    if (isManual) {
      if (!paymentMethodId) {
        return res.status(422).json({ success: false, error: "paymentMethodId required for manual payment" });
      }
      manualMethod = await prisma.manualPaymentMethod.findFirst({
        where: { id: parseInt(paymentMethodId), status: "Active" },
      });
      if (!manualMethod) {
        return res.status(422).json({ success: false, error: "Invalid manual payment method" });
      }
    }

    // ── Charger les AddonSettings avec leur Addon lié ──
    const settingIds = selections.map((s) => parseInt(s.addonSettingId));
    const settings   = await prisma.addonSetting.findMany({
      where: { id: { in: settingIds }, active: true },
      include: { addon: true },
    });

    if (settings.length !== settingIds.length) {
      return res.status(422).json({ success: false, error: "One or more addons not found or inactive" });
    }

    // Auto-lier les AddonSettings qui n'ont pas encore d'addonId (migration transparente)
    const linkedSettings = await Promise.all(settings.map((s) => ensureAddonLinked(s)));

    // ── Construire les lignes + calculs ──
    const lines = linkedSettings.map((s) => {
      const sel       = selections.find((x) => parseInt(x.addonSettingId) === s.id);
      const qty       = s.type === "Quantity" ? Math.max(1, parseInt(sel?.quantity) || 1) : 1;
      const unitPrice = parseFloat(s.price) || 0;
      return { setting: s, addon: s.addon, qty, unitPrice, total: unitPrice * qty };
    });

    const subtotal    = lines.reduce((sum, l) => sum + l.total, 0);
    const discount    = promoCode === "SAVE20" ? Math.round(subtotal * 0.2 * 100) / 100 : 0;
    const totalAmount = Math.round((subtotal - discount) * 100) / 100;

    // ── La company doit avoir une subscription ──
    const subscription = await prisma.subscription.findUnique({
      where: { companyId },
      include: { plan: true },
    });
    if (!subscription) {
      return res.status(400).json({ success: false, error: "No active subscription found. Subscribe to a plan first." });
    }

    const user        = await prisma.user.findUnique({ where: { id: userId } });
    const company     = await prisma.company.findUnique({ where: { id: companyId } });
    const orderNumber = await generateSubscriptionOrderNumber();
    const periods     = calculatePeriodDates(subscription.interval, new Date());

    // ═══════════════════════════════════════════════════════════
    // STRIPE — identique à checkoutSubscription
    // ═══════════════════════════════════════════════════════════
    if (isStripe) {
      const stripe   = await getStripe();
      const customer = await getOrCreateStripeCustomer(user, company);
      const savedCard = await getDefaultPaymentMethod(customer.id);

      const piData = {
        amount:   Math.round(totalAmount * 100),
        currency: "eur",
        customer: customer.id,
        automatic_payment_methods: { enabled: true },
        metadata: {
          type:      "addon_purchase",
          companyId: String(companyId),
          userId:    String(userId),
          addonIds:  JSON.stringify(lines.map((l) => l.addon.id)),
          orderNumber,
          promoCode: promoCode || "",
          discount:  String(discount),
        },
      };

      // Pas de carte enregistrée → setup_future_usage pour enregistrer la carte
      if (!savedCard) {
        piData.setup_future_usage = "off_session";
      } else {
        piData.payment_method = savedCard.id;
      }

      const paymentIntent = await stripe.paymentIntents.create(piData);

      await prisma.$transaction(async (tx) => {
        await tx.order.create({
          data: {
            userId, companyId, orderNumber,
            status: "pending",
            subtotal, shippingCost: 0, total: totalAmount,
            currency: "EUR", exchangeRate: 1,
            methodPayment: "Stripe",
            stripePaymentIntentId: paymentIntent.id,
            stripeClientSecret:    paymentIntent.client_secret,
          },
        });

        await tx.billingHistory.create({
          data: {
            subscriptionId: subscription.id,
            baseAmount: 0, addonsAmount: totalAmount, taxAmount: 0, totalAmount,
            periodStart: periods.currentPeriodStart, periodEnd: periods.currentPeriodEnd,
            status: "pending",
            paymentMethod: "Stripe",
            stripePaymentIntentId: paymentIntent.id,
            usageDetails: { addonOrderNumber: orderNumber, discount, promoCode: promoCode || null },
          },
        });

        for (const l of lines) {
          await tx.subscriptionAddon.upsert({
            where:  { subscriptionId_addonId: { subscriptionId: subscription.id, addonId: l.addon.id } },
            create: { subscriptionId: subscription.id, addonId: l.addon.id, amount: l.total, quantity: l.qty, status: "inactive" },
            update: { amount: l.total, quantity: l.qty, status: "inactive" },
          });
        }
      });

      // clientSecret au top niveau — identique à checkoutSubscription
      return res.json({
        success: true,
        clientSecret: paymentIntent.client_secret,
        message: "Confirm your payment to activate the add-ons.",
        data: {
          orderNumber,
          totalAmount,
          status: "pending",
        },
      });
    }

    // ═══════════════════════════════════════════════════════════
    // MANUEL — Order "unpaid" + Invoice après commit + email
    // ═══════════════════════════════════════════════════════════
    if (isManual) {
      // Transaction : order + billingHistory + subscriptionAddons
      // L'invoice est créée APRÈS le commit (même raison que checkoutSubscription)
      const { order, billingHistory: bh } = await prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            userId, companyId, orderNumber,
            status: "unpaid",                    // ← "unpaid" comme dans checkoutSubscription
            subtotal, shippingCost: 0, total: totalAmount,
            currency: "EUR", exchangeRate: 1,
            methodPayment: manualMethod.name,
            manualPaymentMethodId: manualMethod.id,
          },
        });

        const billingHistory = await tx.billingHistory.create({
          data: {
            subscriptionId: subscription.id,
            baseAmount: 0, addonsAmount: totalAmount, taxAmount: 0, totalAmount,
            periodStart: periods.currentPeriodStart, periodEnd: periods.currentPeriodEnd,
            status: "pending",
            paymentMethod: manualMethod.name,
            usageDetails: { addonOrderNumber: orderNumber, discount, promoCode: promoCode || null },
          },
        });

        for (const l of lines) {
          await tx.subscriptionAddon.upsert({
            where:  { subscriptionId_addonId: { subscriptionId: subscription.id, addonId: l.addon.id } },
            create: { subscriptionId: subscription.id, addonId: l.addon.id, amount: l.total, quantity: l.qty, status: "inactive" },
            update: { amount: l.total, quantity: l.qty, status: "inactive" },
          });
        }

        return { order, billingHistory };
      });

      // Invoice créée après le commit — l'order existe maintenant en base
      const invoice = await createSubscriptionInvoice({
        subscription: { ...subscription, plan: subscription.plan },
        billingHistory: bh,
        user,
        company,
        paymentMethod: manualMethod.name,
        orderId: order.id,
      });

      // Email de confirmation paiement en attente
      await sendSubscriptionPendingEmail(
        { ...subscription, plan: subscription.plan },
        user,
        company,
        invoice,
        manualMethod
      );

      return res.json({
        success: true,
        message: `Order ${orderNumber} created. Invoice ${invoice.invoiceNumber} sent.`,
        data: {
          orderNumber,
          invoiceNumber: invoice.invoiceNumber,
          totalAmount,
          status: "unpaid",
          manualInstructions: manualMethod.instructions,
        },
      });
    }
  } catch (err) {
    console.error("[purchaseAddons]", err);
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/client/addons/confirm  (webhook Stripe)
// ─────────────────────────────────────────────────────────────
export const confirmAddonStripe = async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    if (!paymentIntentId) {
      return res.status(422).json({ success: false, error: "paymentIntentId required" });
    }

    const stripe = await getStripe();
    const pi     = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (pi.status !== "succeeded") {
      return res.status(400).json({ success: false, error: `PaymentIntent status: ${pi.status}` });
    }

    const addonIds  = JSON.parse(pi.metadata.addonIds || "[]");
    const companyId = parseInt(pi.metadata.companyId);

    const subscription = await prisma.subscription.findUnique({ where: { companyId } });
    if (!subscription) {
      return res.status(404).json({ success: false, error: "Subscription not found" });
    }

    await prisma.$transaction([
      prisma.subscriptionAddon.updateMany({
        where: { subscriptionId: subscription.id, addonId: { in: addonIds }, status: "inactive" },
        data:  { status: "active", activatedAt: new Date() },
      }),
      prisma.billingHistory.updateMany({
        where: { stripePaymentIntentId: paymentIntentId, status: "pending" },
        data:  { status: "paid", paidAt: new Date() },
      }),
      prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          addonsAmount: { increment: parseFloat(pi.amount_received) / 100 },
          totalAmount:  { increment: parseFloat(pi.amount_received) / 100 },
        },
      }),
    ]);

    // Invalider le cache des limites → les nouvelles limites sont effectives immédiatement
    invalidateLimitsCache(companyId);

    return res.json({ success: true, data: { activated: addonIds.length } });
  } catch (err) {
    console.error("[confirmAddonStripe]", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/client/addons/:addonSettingId
// ─────────────────────────────────────────────────────────────
export const cancelAddon = async (req, res) => {
  try {
    const companyId      = getCompanyId(req);
    const addonSettingId = parseInt(req.params.addonSettingId);

    const setting = await prisma.addonSetting.findUnique({ where: { id: addonSettingId } });
    if (!setting?.addonId) {
      return res.status(404).json({ success: false, error: "Addon not found" });
    }

    const subscription = await prisma.subscription.findUnique({ where: { companyId } });
    if (!subscription) {
      return res.status(404).json({ success: false, error: "No subscription" });
    }

    const updated = await prisma.subscriptionAddon.updateMany({
      where: { subscriptionId: subscription.id, addonId: setting.addonId, status: "active" },
      data:  { status: "inactive", deactivatedAt: new Date() },
    });

    if (updated.count === 0) {
      return res.status(404).json({ success: false, error: "No active addon to cancel" });
    }

    const remaining       = await prisma.subscriptionAddon.findMany({ where: { subscriptionId: subscription.id, status: "active" } });
    const newAddonsAmount = remaining.reduce((s, a) => s + a.amount, 0);

    await prisma.subscription.update({
      where: { id: subscription.id },
      data:  { addonsAmount: newAddonsAmount, totalAmount: subscription.baseAmount + newAddonsAmount },
    });

    // Invalider le cache → les limites reviennent au niveau du plan seul
    invalidateLimitsCache(companyId);

    return res.json({ success: true, data: { cancelled: true } });
  } catch (err) {
    console.error("[cancelAddon]", err);
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
};
