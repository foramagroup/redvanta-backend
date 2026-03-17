import express from "express";
import { createNfcCheckoutSession, stripeWebhookHandler } from "../controllers/nfcPaymentController.js";
const router = express.Router();

router.post("/checkout", createNfcCheckoutSession);

// webhook route should be mounted separately with raw body parser at /webhooks/stripe
// but we export handler here for use
export default router;
export { stripeWebhookHandler };
