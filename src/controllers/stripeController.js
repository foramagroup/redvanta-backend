import Stripe from "stripe";
import prisma from "../config/prisma.js"; // si tu utilises prisma
import { v4 as uuidv4 } from "uuid";
import QRCode from "qrcode";
import path from "path";
import fs from "fs/promises";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" });

export async function listPrices(req, res) {
  try {
    const prices = await stripe.prices.list({ limit: 20, expand: ["data.product"] });
    const mapped = prices.data.map(p => ({
      priceId: p.id,
      unit_amount: p.unit_amount,
      currency: p.currency,
      name: p.product?.name || p.lookup_key || p.product,
      product: p.product
    }));
    res.json(mapped);
  } catch (err) {
    console.error("listPrices", err);
    res.status(500).json({ error: "stripe error" });
  }
}

export async function createCheckoutSession(req, res) {
  try {
    const { priceId, success_url, cancel_url, metadata } = req.body;
    if (!priceId) return res.status(400).json({ error: "priceId required" });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: success_url || process.env.STRIPE_SUCCESS_URL,
      cancel_url: cancel_url || process.env.STRIPE_CANCEL_URL,
      metadata: metadata || {}
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("createCheckoutSession", err);
    res.status(500).json({ error: "stripe error" });
  }
}

// Webhook handler (raw body required when mounting)
export async function stripeWebhookHandler(req, res) {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature error", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle events
  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // Optional: create order in DB
      try {
        await prisma.order.create({
          data: {
            id: uuidv4(),
            orderNumber: `ORD-${Date.now()}`,
            customerEmail: session.customer_details?.email || null,
            totalCents: session.amount_total || null,
            status: "paid",
            stripeSession: session.id
          }
        });
      } catch (dbErr) {
        console.error("DB create order error", dbErr);
      }

      // Optionally provision NFC tag, QR, etc. (example)
      // const tag = await prisma.nFCTag.create({ data: { userId: null }});
      // create QR file, update tag.qrCodeFile...
    }

    // ack
    res.json({ received: true });
  } catch (err) {
    console.error("Webhook processing error", err);
    res.status(500).json({ error: "processing failed" });
  }
}
