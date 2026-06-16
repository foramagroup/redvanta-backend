// ═══════════════════════════════════════════════════════════
// src/controllers/aiCreditPurchase.controller.js
// Achat de crédits IA — côté company admin
// Flux Stripe OU manuel, identique au pattern addon
// ═══════════════════════════════════════════════════════════

import prisma from "../config/database.js";
import { getStripe } from "../services/Stripe.service.js";
import {
  getOrCreateStripeCustomer,
  getDefaultPaymentMethod,
} from "../services/stripeSubscription.service.js";
import { invalidateLimitsCache } from "../services/limits.service.js";

const CREDIT_PACKS = {
  small:  { credits: 100,  priceUsd: 5.00  },
  medium: { credits: 500,  priceUsd: 20.00 },
  large:  { credits: 2000, priceUsd: 70.00 },
};

function userId(req)    { return req.user.userId; }
function companyId(req) {
  const id = req.user?.companyId;
  if (!id) throw Object.assign(new Error("Forbidden"), { status: 403 });
  return parseInt(id);
}

async function generateCreditInvoiceNumber() {
  const year  = new Date().getFullYear();
  const count = await prisma.invoice.count({
    where: { invoiceNumber: { startsWith: `AIC-${year}-` } },
  });
  return `AIC-${year}-${String(count + 1).padStart(6, "0")}`;
}

async function createCreditInvoice({ purchase, user, company, packData, paymentMethod }) {
  const invoiceNumber = await generateCreditInvoiceNumber();

  const companySettings = await prisma.companySettings.findUnique({
    where: { companyId: company.id },
    select: { currency: true },
  });
  const currency = companySettings?.currency || "EUR";

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      companyId:    company.id,
      userId:       user.id,
      status:       purchase.status === "paid" ? "paid" : "unpaid",
      subtotal:     packData.priceUsd,
      taxAmount:    0,
      shippingCost: 0,
      total:        packData.priceUsd,
      paidAmount:   purchase.status === "paid" ? packData.priceUsd : 0,
      currency,
      exchangeRate: 1,
      paymentMethod,
      stripePaymentIntentId: purchase.stripePaymentIntentId || null,
      paidAt:       purchase.paidAt || null,
      billingName:  company.name,
      billingEmail: user.email,
      billingPhone: company.phone || null,
      billingAddress: company.address || null,
      isRecurring:  false,
      reference:    "ai_credit",
      invoiceDate:  new Date(),
      dueDate:      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.invoiceItem.create({
    data: {
      invoiceId:   invoice.id,
      service:     `AI Credit Pack — ${packData.credits} credits`,
      description: `Pack: ${purchase.packId}`,
      quantity:    1,
      unit:        "pack",
      unitPrice:   packData.priceUsd,
      discount:    0,
      taxRate:     0,
      taxAmount:   0,
      subtotal:    packData.priceUsd,
      total:       packData.priceUsd,
    },
  });

  return invoice;
}

// ── GET /api/admin/ai/credits/packs ──────────────────────────
export async function getCreditPacks(req, res) {
  try {
    const packs = Object.entries(CREDIT_PACKS).map(([key, p]) => ({
      id:        key,
      credits:   p.credits,
      priceUsd:  p.priceUsd,
      label:     `${p.credits} crédits`,
      perCredit: (p.priceUsd / p.credits).toFixed(4),
    }));
    res.json({ success: true, data: packs });
  } catch (err) {
    console.error("[getCreditPacks]", err);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
}

// ── GET /api/admin/ai/credits/payment-methods ─────────────────
export async function getCreditPaymentMethods(req, res) {
  try {
    const manualMethods = await prisma.manualPaymentMethod.findMany({
      where: { status: "Active" },
      orderBy: { name: "asc" },
    });

    const methods = manualMethods.map((m) => ({
      id:           m.id,
      type:         "manual",
      name:         m.name,
      description:  m.instructions ?? null,
      instructions: m.instructions ?? null,
    }));

    res.json({ success: true, data: methods });
  } catch (err) {
    console.error("[getCreditPaymentMethods]", err);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
}

// ── POST /api/admin/ai/credits/request ────────────────────────
// Body: { packId, paymentMethod: "stripe" | "manual", paymentMethodId? }
export async function requestCreditPurchase(req, res) {
  try {
    const uid = userId(req);
    const cid = companyId(req);
    const { packId, paymentMethod, paymentMethodId } = req.body;

    if (!packId || !CREDIT_PACKS[packId]) {
      return res.status(400).json({ success: false, error: "Pack invalide." });
    }

    const isStripe = paymentMethod === "stripe";
    const isManual = paymentMethod === "manual";
    if (!isStripe && !isManual) {
      return res.status(422).json({ success: false, error: "paymentMethod doit être 'stripe' ou 'manual'" });
    }

    let manualMethod = null;
    if (isManual) {
      if (!paymentMethodId) {
        return res.status(422).json({ success: false, error: "paymentMethodId requis pour paiement manuel" });
      }
      manualMethod = await prisma.manualPaymentMethod.findFirst({
        where: { id: parseInt(paymentMethodId), status: "Active" },
      });
      if (!manualMethod) {
        return res.status(422).json({ success: false, error: "Méthode de paiement invalide" });
      }
    }

    const packData = CREDIT_PACKS[packId];
    const [user, company] = await Promise.all([
      prisma.user.findUnique({ where: { id: uid } }),
      prisma.company.findUnique({ where: { id: cid } }),
    ]);

    // ─── STRIPE ──────────────────────────────────────────────
    if (isStripe) {
      const stripe   = await getStripe();
      const customer = await getOrCreateStripeCustomer(user, company);
      const savedCard = await getDefaultPaymentMethod(customer.id);

      const piData = {
        amount:   Math.round(packData.priceUsd * 100),
        currency: "eur",
        customer: customer.id,
        automatic_payment_methods: { enabled: true },
        metadata: {
          type:      "ai_credit_purchase",
          companyId: String(cid),
          userId:    String(uid),
          packId,
          credits:   String(packData.credits),
        },
      };

      if (!savedCard) {
        piData.setup_future_usage = "off_session";
      } else {
        piData.payment_method = savedCard.id;
      }

      const pi = await stripe.paymentIntents.create(piData);

      // Créer la purchase en pending (invoice créée à la confirmation)
      await prisma.aiCreditPurchase.create({
        data: {
          companyId: cid,
          userId:    uid,
          packId,
          credits:   packData.credits,
          amountUsd: packData.priceUsd,
          status:    "pending",
          paymentMethod: "Stripe",
          stripePaymentIntentId: pi.id,
        },
      });

      return res.json({
        success:      true,
        clientSecret: pi.client_secret,
        message:      "Confirmez votre paiement pour activer les crédits.",
        data: { packId, credits: packData.credits, amountUsd: packData.priceUsd },
      });
    }

    // ─── MANUEL ──────────────────────────────────────────────
    if (isManual) {
      const purchase = await prisma.aiCreditPurchase.create({
        data: {
          companyId:    cid,
          userId:       uid,
          packId,
          credits:      packData.credits,
          amountUsd:    packData.priceUsd,
          status:       "pending",
          paymentMethod: manualMethod.name,
        },
      });

      const invoice = await createCreditInvoice({
        purchase,
        user,
        company,
        packData,
        paymentMethod: manualMethod.name,
      });

      // Lier l'invoice à la purchase
      await prisma.aiCreditPurchase.update({
        where: { id: purchase.id },
        data:  { invoiceId: invoice.id },
      });

      return res.json({
        success: true,
        message: `Demande créée. Facture ${invoice.invoiceNumber} envoyée.`,
        data: {
          purchaseId:         purchase.id,
          invoiceNumber:      invoice.invoiceNumber,
          credits:            packData.credits,
          amountUsd:          packData.priceUsd,
          status:             "pending",
          manualInstructions: manualMethod.instructions,
        },
      });
    }
  } catch (err) {
    console.error("[requestCreditPurchase]", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

// ── POST /api/admin/ai/credits/confirm ────────────────────────
// Appelé par le frontend après retour de la page Stripe
// Body: { paymentIntentId }
export async function confirmCreditStripe(req, res) {
  try {
    const { paymentIntentId } = req.body;
    if (!paymentIntentId) {
      return res.status(422).json({ success: false, error: "paymentIntentId requis" });
    }

    const stripe = await getStripe();
    const pi     = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (pi.status !== "succeeded") {
      return res.status(400).json({ success: false, error: `Statut PaymentIntent: ${pi.status}` });
    }

    const purchase = await prisma.aiCreditPurchase.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
    });

    if (!purchase) {
      return res.status(404).json({ success: false, error: "Purchase introuvable" });
    }

    if (purchase.status === "paid") {
      return res.json({ success: true, message: "Crédits déjà activés", data: { credits: purchase.credits } });
    }

    const packData = CREDIT_PACKS[purchase.packId];
    const [user, company] = await Promise.all([
      prisma.user.findUnique({ where: { id: purchase.userId } }),
      prisma.company.findUnique({ where: { id: purchase.companyId } }),
    ]);

    // Créer l'invoice et activer les crédits dans une transaction
    const invoice = await createCreditInvoice({
      purchase: { ...purchase, status: "paid", paidAt: new Date() },
      user,
      company,
      packData,
      paymentMethod: `Stripe`,
    });

    await prisma.$transaction([
      prisma.aiCreditPurchase.update({
        where: { id: purchase.id },
        data: {
          status:    "paid",
          paidAt:    new Date(),
          invoiceId: invoice.id,
        },
      }),
      prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: "paid", paidAt: new Date(), paidAmount: packData.priceUsd },
      }),
      prisma.aiCreditBalance.upsert({
        where:  { companyId: purchase.companyId },
        create: { companyId: purchase.companyId, purchased: purchase.credits },
        update: { purchased: { increment: purchase.credits } },
      }),
      prisma.aiCreditTransaction.create({
        data: {
          companyId:  purchase.companyId,
          kind:       "purchase",
          amount:     purchase.credits,
          revenueUsd: packData.priceUsd,
          meta:       { packId: purchase.packId, source: "stripe", purchaseId: purchase.id },
        },
      }),
    ]);

    invalidateLimitsCache(purchase.companyId);

    return res.json({
      success: true,
      message: `${purchase.credits} crédits activés.`,
      data: { credits: purchase.credits },
    });
  } catch (err) {
    console.error("[confirmCreditStripe]", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
