/**
 * orderController.js
 */
import express from "express";
import prisma from "../prismaClient.js";
import stripe from '../config/stripe.js';
import { ok, fail } from '../utils/responses.js';
const router = express.Router();

export const orderController = {
  async createCheckout(req, res) {
    try {
      const { productId, email, personalized, upsell } = req.body;

      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) return fail(res, 404, 'Produit introuvable');

      const lineItems = [
        { price: product.stripePriceId, quantity: 1 }
      ];

      if (upsell && product.upsellPriceCents > 0) {
        const stripeUpsell = await stripe.prices.create({
          product: product.stripeProductId,
          unit_amount: product.upsellPriceCents,
          currency: 'eur'
        });
        lineItems.push({ price: stripeUpsell.id, quantity: 1 });
      }

      const session = await stripe.checkout.sessions.create({
        customer_email: email,
        mode: 'payment',
        line_items: lineItems,
        success_url: `${process.env.URL_DEV_FRONTEND}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.URL_DEV_FRONTEND}/checkout/cancel`
      });

      const order = await prisma.order.create({
        data: {
          productId,
          customerEmail: email,
          stripeSessionId: session.id,
          status: 'pending',
          withUpsell: !!upsell,
          personalized
        }
      });

      return ok(res, { url: session.url, order });
    } catch (err) {
      return fail(res, 500, err.message);
    }
  },

  async myOrders(req, res) {
    try {
      const orders = await prisma.order.findMany({
        where: { customerEmail: req.user.email },
        include: { product: true }
      });
      return ok(res, { orders });
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }
};

router.get("/", async (req, res) => {
  const orders = await prisma.order.findMany({ orderBy: { createdAt: "desc" }});
  res.json({ orders });
});

// create checkout session - simplified
router.post("/create-checkout-session", async (req, res) => {
  try {
    const { items, email, affiliateCode } = req.body;
    // items: [{ price: stripePriceId, quantity }]
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: items,
      success_url: `${process.env.URL_DEV_FRONTEND}/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL_DEV_FRONTEND}/`
    });
    const order = await prisma.order.create({
      data: { orderNumber: `ORD-${Date.now()}`, totalCents: items.reduce((s,i)=>s + ((i.unit_amount || 0) * (i.quantity||1)),0), currency: "EUR", status: "pending", stripeSession: session.id, customerEmail: email }
    });
    // link affiliate if provided
    if (affiliateCode) {
      const aff = await prisma.affiliate.findUnique({ where: { code: affiliateCode }});
      if (aff) await prisma.order.update({ where: { id: order.id }, data: { affiliateId: aff.id }});
    }
    res.json({ url: session.url, orderId: order.id, session });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

export default router;
