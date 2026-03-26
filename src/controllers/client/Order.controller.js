// src/controllers/order.controller.js
// companyId = company active dans le JWT

import prisma  from "../../config/database.js";
import Stripe  from "stripe";
import { sendTemplatedMail } from "../../services/mail.service.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

function getCompanyId(req) {
  const id = req.user?.companyId;
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
    id: o.id, orderNumber: o.orderNumber, status: o.status, companyId: o.companyId,
    subtotal: Number(o.subtotal), shippingCost: Number(o.shippingCost), total: Number(o.total),
    shipping: {
      fullName: o.shippingFullName, address: o.shippingAddress,
      city: o.shippingCity, state: o.shippingState,
      zip: o.shippingZip, country: o.shippingCountry, method: o.shippingMethod,
    },
    stripeClientSecret: o.stripeClientSecret,
    paidAt: o.paidAt,
    items: o.items?.map((i) => ({
      id: i.id,
      productName: i.product?.translations?.[0]?.title ?? "Product",
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice), totalPrice: Number(i.totalPrice),
      cardType: i.cardType?.name ?? null,
      design: i.design ? { id: i.design.id, businessName: i.design.businessName, cardModel: i.design.cardModel } : null,
    })),
    createdAt: o.createdAt,
  };
}

// GET /api/orders/shipping-rates
export const getShippingRates = async (req, res, next) => {
  try {
    const rates = await prisma.shippingRate.findMany({ where: { active: true }, orderBy: { price: "asc" } });
    res.json({ success: true, data: rates });
  } catch (e) { next(e); }
};

// POST /api/orders
export const createOrder = async (req, res, next) => {
  try {
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);
    const { shippingFullName, shippingAddress, shippingCity, shippingState, shippingZip, shippingCountry, shippingMethod } = req.body;

    // Charger LE panier de cette company
    const cartItems = await prisma.cartItem.findMany({
      where:   { userId, companyId },
      include: {
        product: { include: { translations: { take: 1, orderBy: { langId: "asc" } } } },
        design:  true, cardType: true,
      },
    });

    if (!cartItems.length) return res.status(422).json({ success: false, error: "Votre panier est vide" });

    const shippingRate = await prisma.shippingRate.findUnique({ where: { method: shippingMethod || "standard" } });
    const shippingCost = shippingRate?.price ?? 9.19;
    const subtotal     = cartItems.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
    const total        = subtotal + shippingCost;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100), currency: "eur",
      metadata: { userId: String(userId), companyId: String(companyId) },
    });

    const orderNumber = await generateOrderNumber();

    const order = await prisma.$transaction(async (tx) => {
      const o = await tx.order.create({
        data: {
          userId, companyId, orderNumber,
          subtotal, shippingCost, total,
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
              productId:  item.productId,
              designId:   item.designId  || null,
              cardTypeId: item.cardTypeId || null,
              quantity:   item.quantity,
              unitPrice:  Number(item.unitPrice),
              totalPrice: Number(item.unitPrice) * item.quantity,
            })),
          },
        },
        include: {
          items: {
            include: {
              product:  { include: { translations: { take: 1 } } },
              design: true, cardType: true,
            },
          },
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
      success: true, data: formatOrder(order),
      stripeClientSecret: paymentIntent.client_secret,
    });
  } catch (e) { next(e); }
};

// POST /api/orders/webhook
export const stripeWebhook = async (req, res, next) => {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook invalide: ${err.message}` });
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object;
    try {
      const order = await prisma.order.findUnique({
        where:   { stripePaymentIntentId: pi.id },
        include: {
          user:  true,
          items: { include: { product: { include: { translations: { take: 1 } } }, cardType: true } },
        },
      });
      if (order && order.status === "pending") {
        await prisma.$transaction([
          prisma.order.update({ where: { id: order.id }, data: { status: "paid", paidAt: new Date() } }),
          prisma.cartItem.deleteMany({ where: { userId: order.userId, companyId: order.companyId } }),
        ]);
        await sendOrderConfirmation(order);
      }
    } catch (e) { console.error("[webhook]", e.message); }
  }
  res.json({ received: true });
};

// GET /api/orders
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

// GET /api/orders/:id
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

async function sendOrderConfirmation(order) {
  if (order.confirmationEmailSentAt) return;
  const itemsList = order.items.map((i) =>
    `${i.product?.translations?.[0]?.title ?? "Product"} x${i.quantity} — ${Number(i.totalPrice).toFixed(2)} €`
  ).join("\n");

  await sendTemplatedMail({
    slug: "order_confirmation", to: order.user.email,
    variables: {
      customer_name: order.user.name || order.user.email,
      order_number:  order.orderNumber,
      order_total:   `${Number(order.total).toFixed(2)} €`,
      order_subtotal:`${Number(order.subtotal).toFixed(2)} €`,
      shipping_cost: `${Number(order.shippingCost).toFixed(2)} €`,
      shipping_method: order.shippingMethod,
      items_list:    itemsList, year: new Date().getFullYear().toString(),
    },
    fallbackFn: () => ({
      subject: `Confirmation de commande ${order.orderNumber}`,
      html:    `<p>Bonjour ${order.user.name},</p><p>Commande <strong>${order.orderNumber}</strong> confirmée. Total : <strong>${Number(order.total).toFixed(2)} €</strong></p>`,
      text:    `Commande ${order.orderNumber} confirmée. Total : ${Number(order.total).toFixed(2)} €`,
    }),
  });

  await prisma.order.update({ where: { id: order.id }, data: { confirmationEmailSentAt: new Date() } });
}