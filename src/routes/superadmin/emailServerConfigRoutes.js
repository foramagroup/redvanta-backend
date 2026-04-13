import express from "express";
import {
  getEmailServerConfig,
  createEmailServer,
  updateEmailServer,
  deleteEmailServer,
  updateEmailServerSettings,
} from "../../controllers/superadmin/emailServerConfigController.js";

import { authenticateSuperAdmin, requireSuperAdmin } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateSuperAdmin, requireSuperAdmin);

router.get("/", getEmailServerConfig);
router.post("/", createEmailServer);
router.put("/settings", updateEmailServerSettings);
router.put("/:id", updateEmailServer);
router.delete("/:id", deleteEmailServer);

export default router;
