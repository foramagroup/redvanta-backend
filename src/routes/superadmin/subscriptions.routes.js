// ═══════════════════════════════════════════════════════════
// src/routes/superadmin/subscriptions.routes.js
// ═══════════════════════════════════════════════════════════

import express from "express";
import {
  listAllSubscriptions,
  getSubscriptionDetails,
  markSubscriptionInvoicePaid,
  updateSubscriptionStatus,
  getPendingSubscriptionInvoices,
} from "../../controllers/superadmin/subscriptions.controller.js";
import { authenticateSuperAdmin, requireSuperAdmin } from '../../middleware/auth.middleware.js';

const router = express.Router();

// Toutes les routes nécessitent superadmin
router.use(authenticateSuperAdmin, requireSuperAdmin);

// ─── Subscriptions Management ─────────────────────────────────
router.get("/", listAllSubscriptions);
router.get("/:id", getSubscriptionDetails);
router.put("/:id/status", updateSubscriptionStatus);

// ─── Invoices Management ──────────────────────────────────────
router.get("/invoices/pending", getPendingSubscriptionInvoices);

// ─── MARK PAID (identique au webhook Stripe) ──────────────────
router.post("/invoices/:invoiceId/mark-paid", markSubscriptionInvoicePaid);

export default router;