// backend/src/controllers/webhookController.js
import Stripe from "stripe";
import prisma from "../config/prisma.js";
import QRCode from "qrcode";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-11-15"
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* =====================================================
 * 1️⃣  WEB-TO-TAG  (external system generates NFC tags)
 * ===================================================== */
export async function webToTag(req, res) {
  try {
    const secret = process.env.WEBHOOK_SECRET || "changeme";
    const sig = req.headers["x-webhook-signature"] || req.headers["x-api-key"];

    if (!sig || sig !== secret) {
      return res.status(401).json({ ok: false, error: "invalid signature" });
    }

    const {
      count = 1,
      locationId = null,
      productId = null,
      payloadBase = null
    } = req.body;

    if (!count || count < 1) {
      return res.status(400).json({ ok: false, error: "missing count" });
    }

    const created = [];

    const outputDir = path.join(process.cwd(), "uploads");
    const qrfolder = path.join(outputDir, "qrcodes");

    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(qrfolder, { recursive: true });

    for (let i = 0; i < count; i++) {
      const uid = uuidv4().replace(/-/g, "").slice(0, 16).toUpperCase();
      const id = uuidv4();

      const payload =
        payloadBase ||
        `${process.env.FRONT_URL || "http://localhost:3000"}/r?uid=${uid}`;

      // create NFC tag in DB
      const tag = await prisma.nFCTag.create({
        data: {
          id,
          uid,
          payload,
          locationId,
          productId,
          used: false
        }
      });

      // generate QR
      const qrFile = `qr_${id}.png`;
      const qrPath = path.join(qrfolder, qrFile);

      await QRCode.toFile(qrPath, payload, {
        margin: 1,
        scale: 8
      });

      // update DB with QR file path
      await prisma.nFCTag.update({
        where: { id },
        data: { qrCodeFile: qrFile }
      });

      created.push({
        id: tag.id,
        uid: tag.uid,
        payload,
        qrFile
      });
    }

    return res.json({ ok: true, created });
  } catch (err) {
    console.error("webToTag error:", err);
    return res.status(500).json({ ok: false, error: "server error" });
  }
}

/* =====================================================
 * 2️⃣ STRIPE WEBHOOK HANDLER
 * ===================================================== */
/* ⚠️ IMPORTANT ⚠️
 * This handler MUST be mounted in server.js with:
 *
 *   app.post("/api/webhook/stripe",
 *     express.raw({ type: "application/json" }),
 *     stripeWebhookHandler
 *   );
 *
 * Because Stripe requires RAW body for validation.
 */
export async function stripeWebhookHandler(req, res) {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Stripe webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        const order = await prisma.order.findUnique({
          where: { stripeSession: session.id }
        });

        if (order) {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              status: "paid",
              stripePaymentIntent: session.payment_intent || null
            }
          });
        }
        break;
      }

      case "payment_intent.succeeded":
        // you can handle more
        break;

      case "invoice.payment_failed":
        // ... handle failed payments
        break;

      default:
        break;
    }
  } catch (err) {
    console.error("Stripe webhook processing error:", err);
  }

  return res.json({ received: true });
}
