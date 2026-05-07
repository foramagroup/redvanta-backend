// ═══════════════════════════════════════════════════════════
// src/routes/superadmin/staticPages.routes.js
// ═══════════════════════════════════════════════════════════

import express from "express";
import {
  listPages,
  getPage,
  createPage,
  updatePage,
  deletePage,
  duplicatePage,
  updatePageStatus,
  getPagesStats,
} from "../../controllers/superadmin/staticPages.controller.js";
import { authenticateSuperAdmin, requireSuperAdmin } from "../../middleware/auth.middleware.js";

const router = express.Router();

// Toutes les routes nécessitent superadmin
router.use(authenticateSuperAdmin, requireSuperAdmin);

// ─── Stats ─────────────────────────────────────────────────
router.get("/pages/stats", getPagesStats);

// ─── CRUD ──────────────────────────────────────────────────
router.get("/pages", listPages);
router.post("/pages", createPage);
router.get("/pages/:id", getPage);
router.put("/pages/:id", updatePage);
router.delete("/pages/:id", deletePage);

// ─── Actions ───────────────────────────────────────────────
router.post("/pages/:id/duplicate", duplicatePage);
router.patch("/pages/:id/status", updatePageStatus);

export default router;