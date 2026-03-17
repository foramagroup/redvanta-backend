// backend/src/routes/dashboardRoutes.js
console.log(">>> dashboardRoutes.js loaded");

import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

// -------------------------------
// CONTROLLERS
// -------------------------------

// NFC Controller
import {
  getTag,          // previously getNfcTagDetail
  listTags,
  updateTag,
  deleteTag,
  logScan,
  getQrFile,
  exportTagsCsv,
  createTag
} from "../controllers/nfcController.js";

// Dashboard Controller
import {
  getDashboard,
  getNfcTagsForUid,
  getHeatmapPoints,
  getNfcTagDetail as getDashboardTagDetail
} from "../controllers/dashboardController.js";

// Admin User Controller
import { getUsers, getUser } from "../controllers/adminUserController.js";

// Admin Order Controller
import {
  getOrders,
  getOrderById,
  getOrderStats
} from "../controllers/adminOrderController.js";

// Admin Stats Controller
import {
  getGlobalStats,
  getHeatmapData
} from "../controllers/adminStatsController.js";

// Admin Sales Controller
import {
  getSalesGraph,
  getMonthlySales,
  getTopProducts
} from "../controllers/adminSalesController.js";

// -------------------------------
// ROUTER INIT
// -------------------------------
const router = express.Router();

// -------------------------------
// DEBUG ROUTE
// -------------------------------
router.get("/debug", (req, res) => res.json({ route: "ok" }));

// -------------------------------
// PROTECT ALL ROUTES
// -------------------------------
router.use(requireAuth);          // all routes below are protected
router.use(requireAdmin);

// -------------------------------
// NFC ROUTES
// -------------------------------
router.get("/nfc", listTags);             // List all NFC tags (admin)
router.get("/nfc/:id", getTag);           // Get NFC tag detail
router.post("/nfc", createTag);           // Create new NFC tag
router.put("/nfc/:id", updateTag);        // Update tag
router.delete("/nfc/:id", deleteTag);     // Delete tag
router.get("/nfc/:id/qrcode", getQrFile); // Serve QR file
router.get("/nfc/export", exportTagsCsv); // Export CSV

router.get("/:uid/nfc", getNfcTagsForUid);        // NFC tags for a user
router.get("/:uid/nfc/:tagId", getDashboardTagDetail); // Dashboard NFC detail

// -------------------------------
// DASHBOARD ROUTES
// -------------------------------
router.get("/:uid/heatmap", getHeatmapPoints);
router.get("/:uid/dashboard", getDashboard);

// -------------------------------
// USERS ROUTES
// -------------------------------
router.get("/users", getUsers);
router.get("/users/:id", getUser);

// -------------------------------
// ORDERS ROUTES
// -------------------------------
router.get("/orders", getOrders);
router.get("/orders/:id", getOrderById);
// router.get("/orders/stats", getOrderStats); // Uncomment if implemented

// -------------------------------
// STATS ROUTES
// -------------------------------
router.get("/stats", getGlobalStats);
router.get("/stats/heatmap", getHeatmapData);

// -------------------------------
// SALES ROUTES
// -------------------------------
router.get("/sales/graph", getSalesGraph);
router.get("/sales/monthly", getMonthlySales);
router.get("/sales/top-products", getTopProducts);

export default router;
