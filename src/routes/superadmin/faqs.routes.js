// ═══════════════════════════════════════════════════════════
// src/routes/superadmin/faqs.routes.js
// ═══════════════════════════════════════════════════════════

import express from "express";
import {
  listFAQs,
  getFAQ,
  createFAQ,
  updateFAQ,
  deleteFAQ,
  bulkActionFAQs,
  reorderFAQs,
  getFAQsStats,
  getFAQCategoriesForSelect
} from "../../controllers/superadmin/faqs.controller.js";
import { authenticateSuperAdmin, requireSuperAdmin } from "../../middleware/auth.middleware.js";

const router = express.Router();

// Toutes les routes nécessitent superadmin
router.use(authenticateSuperAdmin, requireSuperAdmin);

// ─── Stats ─────────────────────────────────────────────────
router.get("/stats", getFAQsStats);
router.get("/categories/select", getFAQCategoriesForSelect);
// ─── CRUD ──────────────────────────────────────────────────
router.get("/", listFAQs);
router.post("/", createFAQ);
router.get("/:id", getFAQ);
router.put("/:id", updateFAQ);
router.delete("/:id", deleteFAQ);

// ─── Bulk Actions ──────────────────────────────────────────
router.post("/bulk", bulkActionFAQs);
router.post("/reorder", reorderFAQs);

export default router;