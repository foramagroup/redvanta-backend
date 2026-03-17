// backend/src/controllers/paymentController.js
import express from "express";
import prisma from "../config/prisma.js"; // adapte selon ta config db
import Stripe from "stripe";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" });

/**
 * POST /api/payments/create-session
 * body: { items: [{ productId, quantity }], metadata: { customerEmail, ... }, success_url, cancel_url }
 */
router.post("/create-session", async (req, res) => {
  try {
    const { items = [], metadata = {}, success_url, cancel_url } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No items provided" });
    }

    // Compose line_items from DB products (must have stripePriceId)
    const line_items = [];
    let totalCents = 0;
    for (const it of items) {
      const product = await prisma.product.findUnique({ where: { id: it.productId }});
      if (!product) return res.status(400).json({ error: `Product ${it.productId} not found` });
      if (!product.stripePriceId) return res.status(400).json({ error: `Product ${it.productId} missing stripePriceId` });
      line_items.push({ price: product.stripePriceId, quantity: it.quantity || 1 });
      totalCents += (product.priceCents || 0) * (it.quantity || 1);
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items,
      metadata,
      success_url: success_url || process.env.STRIPE_SUCCESS_URL,
      cancel_url: cancel_url || process.env.STRIPE_CANCEL_URL,
    });

    // Create placeholder order in DB
    const order = await prisma.order.create({
      data: {
        id: uuidv4(),
        orderNumber: `ORD-${Date.now()}`,
        customerEmail: metadata.customerEmail || null,
        totalCents,
        status: "pending",
        stripeSession: session.id,
      }
    });

    return res.json({ url: session.url, sessionId: session.id, orderId: order.id });
  } catch (err) {
    console.error("paymentController.create-session:", err);
    return res.status(500).json({ error: "stripe/create-session error" });
  }
});

export default router;
