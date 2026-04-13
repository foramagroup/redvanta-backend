import express from "express";
import smsSettingsController from '../../controllers/superadmin/smsSettingsController.js';

import { authenticateSuperAdmin, requireSuperAdmin } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateSuperAdmin, requireSuperAdmin);

router.get("/", smsSettingsController.list);

router.post("/", smsSettingsController.create);

router.put("/global-settings", smsSettingsController.updateGlobalSettings);

router.put("/:id", smsSettingsController.update);

router.delete("/:id", smsSettingsController.deleteSetting);

export default router;

