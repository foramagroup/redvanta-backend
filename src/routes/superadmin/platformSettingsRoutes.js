import express from "express";

import { getSettings, updateSettings } from "../../controllers/superadmin/platformSettingsController.js";

import { authenticateSuperAdmin, requireSuperAdmin } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateSuperAdmin, requireSuperAdmin);

router.get("/", getSettings);
router.put("/", updateSettings);

export default router;