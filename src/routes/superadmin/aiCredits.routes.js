import express from "express";
import {
  listAllCreditPurchases,
  markCreditPurchasePaid,
  sendCreditInvoiceEmail,
} from "../../controllers/superadmin/aiCredits.controller.js";
import { authenticateSuperAdmin, requireSuperAdmin } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticateSuperAdmin, requireSuperAdmin);

router.get("/",                        listAllCreditPurchases);
router.post("/:id/mark-paid",          markCreditPurchasePaid);
router.post("/:id/send-invoice",       sendCreditInvoiceEmail);

export default router;
