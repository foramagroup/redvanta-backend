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
router.get("/stats", getPagesStats);

// ─── CRUD ──────────────────────────────────────────────────
router.get("/", listPages);
router.post("/", createPage);
router.get("/:id", getPage);
router.put("/:id", updatePage);
router.delete("/:id", deletePage);

// ─── Actions ───────────────────────────────────────────────
router.post("/:id/duplicate", duplicatePage);
router.patch("/:id/status", updatePageStatus);

export default router;