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
  cancelSubscription,
  activateSubscription,
  pauseSubscription,
  sendSubscriptionInvoiceEmail,
  listAllAddonBilling,
} from "../../controllers/superadmin/subscriptions.controller.js";
import { authenticateSuperAdmin, requireSuperAdmin } from '../../middleware/auth.middleware.js';

const router = express.Router();

// Toutes les routes nécessitent superadmin
router.use(authenticateSuperAdmin, requireSuperAdmin);

// ─── Invoices (avant /:id pour éviter le conflit de routing) ─────
router.get("/invoices/pending", getPendingSubscriptionInvoices);
router.post("/invoices/:invoiceId/mark-paid", markSubscriptionInvoicePaid);

// ─── Addon Billing (avant /:id pour éviter le conflit de routing) ─
router.get("/addon-billing", listAllAddonBilling);

// ─── Subscriptions Management ─────────────────────────────────
router.get("/",    listAllSubscriptions);
router.get("/:id", getSubscriptionDetails);
router.put("/:id/status",       updateSubscriptionStatus);
router.post("/:id/cancel",      cancelSubscription);
router.post("/:id/activate",    activateSubscription);
router.post("/:id/pause",       pauseSubscription);
router.post("/:id/send-invoice", sendSubscriptionInvoiceEmail);

export default router;