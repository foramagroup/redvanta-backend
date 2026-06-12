import express from "express";
import {
  getSettings,
  saveSettings,
  getUsage,
  getCredits,
  getCreditPacks,
  purchaseCredits,
} from "../../controllers/admin/aiSettings.controller.js";
import { generateReply } from "../../controllers/admin/aiGenerate.controller.js";
import { authenticateAdmin, requireAdmin } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticateAdmin, requireAdmin);

// Paramètres IA de la company
router.get("/settings",           getSettings);
router.put("/settings",           saveSettings);

// Usage du mois courant
router.get("/usage",              getUsage);

// Solde de crédits
router.get("/credits",            getCredits);
router.get("/credits/packs",      getCreditPacks);
router.post("/credits/purchase",  purchaseCredits);

// Génération IA — cœur du module
router.post("/generate",          generateReply);

export default router;
