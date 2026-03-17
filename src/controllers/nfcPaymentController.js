// backend/src/controllers/nfcPaymentController.js
import Stripe from "stripe";
import prisma from "../config/prisma.js";
import QRCode from "qrcode";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" });

export async function createNfcCheckoutSession(req, res) {
  try {
    const { priceId, success_url, cancel_url, metadata = {} } = req.body;
    if (!priceId) return res.status(400).json({ error: "priceId required" });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: success_url || process.env.STRIPE_SUCCESS_URL,
      cancel_url: cancel_url || process.env.STRIPE_CANCEL_URL,
      metadata
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("createNfcCheckoutSession", err);
    res.status(500).json({ error: "stripe error" });
  }
}

// webhook: must be mounted with express.raw({type: 'application/json'})
export async function stripeWebhookHandler(req, res) {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // create tag and assign to user (if email)
      let user = null;
      if (session.customer_details && session.customer_details.email) {
        user = await prisma.user.findUnique({ where: { email: session.customer_details.email }});
      }

      const tag = await prisma.nFCTag.create({ data: { userId: user?.id || null }});

      // generate QR code
      const qrFile = `qr_${tag.id}.png`;
      const qrPath = path.join(process.cwd(), "uploads", "qrcodes", qrFile);
      await fs.mkdir(path.dirname(qrPath), { recursive: true });
      await QRCode.toFile(qrPath, `${process.env.FRONT_URL}/nfc/${tag.id}`, { margin: 1, scale: 6 });

      await prisma.nFCTag.update({ where: { id: tag.id }, data: { qrCodeFile: qrFile }});

      // optional: create an order record linking session.id
      await prisma.order.create({
        data: {
          id: uuidv4(),
          orderNumber: `ORD-${Date.now()}`,
          customerEmail: session.customer_details?.email || null,
          totalCents: null,
          status: "paid",
          stripeSession: session.id
        }
      });
    }
  } catch (err) {
    console.error("Webhook processing error:", err);
  }

  res.json({ received: true });
}
