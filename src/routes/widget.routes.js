// src/routes/widget.routes.js
// Monté dans app.js : app.use("/api/admin/widgets", widgetAdminRoutes)

import { Router } from "express";
import { authenticateAdmin, requireAdmin } from "../middleware/auth.middleware.js";
import {
  listWidgets,
  createWidget,
  getWidget,
  updateWidget,
  deleteWidget,
  toggleStatus,
  duplicateWidget,
  regenerateToken,
  getWidgetAnalytics,
  getOverviewAnalytics,
} from "../controllers/widget.controller.js";

const router = Router();
const auth = [authenticateAdmin, requireAdmin];

// GET  /api/admin/widgets
router.get("/", ...auth, listWidgets);

// POST /api/admin/widgets
router.post("/", ...auth, createWidget);

// GET  /api/admin/widgets/analytics/overview?range=daily|weekly|monthly
router.get("/analytics/overview", ...auth, getOverviewAnalytics);

// GET  /api/admin/widgets/:id
router.get("/:id", ...auth, getWidget);

// PUT  /api/admin/widgets/:id
router.put("/:id", ...auth, updateWidget);

// DELETE /api/admin/widgets/:id
router.delete("/:id", ...auth, deleteWidget);

// PATCH /api/admin/widgets/:id/status  { status: "active"|"paused" }
router.patch("/:id/status", ...auth, toggleStatus);

// POST /api/admin/widgets/:id/duplicate
router.post("/:id/duplicate", ...auth, duplicateWidget);

// POST /api/admin/widgets/:id/token/regenerate
router.post("/:id/token/regenerate", ...auth, regenerateToken);

// GET  /api/admin/widgets/:id/analytics?range=daily|weekly|monthly
router.get("/:id/analytics", ...auth, getWidgetAnalytics);

export default router;
