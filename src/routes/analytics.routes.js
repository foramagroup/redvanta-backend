// src/routes/shop.routes.js — v3 avec Analytics

import { Router } from "express";
import { authenticateAdmin, requireAdmin } from "../middleware/auth.middleware.js";


import {
  getAnalytics, exportAnalytics, getAnalyticsLocations,
} from "../controllers/analytics.controller.js";


import express from "express";

const router = Router();
const auth = [authenticateAdmin, requireAdmin];


// ── Analytics ─────────────────────────────────────────────────
// IMPORTANT : /analytics/export et /analytics/locations avant /analytics
// (sinon "export" et "locations" seraient capturés comme query params)
router.get("/export",    ...auth, exportAnalytics);
router.get("/locations", ...auth, getAnalyticsLocations);
router.get("/",           ...auth, getAnalytics);

export default router;