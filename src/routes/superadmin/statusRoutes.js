import express from "express";
import { getSystemStatus } from "../../controllers/superadmin/statusController.js";

import { authenticateSuperAdmin, requireSuperAdmin } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateSuperAdmin, requireSuperAdmin);

router.get("/", getSystemStatus);

export default router;
