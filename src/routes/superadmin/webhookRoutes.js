
import express from "express";
import { authenticateSuperAdmin, requireSuperAdmin } from '../../middleware/auth.middleware.js';

const router = express.Router();

import * as webhookCtrl from "../../controllers/superadmin/webhookController.js";

router.use(authenticateSuperAdmin, requireSuperAdmin);
router.get("/", webhookCtrl.getWebhooks);
router.post("/", webhookCtrl.createWebhook);
router.put("/:id", webhookCtrl.updateWebhook);
router.delete("/:id", webhookCtrl.deleteWebhook);

export default router;