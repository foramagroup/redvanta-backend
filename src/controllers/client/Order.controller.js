
import prisma  from "../../config/database.js";
import { resolveShipping } from "../superadmin/Shipping.controller.js";
import { getStripe, getWebhookSecret } from "../../services/Stripe.service.js";
import { createInvoiceFromOrder, formatInvoice, generateInvoiceNumber, createUnpaidInvoice} from "../../services/Invoice.service.js";
import { sendTemplatedMail, resolveCompanyLangId }  from "../../services/client/mail.service.js";
import {
  buildOrderConfirmationCustomer,
  buildOrderNotificationAdmin,
  buildOrderNotificationSuperAdmin,
} from "../../templates/client/Orderemails.js";
import { fulfillNfcForOrder } from "../../services/nfc.service.js";

function getCompanyId(req) {
  const id = req.user.companyId;
  if (!id) throw Object.assign(new Error("Aucune company active"), { status: 403 });
  return parseInt(id);
}

async function generateOrderNumber() {
  const year  = new Date().getFullYear();
  const count = await prisma.order.count();
  return `ORD-${year}-${String(count + 1).padStart(6, "0")}`;
}

function formatOrder(o) {
  return {
    id:            o.id,
    orderNumber:   o.orderNumber,
    status:        o.status,
    paymentMethod: o.methodPayment ?? "stripe",
    companyId:     o.companyId,
    subtotal:      Number(o.subtotal),
    shippingCost:  Number(o.shippingCost),
    total:         Number(o.total),
    currency:      o.currency     ?? "EUR",
    displayTotal:  o.displayTotal ? Number(o.displayTotal) : null,
    exchangeRate:  o.exchangeRate  ? Number(o.exchangeRate) : 1,
    shipping: {
      fullName: o.shippingFullName,  address:  o.shippingAddress,
      city:     o.shippingCity,      state:    o.shippingState,
      zip:      o.shippingZip,       country:  o.shippingCountry,
      method:   o.shippingMethod,    phone:    o.shippingPhone,
    },
    billing: {
      isCompany:   o.isCompany,
      companyName: o.companyName ?? null,
      taxId:       o.taxId       ?? null,
    },
    stripeClientSecret: o.stripeClientSecret ?? null,
    paidAt:    o.paidAt,
    createdAt: o.createdAt,
    items: o.items?.map((i) => ({
      id:          i.id,
      productName: i.product?.translations?.[0]?.title ?? "Product",
      totalCards:  i.totalCards,
      quantity:    i.quantity,
      unitPrice:   Number(i.unitPrice),
      totalPrice:  Number(i.totalPrice),
      cardType:    i.cardType?.name ?? null,
      design:      i.design ? { id: i.design.id, businessName: i.design.businessName, cardModel: i.design.cardModel } : null,
    })),
  };
}

// ─── GET /api/orders/shipping-rates ──────────────────────────
// Retourne les règles de livraison actives formatées comme des options sélectionnables.
// Le coût exact est recalculé à la création de commande selon le contexte adresse.
export const getShippingRates = async (req, res, next) => {
  try {
    const currency     = req.query.currency?.toUpperCase() || "EUR";
    const exchangeRate = parseFloat(req.query.rate || "1");

    const [rules, settings] = await Promise.all([
      prisma.shippingRule.findMany({
        where:   { active: true },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      }),
      prisma.platformSetting.findFirst(),
    ]);

    const fallbackCost = Number(settings?.shippingFallbackCost ?? 14.99);

    const formatScope = (r) => {
      if (r.country === "*") return "Worldwide";
      return [r.country, r.state, r.city].filter(Boolean).join(", ");
    };

    const estimatedCost = (r) => {
      switch (r.type) {
        case "flat":     return Number(r.flatCost ?? 0);
        case "free":     return 0;
        case "weight":   return Number(r.weightBaseCost ?? 0);
        case "price":    return r.priceTiers?.[0]?.cost != null ? Number(r.priceTiers[0].cost) : fallbackCost;
        case "quantity": return r.quantityTiers?.[0]?.cost != null ? Number(r.quantityTiers[0].cost) : fallbackCost;
        default:         return fallbackCost;
      }
    };

    const descriptionFor = (r) => {
      const scope = formatScope(r);
      switch (r.type) {
        case "free":     return r.freeMinTotal ? `Free above ${r.freeMinTotal} EUR — ${scope}` : `Free — ${scope}`;
        case "weight":   return `Base ${r.weightBaseCost} EUR + ${r.weightCostPerKg} EUR/kg — ${scope}`;
        case "price":    return `Price-based tiers — ${scope}`;
        case "quantity": return `Quantity-based tiers — ${scope}`;
        default:         return scope;
      }
    };

    const rates = rules.map((r) => {
      const priceEUR = estimatedCost(r);
      return {
        id:           r.id,
        method:       String(r.id),
        label:        r.name,
        description:  descriptionFor(r),
        priceEUR,
        displayPrice: Math.round(priceEUR * exchangeRate * 100) / 100,
        currency,
        type:         r.type,
        scope:        formatScope(r),
      };
    });

    if (!rates.length) {
      rates.push({
        id:           null,
        method:       "fallback",
        label:        "Standard Shipping",
        description:  "Default shipping rate",
        priceEUR:     fallbackCost,
        displayPrice: Math.round(fallbackCost * exchangeRate * 100) / 100,
        currency,
        type:         "flat",
        scope:        "Worldwide",
      });
    }

    res.json({ success: true, data: rates });
  } catch (e) { next(e); }
};


// ─── POST /api/orders ─────────────────────────────────────────
export const createOrder = async (req, res, next) => {
  try {
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);
    const {
      shippingFullName, shippingAddress, shippingCity,
      shippingState,   shippingZip,     shippingCountry,
      shippingMethod,  shippingPhone,
      isCompany = false, companyName, taxId,
      currency     = "EUR",
      exchangeRate = 1,
      paymentMethod,
      paymentMethodId = null,
    } = req.body;
 
    const isStripe = paymentMethod === "stripe";
    const isManual = paymentMethod === "manual";
 
    if (!isStripe && !isManual) {
      return res.status(422).json({ success: false, error: req.t("order.invalid_payment_method") });
    }
 
    let manualMethod = null;
    if (isManual) {
      if (!paymentMethodId) return res.status(422).json({ success: false, error: req.t("order.payment_method_id_required") });
      manualMethod = await prisma.manualPaymentMethod.findFirst({
        where: { id: parseInt(paymentMethodId), status: "Active" },
      });
      if (!manualMethod) return res.status(422).json({ success: false, error: req.t("order.manual_method_not_found") });
    }
 
    // ── Charger le panier — include locations v2 ──────────────
    const cartItems = await prisma.cartItem.findMany({
      where: { userId, companyId },
      include: {
        product:     { include: { translations: { take: 1, orderBy: { langId: "asc" } } } },
        design:      true,
        cardType:    true,
        packageTier: true,
        // ← v2 : locations avec leur design propre
        locations: {
          include: { design: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
 
    if (!cartItems.length) return res.status(422).json({ success: false, error: req.t("order.cart_empty") });
 
    // Vérifier qu'aucun design n'est déjà verrouillé
    // (legacy items uniquement — les locations ont chacune leur design)
    const legacyDesigns = cartItems.filter((i) => !i.locations?.length && i.design?.status === "locked");
    if (legacyDesigns.length) {
      return res.status(422).json({
        success: false,
        error:   req.t("order.designs_locked", { count: legacyDesigns.length }),
        code:    "DESIGNS_ALREADY_LOCKED",
      });
    }
 
    const subtotalEUR = cartItems.reduce((s, i) => s + Number(i.lineTotal), 0);
    const itemCount   = cartItems.reduce((s, i) => {
      const n = i.locations?.length > 0
        ? i.locations.reduce((a, l) => a + Number(l.quantity ?? 1), 0)
        : Number(i.quantity ?? 1);
      return s + n;
    }, 0);
    const totalWeight = itemCount * 0.05;

    const [shippingRulesAll, platformSettings] = await Promise.all([
      prisma.shippingRule.findMany({ where: { active: true }, orderBy: { priority: "desc" } }),
      prisma.platformSetting.findFirst(),
    ]);
    const fallbackCost    = Number(platformSettings?.shippingFallbackCost ?? 14.99);
    const shippingResult  = resolveShipping(shippingRulesAll, fallbackCost, {
      cartTotal: subtotalEUR, totalWeight, itemCount,
      country: shippingCountry ?? "", state: shippingState ?? "", city: shippingCity ?? "",
    });
    const shippingCostEUR = shippingResult.cost;
    const totalEUR        = subtotalEUR + shippingCostEUR;
    const rate            = parseFloat(exchangeRate) || 1;
    const displayTotal    = Math.round(totalEUR * rate * 100) / 100;
    const orderNumber     = await generateOrderNumber();
 
    let paymentIntent      = null;
    let stripeClientSecret = null;
 
    if (isStripe) {
      const stripe = await getStripe();
      paymentIntent = await stripe.paymentIntents.create({
        amount:   Math.round(totalEUR * 100),
        currency: "eur",
        automatic_payment_methods: { enabled: true },
        metadata: { userId: String(userId), companyId: String(companyId), displayCurrency: currency, exchangeRate: String(rate) },
      });
      stripeClientSecret = paymentIntent.client_secret;
    }
 
    const order = await prisma.$transaction(async (tx) => {
      // ── Construire les OrderItems ─────────────────────────────
      // v2 : un CartItem avec locations → N OrderItems (1 par location)
      // v1 : un CartItem sans location  → 1 OrderItem (comportement inchangé)
      const orderItemsData = cartItems.flatMap((item) => {
        const hasLocations = item.locations?.length > 0;
        if (hasLocations) {
          // ── v2 : 1 OrderItem par location ──────────────────
              return item.locations.map((loc) => ({
                productId:     item.productId,
                packageTierId: item.packageTierId ?? null,
                // la quantité de l'OrderItem = quantité de cette location
                totalCards:    loc.quantity,
                quantity:      loc.quantity,
                unitPrice:     Number(item.unitPrice),
                totalPrice:    loc.quantity * Number(item.unitPrice),
                // chaque location a son propre design
                designId:      loc.designId ?? null,
                cardTypeId:    item.cardTypeId ?? null,
              }));
        }
        // ── v1 legacy : 1 OrderItem par CartItem ───────────
        return [{
          productId:     item.productId,
          packageTierId: item.packageTierId ?? null,
          totalCards:    item.packageTierId == null ? item.quantity : item.totalCards,
          quantity:      item.packageTierId == null ? item.quantity : item.totalCards,
          unitPrice:     Number(item.unitPrice),
          totalPrice:    Number(item.lineTotal),
          designId:      item.designId   ?? null,
          cardTypeId:    item.cardTypeId ?? null,
        }];
      });
 
      const o = await tx.order.create({
        data: {
          userId, companyId, orderNumber,
          status:        isStripe ? "pending" : "unpaid",
          methodPayment: paymentMethod,
          manualPaymentMethodId: isManual ? manualMethod.id : null,
          subtotal: subtotalEUR, shippingCost: shippingCostEUR, total: totalEUR,
          currency, displayTotal, exchangeRate: rate,
          shippingFullName: shippingFullName || null,
          shippingAddress:  shippingAddress  || null,
          shippingCity:     shippingCity     || null,
          shippingState:    shippingState    || null,
          shippingZip:      shippingZip      || null,
          shippingCountry:  shippingCountry  || "France",
          shippingMethod:   shippingMethod   || "standard",
          shippingPhone:    shippingPhone    || null,
          isCompany:        Boolean(isCompany),
          companyName:      companyName      || null,
          taxId:            taxId            || null,
          stripePaymentIntentId: paymentIntent?.id ?? null,
          stripeClientSecret:    stripeClientSecret ?? null,
          items: { create: orderItemsData },
        },
        include: {
          user:    true,
          company: true,
          items: {
            include: {
              product: { include: { translations: { take: 1, orderBy: { langId: "asc" } } } },
              design:  true, cardType: true,
            },
          },
        },
      });
 
      await tx.conversion.create({
        data: { orderId: o.id, currency, rate, displayTotal, baseCurrency: "EUR", baseTotal: totalEUR },
      });
 
        if (isManual) {
          await tx.cartItem.deleteMany({ where: { userId, companyId } });
          console.log(`[order] Panier vidé pour paiement manuel - Order #${o.orderNumber}`);
        } else {
          console.log(`[order] Panier conservé pour paiement Stripe - Order #${o.orderNumber}`);
        }
      return o;
    });
 
    // ── CASH : créer la facture immédiatement en "unpaid" ─────
    let invoiceNumber = null;
    if (isManual) {
      const invoice = await createUnpaidInvoice(order);
      invoiceNumber = invoice.invoiceNumber;
      sendOrderPendingEmail(order, invoice, manualMethod).catch(console.error);
    }
 
    res.status(201).json({
      success:      true,
      data:         formatOrder(order),
      stripeClientSecret,
      paymentMethod,
      invoiceNumber,
      ...(isManual && {
        manualInstructions: manualMethod.instructions ?? null,
        message: req.t("order.order_created", { orderNumber: order.orderNumber, invoiceNumber }),
      }),
      amounts: {
        subtotalEUR, shippingCostEUR, totalEUR, displayTotal, currency, exchangeRate: rate,
        shippingRuleName:  shippingResult.ruleName,
        shippingMatchLevel: shippingResult.matchLevel,
        freeShipping:      shippingResult.freeShippingApplied,
      },
    });
  } catch (e) { next(e); }
};

// ─── POST /api/orders/webhook ─────────────────────────────────
export const stripeWebhook = async (req, res, next) => {
  const webhookSecret = await getWebhookSecret();
  const sig = req.headers["stripe-signature"];
  let event;
 
  try {
    const stripe = await getStripe();
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("[webhook] Signature invalide:", err.message);
    return res.status(400).json({ error: `Webhook invalide: ${err.message}` });
  }
 
  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object;
    try {
      const order = await prisma.order.findUnique({
        where:   { stripePaymentIntentId: pi.id },
        include: {
          user: true, company: true,
          items: {
            include: {
              product:  { include: { translations: { take: 1, orderBy: { langId: "asc" } } } },
              design: true, cardType: true,
            },
          },
        },
      });
 
      if (order && order.status === "pending") {
        const stripe  = await getStripe();
        const charges = await stripe.charges.list({ payment_intent: pi.id, limit: 1 });
        const charge  = charges.data[0];
        const methodLabel    = charge?.payment_method_details?.card
          ? `${charge.payment_method_details.card.brand} •••• ${charge.payment_method_details.card.last4}`
          : "Stripe";
        const last4          = charge?.payment_method_details?.card?.last4 ?? null;
        const brand          = charge?.payment_method_details?.card?.brand ?? null;
        const stripeChargeId = charge?.id ?? null;
 
        await prisma.$transaction([
          prisma.order.update({ where: { id: order.id }, data: { status: "paid", paidAt: new Date() } }),
          prisma.cartItem.deleteMany({ where: { userId: order.userId, companyId: order.companyId } }),
        ]);
 
        const fullOrder = { ...order, status: "paid", paidAt: new Date() };
        const invoice   = await createInvoiceFromOrder(fullOrder);
 
        await prisma.payment.create({
          data: {
            orderId:   order.id, invoiceId: invoice.id,
            companyId: order.companyId, userId: order.userId,
            amount:    Number(order.total),
            currency:  order.currency ?? "EUR",
            exchangeRate:  Number(order.exchangeRate ?? 1),
            displayAmount: order.displayTotal ? Number(order.displayTotal) : Number(order.total),
            stripePaymentIntentId: pi.id, stripeChargeId,
            method: "card", methodLabel, last4, brand,
            status: "completed", paidAt: new Date(),
          },
        });
 
        await prisma.invoice.update({ where: { id: invoice.id }, data: { paymentMethod: methodLabel } });
 
        // generateNfcCardsForOrder itère sur order.items
        // → fonctionne sans modification : chaque OrderItem (y compris les items de location v2)
        //   a son propre designId → une série de cartes NFC générées
        fulfillNfcForOrder(fullOrder).catch((e) =>
          console.error("[webhook] Erreur fulfillment NFC:", e.message)
        );
        sendOrderEmails(fullOrder, invoice).catch(console.error);
        console.log(`[webhook] Commande #${order.orderNumber} payée`);
      }
    } catch (e) {
      console.error("[webhook] Erreur traitement:", e.message);
    }
  }
 
  res.json({ received: true });
};



// ─── POST /api/orders/:id/refund ─────────────────────────────
// Superadmin — rembourser une commande via Stripe
export const refundOrder = async (req, res, next) => {
  try {
    const id     = parseInt(req.params.id);
    const amount = req.body.amount ? Math.round(parseFloat(req.body.amount) * 100) : undefined;
    const reason = req.body.reason || null;
    const order  = await prisma.order.findUnique({ where: { id }, include: { invoice: true } });
    if (!order) return res.status(404).json({ success: false, error: req.t("order.not_found") });
    if (!order.stripePaymentIntentId) return res.status(422).json({ success: false, error: req.t("order.no_stripe_payment") });
    const stripe  = await getStripe();
    const charges = await stripe.charges.list({ payment_intent: order.stripePaymentIntentId, limit: 1 });
    if (!charges.data.length) return res.status(422).json({ success: false, error: req.t("order.no_stripe_charge") });
    const refund  = await stripe.refunds.create({ charge: charges.data[0].id, ...(amount && { amount }) });
    await prisma.$transaction([
      prisma.order.update({ where: { id }, data: { status: "refunded" } }),
      ...(order.invoice ? [
        prisma.invoice.update({ where: { id: order.invoice.id }, data: { status: "refunded" } }),
        prisma.refund.create({ data: { invoiceId: order.invoice.id, amount: amount ? amount / 100 : Number(order.total), reason, stripeRefundId: refund.id } }),
      ] : []),
    ]);
    res.json({ success: true, message: req.t("superadmin.billing.refund_done"), refundId: refund.id });
  } catch (e) { next(e); }
};

// ─── GET /api/orders ──────────────────────────────────────────
export const listOrders = async (req, res, next) => {
  try {
    const userId = req.user.userId; const companyId = getCompanyId(req);
    const orders = await prisma.order.findMany({
      where:   { userId, companyId },
      include: { items: { include: { product: { include: { translations: { take: 1 } } }, design: true, cardType: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: orders.map(formatOrder) });
  } catch (e) { next(e); }
};

// ─── GET /api/orders/:id ──────────────────────────────────────
export const getOrder = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id); const userId = req.user.userId; const companyId = getCompanyId(req);
    const order = await prisma.order.findFirst({
      where:   { id, userId, companyId },
      include: { items: { include: { product: { include: { translations: { take: 1 } } }, design: true, cardType: true } } },
    });
    if (!order) return res.status(404).json({ success: false, error: req.t("order.not_found") });
    res.json({ success: true, data: formatOrder(order) });
  } catch (e) { next(e); }
};


export const getPaymentMethods = async (req, res, next) => {
  try {
    const manualMethods = await prisma.manualPaymentMethod.findMany({
      where: { status: "Active" }, orderBy: { name: "asc" },
    });
    res.json({
      success: true,
      data: [
        ...manualMethods.map((m) => ({
          id:   m.id, type: "manual", name: m.name,
          instructions: m.instructions ?? null,
          verificationRequired: m.verificationRequired,
          supportedCurrencies: m.supportedCurrencies === "all"
            ? ["all"]
            : m.supportedCurrencies?.split(",").map((c) => c.trim()) || [],
        })),
      ],
    });
  } catch (e) { next(e); }
};








// ─── Emails post-paiement ─────────────────────────────────────
async function sendOrderEmails(order, invoice) {
  if (order.confirmationEmailSentAt) return;

  const langId   = await resolveCompanyLangId(order.companyId);
  const currency = order.currency ?? "EUR";
  const rate         = Number(order.exchangeRate ?? 1);
  const displayTotal = order.displayTotal ? Number(order.displayTotal) : Number(order.total);
 
  const items = order.items.map((i) => ({
    productName:      i.product?.translations?.[0]?.title ?? "Product",
    totalCards:       i.totalCards,
    unitPrice:        Number(i.unitPrice),
    totalPrice:       Number(i.totalPrice),
    displayLineTotal: Math.round(Number(i.totalPrice) * rate * 100) / 100,
  }));
 
  const shippingLabel = {
    standard: "Standard (5-7j)", express: "Express (2-3j)", international: "International (10-14j)",
  }[order.shippingMethod] ?? order.shippingMethod;
 
  const vars = {
    customer_name:    order.user.name  || order.user.email,
    company_name:     order.company.name,
    admin_email:      order.user.email,
    order_number:     order.orderNumber,
    invoice_number:   invoice?.invoiceNumber ?? "-",
    total:            String(Math.round(Number(order.total) * rate * 100) / 100),
    subtotal:         String(Math.round(Number(order.subtotal) * rate * 100) / 100),
    shipping_cost:    String(Math.round(Number(order.shippingCost) * rate * 100) / 100),
    shipping_method:  shippingLabel,
    shipping_name:    order.shippingFullName  ?? "",
    shipping_address: order.shippingAddress   ?? "",
    shipping_city:    order.shippingCity      ?? "",
    shipping_state:   order.shippingState     ?? "",
    shipping_zip:     order.shippingZip       ?? "",
    shipping_country: order.shippingCountry   ?? "",
    currency,
    order_date: new Date(order.createdAt).toLocaleDateString("fr-FR"),
    year:       String(new Date().getFullYear()),
    items_html: items.map((i) =>
      `<p style="margin:4px 0;font-size:13px">• ${i.productName} × ${i.totalCards} cartes — ${i.displayLineTotal} ${currency}</p>`
    ).join(""),
  };
 
  const applyV = (p) => {
    const r = (s) => s?.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "") ?? "";
    return { subject: r(p.subject), html: r(p.html), text: r(p.text) };
  };
 
  await sendTemplatedMail({
    slug:       "order_confirmation_customer",
    to:         order.user.email,
    variables:  vars,
    langId,
    fallbackFn: () => applyV(buildOrderConfirmationCustomer({ order, items, currency, displayTotal })),
  });

  const ownerLink = await prisma.userCompany.findFirst({
    where: { companyId: order.companyId, isOwner: true },
    include: { user: true },
  });
  if (ownerLink && ownerLink.user.email !== order.user.email) {
    await sendTemplatedMail({
      slug:       "order_confirmation_admin",
      to:         ownerLink.user.email,
      variables:  vars,
      langId,
      fallbackFn: () => applyV(buildOrderNotificationAdmin({ order, items, companyName: order.company.name, currency, displayTotal })),
    });
  }
  const saEmail = process.env.SUPERADMIN_EMAIL || process.env.MAIL_FROM_ADDRESS;
  if (saEmail) {
    // Superadmin → langue système par défaut (pas langId de la company)
    await sendTemplatedMail({
      slug:       "order_notification_superadmin",
      to:         saEmail,
      variables:  vars,
      fallbackFn: () => applyV(buildOrderNotificationSuperAdmin({ order, companyName: order.company.name, adminEmail: order.user.email, currency, displayTotal })),
    });
  }
 
  await prisma.order.update({ where: { id: order.id }, data: { confirmationEmailSentAt: new Date() } });
  console.log(`[order] Emails envoyés pour #${order.orderNumber}`);
}
 
async function sendOrderPendingEmail(order, invoice, manualMethod) {
  try {
    const langId = await resolveCompanyLangId(order.companyId);
    await sendTemplatedMail({
      slug: "order_pending_payment",
      to:   order.user.email,
      langId,
      variables: {
        customer_name:        order.user?.name || order.user?.email,
        order_number:         order.orderNumber,
        invoice_number:       invoice.invoiceNumber,
        total:                String(Number(order.total).toFixed(2)),
        currency:             order.currency ?? "EUR",
        payment_method:       manualMethod.name,
        payment_instructions: manualMethod.instructions ?? "",
        due_date:             new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("fr-FR"),
      },
      fallbackFn: () => ({
      subject: `Order ${order.orderNumber} — Awaiting payment`,
      html: `
        <p>Hello ${order.user?.name ?? ""},</p>
        <p>Your order <strong>${order.orderNumber}</strong> has been created.</p>
        <p>Invoice: <strong>${invoice.invoiceNumber}</strong> — Amount: <strong>${Number(order.total).toFixed(2)} ${order.currency ?? "EUR"}</strong></p>
        <p>Payment Method: <strong>${manualMethod.name}</strong></p>
        ${manualMethod.instructions ? `<p>Instructions: ${manualMethod.instructions}</p>` : ""}
        <p>Your order will be processed as soon as payment is received.</p>
      `,
      text: `Order ${order.orderNumber} created. Invoice ${invoice.invoiceNumber} - ${Number(order.total).toFixed(2)} ${order.currency ?? "EUR"} awaiting payment via ${manualMethod.name}.`,
    }),
    });
  } catch (e) {
    console.error("[order] Erreur email pending:", e.message);
  }
}

