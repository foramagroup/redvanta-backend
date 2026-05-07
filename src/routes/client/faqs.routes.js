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
router.get("/faqs/categories", getFAQCategories);
router.get("/faqs", listPublicFAQs);
router.get("/faqs/:id", getFAQPublic);
router.post("/faqs/:id/feedback", voteFAQ);

export default router;