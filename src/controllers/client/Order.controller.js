
import prisma  from "../../config/database.js";
import { getStripe, getWebhookSecret } from "../../services/Stripe.service.js";
import { createInvoiceFromOrder, formatInvoice } from "../../services/Invoice.service.js";
import { sendTemplatedMail }  from "../../services/client/mail.service.js";
import {
  buildOrderConfirmationCustomer,
  buildOrderNotificationAdmin,
  buildOrderNotificationSuperAdmin,
} from "../../templates/client/Orderemails.js";
import { generateNfcCardsForOrder } from "../../services/nfc.service.js";

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
    id:           o.id,
    orderNumber:  o.orderNumber,
    status:       o.status,
    companyId:    o.companyId,
    subtotal:     Number(o.subtotal),
    shippingCost: Number(o.shippingCost),
    total:        Number(o.total),
    currency:     o.currency     ?? "EUR",
    displayTotal: o.displayTotal ? Number(o.displayTotal) : null,
    exchangeRate: o.exchangeRate  ? Number(o.exchangeRate) : 1,
    shipping: {
      fullName: o.shippingFullName,  address:  o.shippingAddress,
      city:     o.shippingCity,      state:    o.shippingState,
      zip:      o.shippingZip,       country:  o.shippingCountry,
      method:   o.shippingMethod,
    },
    stripeClientSecret: o.stripeClientSecret ?? null,
    paidAt:     o.paidAt,
    createdAt:  o.createdAt,
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
export const getShippingRates = async (req, res, next) => {
  try {
    const currency     = req.query.currency?.toUpperCase() || "EUR";
    const exchangeRate = parseFloat(req.query.rate || "1");
    const rates = await prisma.shippingRate.findMany({
      where: { active: true }, orderBy: { price: "asc" },
    });
    res.json({
      success: true,
      data: rates.map((r) => ({
        id: r.id, method: r.method, label: r.label, description: r.description,
        priceEUR:     Number(r.price),
        displayPrice: Math.round(Number(r.price) * exchangeRate * 100) / 100,
        currency,
      })),
    });
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
      shippingMethod,
      currency     = "EUR",
      exchangeRate = 1,
    } = req.body;

    const cartItems = await prisma.cartItem.findMany({
      where:   { userId, companyId },
      include: {
        product:     { include: { translations: { take: 1, orderBy: { langId: "asc" } } } },
        design:      true,
        cardType:    true,
        packageTier: true,
      },
    });

    if (!cartItems.length) return res.status(422).json({ success: false, error: "Votre panier est vide" });

    const unvalidated = cartItems.filter(
      (i) => i.design && !["validated", "locked"].includes(i.design.status)
    );
    if (unvalidated.length) {
      return res.status(422).json({
        success: false,
        error:   `${unvalidated.length} design(s) non validé(s).`,
        code:    "DESIGNS_NOT_VALIDATED",
      });
    }

    const shippingRate = await prisma.shippingRate.findUnique({
      where: { method: shippingMethod || "standard" },
    });
    const shippingCostEUR = shippingRate?.price ?? 9.19;
    const subtotalEUR     = cartItems.reduce((s, i) => s + Number(i.lineTotal), 0);
    const totalEUR        = subtotalEUR + shippingCostEUR;
    const rate            = parseFloat(exchangeRate) || 1;
    const displayTotal    = Math.round(totalEUR * rate * 100) / 100;

    // ── Stripe depuis la DB ──────────────────────────────────
    const stripe = await getStripe();

    const paymentIntent = await stripe.paymentIntents.create({
      amount:   Math.round(totalEUR * 100),
      currency: "eur",
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId:          String(userId),
        companyId:       String(companyId),
        displayCurrency: currency,
        exchangeRate:    String(rate),
      },
    });

    const orderNumber = await generateOrderNumber();

    const order = await prisma.$transaction(async (tx) => {
      const o = await tx.order.create({
        data: {
          userId, companyId, orderNumber,
          status:       "pending",
          subtotal:     subtotalEUR,
          shippingCost: shippingCostEUR,
          total:        totalEUR,
          currency, displayTotal, exchangeRate: rate,
          shippingFullName: shippingFullName || null,
          shippingAddress:  shippingAddress  || null,
          shippingCity:     shippingCity     || null,
          shippingState:    shippingState    || null,
          shippingZip:      shippingZip      || null,
          shippingCountry:  shippingCountry  || "United States",
          shippingMethod:   shippingMethod   || "standard",
          stripePaymentIntentId: paymentIntent.id,
          stripeClientSecret:    paymentIntent.client_secret,
          items: {
            create: cartItems.map((item) => ({
              productId:    item.productId,
              packageTierId: item.packageTierId,
              totalCards:   item.totalCards,
              quantity:     item.totalCards,
              unitPrice:    Number(item.unitPrice),
              totalPrice:   Number(item.lineTotal),
              designId:     item.designId   || null,
              cardTypeId:   item.cardTypeId || null,
            })),
          },
        },
        include: {
          items: { include: { product: { include: { translations: { take: 1 } } }, design: true, cardType: true } },
        },
      });

      // Sauvegarder la conversion
      await tx.conversion.create({
        data: {
          orderId: o.id, currency, rate,
          displayTotal, baseCurrency: "EUR", baseTotal: totalEUR,
        },
      });

      // Verrouiller les designs
      const designIds = cartItems.filter((i) => i.designId).map((i) => i.designId);
      if (designIds.length) {
        await tx.design.updateMany({ where: { id: { in: designIds } }, data: { status: "locked" } });
      }

      return o;
    });

    res.status(201).json({
      success:            true,
      data:               formatOrder(order),
      stripeClientSecret: paymentIntent.client_secret,
      amounts: {
        subtotalEUR, shippingCostEUR, totalEUR, displayTotal, currency, exchangeRate: rate,
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
          user:    true,
          company: true,
          items: {
            include: {
              product:  { include: { translations: { take: 1, orderBy: { langId: "asc" } } } },
              design:   true,
              cardType: true,
            },
          },
        },
      });
 
      if (order && order.status === "pending") {
        const stripe  = await getStripe();
        const charges = await stripe.charges.list({ payment_intent: pi.id, limit: 1 });
        const charge  = charges.data[0];
 
        const methodLabel = charge?.payment_method_details?.card
          ? `${charge.payment_method_details.card.brand} •••• ${charge.payment_method_details.card.last4}`
          : "Stripe";
        const last4 = charge?.payment_method_details?.card?.last4   ?? null;
        const brand = charge?.payment_method_details?.card?.brand   ?? null;
        const stripeChargeId = charge?.id ?? null;
 
        
        await prisma.$transaction([
          prisma.order.update({
            where: { id: order.id },
            data:  { status: "paid", paidAt: new Date() },
          }),

          prisma.cartItem.deleteMany({
            where: { userId: order.userId, companyId: order.companyId },
          }),
        ]);
 
       
        const fullOrder = { ...order, status: "paid", paidAt: new Date() };
        const invoice   = await createInvoiceFromOrder(fullOrder);
 
        
        const payment = await prisma.payment.create({
          data: {
            orderId:    order.id,
            invoiceId:  invoice.id,
            companyId:  order.companyId,
            userId:     order.userId,
            amount:     Number(order.total),
            currency:   order.currency    ?? "EUR",
            exchangeRate: Number(order.exchangeRate ?? 1),
            displayAmount: order.displayTotal ? Number(order.displayTotal) : Number(order.total),
            stripePaymentIntentId: pi.id,
            stripeChargeId,
            method:      "card",
            methodLabel,
            last4,
            brand,
            status:     "completed",
            paidAt:     new Date(),
          },
        });
 
        // 4. Mettre à jour le mode de paiement sur la facture
        await prisma.invoice.update({
          where: { id: invoice.id },
          data:  { paymentMethod: methodLabel },
        });
 
        console.log(`[webhook] Paiement #${payment.id} enregistré pour commande #${order.orderNumber}`);

         // 5. ✅ NOUVEAU : Générer les cards NFC pour chaque item du design
        // Les cards sont générés au moment du paiement (pas de la validation du design)
        // Ils sont inactifs jusqu'à la livraison (order.status = "delivered")
        
        generateNfcCardsForOrder(fullOrder).catch((e) =>
          console.error("[webhook] Erreur génération NFC:", e.message)
        );
 
        // 5. Envoyer les 3 emails (asynchrone)
        sendOrderEmails(fullOrder, invoice).catch(console.error);

        console.log(`[webhook] Commande #${order.orderNumber} payée + NFC en cours de génération`);
      }
    } catch (e) {
      console.error("[webhook] Erreur traitement:", e.message);
    }
  }
 
  // Toujours répondre 200 à Stripe
  res.json({ received: true });
};

// ─── POST /api/orders/:id/refund ─────────────────────────────
// Superadmin — rembourser une commande via Stripe
export const refundOrder = async (req, res, next) => {
  try {
    const id     = parseInt(req.params.id);
    const amount = req.body.amount ? Math.round(parseFloat(req.body.amount) * 100) : undefined;
    const reason = req.body.reason || null;

    const order = await prisma.order.findUnique({
      where:   { id },
      include: { invoice: true },
    });
    if (!order) return res.status(404).json({ success: false, error: "Commande introuvable" });
    if (!order.stripePaymentIntentId) {
      return res.status(422).json({ success: false, error: "Aucun paiement Stripe associé" });
    }

    const stripe = await getStripe();

    // Récupérer le charge depuis le PaymentIntent
    const charges = await stripe.charges.list({ payment_intent: order.stripePaymentIntentId, limit: 1 });
    if (!charges.data.length) {
      return res.status(422).json({ success: false, error: "Aucune charge Stripe trouvée" });
    }

    const refund = await stripe.refunds.create({
      charge: charges.data[0].id,
      ...(amount && { amount }),
    });

    // Mettre à jour la commande et la facture
    await prisma.$transaction([
      prisma.order.update({
        where: { id },
        data:  { status: "refunded" },
      }),
      ...(order.invoice ? [
        prisma.invoice.update({
          where: { id: order.invoice.id },
          data:  { status: "refunded" },
        }),
        prisma.refund.create({
          data: {
            invoiceId:    order.invoice.id,
            amount:       amount ? amount / 100 : Number(order.total),
            reason,
            stripeRefundId: refund.id,
          },
        }),
      ] : []),
    ]);

    res.json({ success: true, message: "Remboursement effectué", refundId: refund.id });
  } catch (e) { next(e); }
};

// ─── GET /api/orders ──────────────────────────────────────────
export const listOrders = async (req, res, next) => {
  try {
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);
    const orders    = await prisma.order.findMany({
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
    const id        = parseInt(req.params.id);
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);
    const order     = await prisma.order.findFirst({
      where:   { id, userId, companyId },
      include: { items: { include: { product: { include: { translations: { take: 1 } } }, design: true, cardType: true } } },
    });
    if (!order) return res.status(404).json({ success: false, error: "Commande introuvable" });
    res.json({ success: true, data: formatOrder(order) });
  } catch (e) { next(e); }
};



// ─── Emails post-paiement ─────────────────────────────────────
async function sendOrderEmails(order, invoice) {
  if (order.confirmationEmailSentAt) return;
 
  const currency     = order.currency ?? "EUR";
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
      fallbackFn: () => applyV(buildOrderNotificationAdmin({ order, items, companyName: order.company.name, currency, displayTotal })),
    });
  }
  const saEmail = process.env.SUPERADMIN_EMAIL || process.env.MAIL_FROM_ADDRESS;
  if (saEmail) {
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

export const getPaymentMethods = async (req, res, next) => {
  try {
    const methods = await prisma.manualPaymentMethod.findMany({
      where: {
        status: "Active",
      },
      orderBy: { name: "asc" },
    });
    const formattedMethods = methods.map(method => ({
      ...method,
      supportedCurrencies: method.supportedCurrencies === "all" 
        ? ["all"] 
        : method.supportedCurrencies?.split(",").map(c => c.trim()) || []
    }));
    res.json({
      success: true,
      data: formattedMethods
    });
  } catch (e) {
    next(e);
  }
};