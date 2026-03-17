import express from "express";

import { getSettings, updateSettings } from "../../controllers/superadmin/platformSettingsController.js";

const router = express.Router();

router.get("/", getSettings);
router.put("/", updateSettings);

export default router;