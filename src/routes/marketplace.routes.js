import { Router } from "express";
import { authenticateAdmin, requireAdmin } from "../middleware/auth.middleware.js";
import {
  listIntegrations,
  connectIntegration,
  disconnectIntegration,
  getWebhook,
  generateWebhook,
  deleteWebhook,
} from "../controllers/marketplace.controller.js";

const router = Router();
const auth   = [authenticateAdmin, requireAdmin];

router.get   ("/integrations",                  ...auth, listIntegrations);
router.post  ("/integrations/:id/connect",      ...auth, connectIntegration);
router.delete("/integrations/:id/disconnect",   ...auth, disconnectIntegration);
router.get   ("/webhook",                       ...auth, getWebhook);
router.post  ("/webhook",                       ...auth, generateWebhook);
router.delete("/webhook",                       ...auth, deleteWebhook);

export default router;
