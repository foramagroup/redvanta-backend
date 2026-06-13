import express from "express";
import { getAuthUrl, handleCallback, getStatus, disconnect } from "../controllers/googleOAuth.controller.js";
import { getLocations, connectLocations } from "../controllers/googleLocations.controller.js";
import { syncNow, getSyncLogs } from "../controllers/googleSync.controller.js";
import { getWebhookHistory, flushRetryQueue } from "../controllers/googleWebhooks.controller.js";
import { authenticateAdmin, requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

// Public — Google OAuth callback (no auth needed)
router.get("/callback", handleCallback);

// All other routes require auth
router.use(authenticateAdmin, requireAdmin);

router.get("/auth-url",             getAuthUrl);
router.get("/status",               getStatus);
router.delete("/disconnect",        disconnect);

router.get("/locations",            getLocations);
router.post("/locations/connect",   connectLocations);

router.post("/sync",                syncNow);
router.get("/sync/logs",            getSyncLogs);

router.get("/webhooks/history",     getWebhookHistory);
router.post("/webhooks/flush",      flushRetryQueue);

export default router;
