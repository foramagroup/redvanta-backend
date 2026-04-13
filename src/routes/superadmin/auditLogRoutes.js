import express from "express";
import { getAuditLogs } from "../../controllers/superadmin/auditLogController.js";

import { authenticateSuperAdmin, requireSuperAdmin } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateSuperAdmin, requireSuperAdmin);


router.get("/", getAuditLogs);

export default router