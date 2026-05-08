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

router.get("/", listFAQCategories);
router.post("/reorder", reorderFAQCategories);
router.post("/", createFAQCategory);
router.get("/:id", getFAQCategory);
router.put("/:id", updateFAQCategory);
router.delete("/:id", deleteFAQCategory);

export default router;