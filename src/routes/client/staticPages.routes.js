// ═══════════════════════════════════════════════════════════
// src/routes/client/staticPages.routes.js
// ═══════════════════════════════════════════════════════════

import express from "express";
import {
  getPageBySlug,
  listPublicPages,
} from "../../controllers/client/staticPages.controller.js";

const router = express.Router();

// Public routes
router.get("/", listPublicPages);
router.get("/:slug", getPageBySlug);

export default router;