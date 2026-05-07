// ═══════════════════════════════════════════════════════════
// Routes Subscriptions Client
// ═══════════════════════════════════════════════════════════

import express from "express";
import {
    listPlans,
  getCurrentSubscription,
  checkoutSubscription,
  stripeWebhook,
  getPaymentMethods,
} from "../../controllers/client/subscriptions.controller.js";
import { authenticateAdmin, requireAdmin } from "../../middleware/auth.middleware.js";
import { requireActiveSubscription, requireFeature, checkLimit } from "../../middleware/subscription.middleware.js";

const router = express.Router();
const auth = [authenticateAdmin, requireAdmin];

// ─── Public/Semi-public ───────────────────────────────────────
router.get("/plans",  listPlans);
router.get("/payment-methods", getPaymentMethods);

// ─── Subscription Management ──────────────────────────────────
router.get("/current", ...auth, getCurrentSubscription);
router.post("/create", ...auth, checkoutSubscription);

// ─── Webhook Stripe ───────────────────────────────────────────
// IMPORTANT: Ce endpoint doit être AVANT le body parser JSON
// Dans app.js/server.js, ajouter cette route AVANT app.use(express.json())
router.post("/webhook", stripeWebhook);

// // Nécessite un abonnement actif
// router.post("/locations", authenticate, requireActiveSubscription, createLocation);

// // Nécessite la feature API
// router.post("/api/webhook", authenticate, requireFeature("api"), webhookHandler);

// // Vérifie la limite SMS
// router.post("/sms/send", authenticate, checkLimit("sms"), sendSMS);

export default router;