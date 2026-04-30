// src/routes/designs.superadmin.routes.js
// ─────────────────────────────────────────────────────────────
// ROUTER SUPERADMIN — /api/superadmin/designs
// À monter dans app.js :
//   import designsSuperadminRoutes from "./routes/designs.superadmin.routes.js";
//   app.use("/api/superadmin/designs", designsSuperadminRoutes);
// ─────────────────────────────────────────────────────────────

import { Router } from "express";
import { authenticateSuperAdmin, requireSuperAdmin } from "../../middleware/auth.middleware.js";
import {
  getSuperadminDesignStats,
  listAllDesigns,
  getSuperadminDesign,
  flagDesign,
  unflagDesign,
  archiveDesignSuperadmin,
  deleteDesignSuperadmin,
} from "../../controllers/superadmin/allDesigns.controller.js";

const router = Router();
const auth = [authenticateSuperAdmin, requireSuperAdmin];

// ── Lecture ───────────────────────────────────────────────────
router.get("/stats",  ...auth, getSuperadminDesignStats); // GET /api/superadmin/designs/stats
router.get("/",       ...auth, listAllDesigns);           // GET /api/superadmin/designs
router.get("/:id",    ...auth, getSuperadminDesign);      // GET /api/superadmin/designs/:id

// ── Modération ────────────────────────────────────────────────
router.patch("/:id/flag",    ...auth, flagDesign);                // PATCH /api/superadmin/designs/:id/flag
router.patch("/:id/unflag",  ...auth, unflagDesign);              // PATCH /api/superadmin/designs/:id/unflag
router.patch("/:id/archive", ...auth, archiveDesignSuperadmin);   // PATCH /api/superadmin/designs/:id/archive

// ── Suppression ───────────────────────────────────────────────
router.delete("/:id", ...auth, deleteDesignSuperadmin);           // DELETE /api/superadmin/designs/:id

export default router;