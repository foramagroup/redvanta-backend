import { Router } from "express";
import { authenticateAdmin, requireAdmin } from "../middleware/auth.middleware.js";
import {
  getMyDesignStats,
  listMyDesigns,
  getMyDesign,
  duplicateMyDesign,
  renameMyDesign,
  archiveMyDesign,
  restoreMyDesign,
  deleteMyDesign
} from "../controllers/myDesign.controller.js";

// ─────────────────────────────────────────────────────────────
// ROUTER CLIENT ADMIN — /api/nfc
// ─────────────────────────────────────────────────────────────

const router = Router();

const auth = [authenticateAdmin, requireAdmin];
router.get("/stats",           ...auth,        getMyDesignStats);
router.get("/",           ...auth,        listMyDesigns);
router.get("/:id",        ...auth,      getMyDesign);
router.post("/:id/duplicate",        ...auth,      duplicateMyDesign);
router.patch("/:id/rename",   ...auth,   renameMyDesign);      // PATCH /api/designs/my/:id/rename
router.patch("/:id/archive",   ...auth,  archiveMyDesign);     // PATCH /api/designs/my/:id/archive
router.patch("/:id/restore",   ...auth,  restoreMyDesign);     // PATCH /api/designs/my/:id/restore
router.delete("/:id",          ...auth,  deleteMyDesign);      // DELETE /api/designs/my/:id
export default router;
// ?format=svg|png|pdf — Feuille d'impression : RECTO en haut / VERSO en bas
// clientNfcRouter.get("/cards/:uid/export",  ...auth,     downloadCardExport);
// clientNfcRouter.post("/cards/:uid/regenerate",  ...auth,  regenerateCardExport);
