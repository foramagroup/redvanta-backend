
import { Router } from "express";
import { authenticateSuperAdmin, requireSuperAdmin } from "../../middleware/auth.middleware.js";
import {
  getStats, listInvoices, getInvoice,
  createInvoice, updateInvoice, refundInvoice,
  addManualPayment, listPayments, retryPayment,getPayment, deleteInvoice
} from "../../controllers/superadmin/Billing.controller.js";

const router = Router();
const auth   = [authenticateSuperAdmin, requireSuperAdmin];

// Stats dashboard
router.get ("/stats",   ...auth, getStats);

// Invoices CRUD
router.get("/invoices",     ...auth, listInvoices);
router.get("/invoices/:id", ...auth, getInvoice);
router.post("/invoices",     ...auth, createInvoice);
router.put("/invoices/:id", ...auth, updateInvoice);
router.delete("/invoices/:id", ...auth, deleteInvoice);

// Actions sur factures
router.post("/invoices/:id/refund",  ...auth, refundInvoice);
router.post("/invoices/retry",  ...auth, retryPayment);

// Paiements manuels
router.get ("/payments",     ...auth, listPayments);
router.get ("/payments/:id", ...auth, getPayment);
router.post("/payments",     ...auth, addManualPayment);

export default router;

// ─── src/routes/order.routes.js ──────────────────────────────
// Ajouter le refund sur les orders (superadmin)
// import { refundOrder } from "../controllers/order.controller.js";
// router.post("/:id/refund", authenticateSuperAdmin, requireSuperAdmin, refundOrder);