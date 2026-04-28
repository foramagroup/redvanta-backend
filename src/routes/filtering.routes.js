// src/routes/filtering.routes.js
// Monté dans app.js via : app.use("/api/admin/filtering", filteringRoutes)
//
// NOTE : les membres de l'équipe viennent de GET /api/admin/team
// → plus de route /filtering/team (évite la duplication)

import { Router } from "express";
import { authenticateAdmin, requireAdmin } from "../middleware/auth.middleware.js";

import {
  getFilteringConfig,
  saveFilteringConfig,
  testFiltering,
} from "../controllers/Filtering.controller.js";

const router = Router();
const auth = [authenticateAdmin, requireAdmin];

router.get  ("/config", ...auth, getFilteringConfig);   // GET  /api/admin/filtering/config
router.put  ("/config", ...auth, saveFilteringConfig);  // PUT  /api/admin/filtering/config
router.post ("/test",   ...auth, testFiltering);        // POST /api/admin/filtering/test

export default router;