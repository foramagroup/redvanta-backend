import express from "express";
import {
  getSettings,
  saveSettings,
  getUsage,
  getCredits,
} from "../controllers/aiSettings.controller.js";
import {
  getCreditPacks,
  getCreditPaymentMethods,
  requestCreditPurchase,
  confirmCreditStripe,
} from "../controllers/aiCreditPurchase.controller.js";
import { generateReply } from "../controllers/aiGenerate.controller.js";
import {
  getSettings as getAutoReplySettings,
  saveSettings as saveAutoReplySettings,
  getHistory as getAutoReplyHistory,
  processReply,
  publishReply,
} from "../controllers/autoReply.controller.js";
import {
  getBoosterAnalytics,
} from "../controllers/reviewBooster.controller.js";
import { authenticateAdmin, requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticateAdmin, requireAdmin);

// Paramètres IA de la company
router.get("/settings",                   getSettings);
router.put("/settings",                   saveSettings);

// Usage du mois courant
router.get("/usage",                      getUsage);

// Solde de crédits
router.get("/credits",                    getCredits);
router.get("/credits/packs",              getCreditPacks);
router.get("/credits/payment-methods",    getCreditPaymentMethods);
router.post("/credits/request",           requestCreditPurchase);
router.post("/credits/confirm",           confirmCreditStripe);

// Génération IA — cœur du module
router.post("/generate",                  generateReply);

// Auto Reply
router.get("/auto-reply/settings",        getAutoReplySettings);
router.put("/auto-reply/settings",        saveAutoReplySettings);
router.get("/auto-reply/history",         getAutoReplyHistory);
router.post("/auto-reply/process",        processReply);
router.post("/auto-reply/:id/publish",    publishReply);
router.post("/auto-reply/:id/retry",      publishReply);

// Review Booster analytics
router.get("/review-booster/analytics",   getBoosterAnalytics);

export default router;
