// ═══════════════════════════════════════════════════════════
// src/routes/superadmin/faqCategories.routes.js
// ═══════════════════════════════════════════════════════════

import express from "express";
import {
  listFAQCategories,
  getFAQCategory,
  createFAQCategory,
  updateFAQCategory,
  deleteFAQCategory,
  reorderFAQCategories,
} from "../../controllers/superadmin/faqCategories.controller.js";
import { authenticateSuperAdmin, requireSuperAdmin } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticateSuperAdmin, requireSuperAdmin);

router.get("/faq-categories", listFAQCategories);
router.post("/faq-categories", createFAQCategory);
router.get("/faq-categories/:id", getFAQCategory);
router.put("/faq-categories/:id", updateFAQCategory);
router.delete("/faq-categories/:id", deleteFAQCategory);
router.post("/faq-categories/reorder", reorderFAQCategories);

export default router;