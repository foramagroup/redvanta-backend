
import express from "express";
const router = express.Router();
import * as webhookCtrl from "../../controllers/superadmin/webhookController.js";

router.get("/", webhookCtrl.getWebhooks);
router.post("/", webhookCtrl.createWebhook);
router.put("/:id", webhookCtrl.updateWebhook);
router.delete("/:id", webhookCtrl.deleteWebhook);

export default router;