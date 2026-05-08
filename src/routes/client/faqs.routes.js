// ═══════════════════════════════════════════════════════════
// src/routes/client/faqs.routes.js
// ═══════════════════════════════════════════════════════════

import express from "express";
import {
  listPublicFAQs,
  getFAQPublic,
  voteFAQ,
  getFAQCategories,
} from "../../controllers/client/faqs.controller.js";

const router = express.Router();

// Public routes
router.get("/categories", getFAQCategories);
router.get("/", listPublicFAQs);
router.get("/:id", getFAQPublic);
router.post("/:id/feedback", voteFAQ);

export default router;