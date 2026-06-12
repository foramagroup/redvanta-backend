import express from "express";
import {
  getUsage,
  getFinancials,
  getLogs,
  getReports,
} from "../../controllers/superadmin/aiAnalytics.controller.js";
import {
  authenticateSuperAdmin,
  requireSuperAdmin,
} from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticateSuperAdmin, requireSuperAdmin);

router.get("/usage",      getUsage);
router.get("/financials", getFinancials);
router.get("/logs",       getLogs);
router.get("/reports",    getReports);

export default router;
