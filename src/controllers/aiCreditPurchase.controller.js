// ═══════════════════════════════════════════════════════════
// src/controllers/aiCreditPurchase.controller.js
// Achat de crédits IA — côté company admin
// Flux Stripe OU manuel, identique au pattern addon
// Les packs sont désormais gérés en DB (AiCreditPack)
// ═══════════════════════════════════════════════════════════

import prisma from "../config/database.js";
import { getStripe } from "../services/Stripe.service.js";
import {
  getOrCreateStripeCustomer,
  getDefaultPaymentMethod,
} from "../services/stripeSubscription.service.js";
import { invalidateLimitsCache } from "../services/limits.service.js";

function userId(req)    { return req.user.userId; }
function companyId(req) {
  const id = req.user?.companyId;
  if (!id) throw Object.assign(new Error("Forbidden"), { status: 403 });
  return parseInt(id);
}

// ── Helpers ───────────────────────────────────────────────

async function findPackById(packId) {
  const pack = await prisma.aiCreditPack.findFirst({
    where: { id: parseInt(packId), isActive: true },
    include: { translations: { include: { language: true } } },
  });
  return pack || null;
}

async function getCompanyLanguageCode(companyId) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { language: { select: { code: true } } },
  });
  return company?.language?.code || "en";
}

function resolvePackName(pack, langCode) {
  const t = pack.translations.find((t) => t.language.code === langCode)
         || pack.translations.find((t) => t.language.code === "en")
         || pack.translations[0];
  return t?.name || pack.slug;
}

async function generateCreditInvoiceNumber() {
  const year  = new Date().getFullYear();
  const count = await prisma.invoice.count({
    where: { invoiceNumber: { startsWith: `AIC-${year}-` } },
  });
  return `AIC-${year}-${String(count + 1).padStart(6, "0")}`;
}

async function createCreditInvoice({ purchase, user, company, pack, packName, paymentMethod }) {
  const invoiceNumber = await generateCreditInvoiceNumber();

  const companySettings = await prisma.companySettings.findUnique({
    where: { companyId: company.id },
    select: { currency: true },
  });
  const currency   = companySettings?.currency || "EUR";
  const priceUsd   = Number(pack.priceUsd);

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      companyId:    company.id,
      userId:       user.id,
      status:       purchase.status === "paid" ? "paid" : "unpaid",
      subtotal:     priceUsd,
      taxAmount:    0,
      shippingCost: 0,
      total:        priceUsd,
      paidAmount:   purchase.status === "paid" ? priceUsd : 0,
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
      service:     packName ? `${packName} — ${pack.credits} credits` : `AI Credit Pack — ${pack.credits} credits`,
      description: `Pack slug: ${pack.slug}`,
      quantity:    1,
      unit:        "pack",
      unitPrice:   priceUsd,
      discount:    0,
      taxRate:     0,
      taxAmount:   0,
      subtotal:    priceUsd,
      total:       priceUsd,
    },
  });

  return invoice;
}

// ── GET /api/admin/ai/credits/packs ──────────────────────────
export async function getCreditPacks(req, res) {
  try {
    const cid      = companyId(req);
    const langCode = await getCompanyLanguageCode(cid);

    const packs = await prisma.aiCreditPack.findMany({
      where:   { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { translations: { include: { language: { select: { code: true } } } } },
    });

    const data = packs.map((p) => ({
      id:        p.id,
      slug:      p.slug,
      credits:   p.credits,
      priceUsd:  Number(p.priceUsd),
      name:      resolvePackName(p, langCode),
      perCredit: (Number(p.priceUsd) / p.credits).toFixed(4),
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error("[getCreditPacks]", err);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
}

// ── GET /api/admin/ai/credits/payment-methods ─────────────────
export async function getCreditPaymentMethods(req, res) {
  try {
    const manualMethods = await prisma.manualPaymentMethod.findMany({
      where:   { status: "Active" },
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
// Body: { packId (INT), paymentMethod: "stripe" | "manual", paymentMethodId? }
export async function requestCreditPurchase(req, res) {
  try {
    const uid = userId(req);
    const cid = companyId(req);
    const { packId, paymentMethod, paymentMethodId } = req.body;

    // Cherche le pack en DB par id (INT)
    const pack = await findPackById(packId);
    if (!pack) {
      return res.status(400).json({ success: false, error: "Pack invalide ou inactif." });
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

    const priceUsd   = Number(pack.priceUsd);
    const langCode   = await getCompanyLanguageCode(cid);
    const packName   = resolvePackName(pack, langCode);

    const [user, company] = await Promise.all([
      prisma.user.findUnique({ where: { id: uid } }),
      prisma.company.findUnique({ where: { id: cid } }),
    ]);

    // ─── STRIPE ──────────────────────────────────────────────
    if (isStripe) {
      const stripe    = await getStripe();
      const customer  = await getOrCreateStripeCustomer(user, company);
      const savedCard = await getDefaultPaymentMethod(customer.id);

      const piData = {
        amount:   Math.round(priceUsd * 100),
        currency: "eur",
        customer: customer.id,
        automatic_payment_methods: { enabled: true },
        metadata: {
          type:      "ai_credit_purchase",
          companyId: String(cid),
          userId:    String(uid),
          packId:    String(pack.id),   // INT stocké comme string dans Stripe
          credits:   String(pack.credits),
        },
      };

      if (!savedCard) {
        piData.setup_future_usage = "off_session";
      } else {
        piData.payment_method = savedCard.id;
      }

      const pi = await stripe.paymentIntents.create(piData);

      await prisma.aiCreditPurchase.create({
        data: {
          companyId: cid,
          userId:    uid,
          packId:    pack.id,           // INT
          credits:   pack.credits,
          amountUsd: priceUsd,
          status:    "pending",
          paymentMethod: "Stripe",
          stripePaymentIntentId: pi.id,
        },
      });

      return res.json({
        success:      true,
        clientSecret: pi.client_secret,
        message:      "Confirmez votre paiement pour activer les crédits.",
        data: { packId: pack.id, credits: pack.credits, amountUsd: priceUsd, name: packName },
      });
    }

    // ─── MANUEL ──────────────────────────────────────────────
    if (isManual) {
      const purchase = await prisma.aiCreditPurchase.create({
        data: {
          companyId:     cid,
          userId:        uid,
          packId:        pack.id,       // INT
          credits:       pack.credits,
          amountUsd:     priceUsd,
          status:        "pending",
          paymentMethod: manualMethod.name,
        },
      });

      const invoice = await createCreditInvoice({
        purchase,
        user,
        company,
        pack,
        packName,
        paymentMethod: manualMethod.name,
      });

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
          credits:            pack.credits,
          amountUsd:          priceUsd,
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
      where:   { stripePaymentIntentId: paymentIntentId },
      include: { pack: true },
    });

    if (!purchase) {
      return res.status(404).json({ success: false, error: "Purchase introuvable" });
    }

    if (purchase.status === "paid") {
      return res.json({ success: true, message: "Crédits déjà activés", data: { credits: purchase.credits } });
    }

    const pack = purchase.pack;
    const [user, company] = await Promise.all([
      prisma.user.findUnique({ where: { id: purchase.userId } }),
      prisma.company.findUnique({ where: { id: purchase.companyId } }),
    ]);

    const langCode = await getCompanyLanguageCode(purchase.companyId);
    const packName = pack
      ? resolvePackName({ ...pack, translations: await prisma.aiCreditPackTranslation.findMany({ where: { packId: pack.id }, include: { language: { select: { code: true } } } }) }, langCode)
      : null;

    const invoice = await createCreditInvoice({
      purchase: { ...purchase, status: "paid", paidAt: new Date() },
      user,
      company,
      pack,
      packName,
      paymentMethod: "Stripe",
    });

    await prisma.$transaction([
      prisma.aiCreditPurchase.update({
        where: { id: purchase.id },
        data:  { status: "paid", paidAt: new Date(), invoiceId: invoice.id },
      }),
      prisma.invoice.update({
        where: { id: invoice.id },
        data:  { status: "paid", paidAt: new Date(), paidAmount: Number(pack.priceUsd) },
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
          revenueUsd: Number(pack?.priceUsd ?? 0),
          meta:       { packId: purchase.packId, packSlug: pack?.slug, source: "stripe", purchaseId: purchase.id },
        },
      }),
    ]);

    invalidateLimitsCache(purchase.companyId);

    return res.json({
      success: true,
      message: `${purchase.credits} crédits activés.`,
      data:    { credits: purchase.credits },
    });
  } catch (err) {
    console.error("[confirmCreditStripe]", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
