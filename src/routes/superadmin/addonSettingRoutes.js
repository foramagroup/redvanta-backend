import express from "express";
import {
  getAddons,
  createAddon,
  updateAddon,
  toggleAddon,
} from "../../controllers/superadmin/addonSettingController.js";

import { authenticateSuperAdmin, requireSuperAdmin } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateSuperAdmin, requireSuperAdmin);

router.get("/", getAddons);
router.post("/", createAddon);
router.put("/:id", updateAddon);
router.patch("/:id/toggle", toggleAddon);

export default router;