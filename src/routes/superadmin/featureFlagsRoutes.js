import express from "express";
import {

  getFeatureFlags,
  
  toggleFeatureFlag

} from "../../controllers/superadmin/featureFlagController.js";

import { authenticateSuperAdmin, requireSuperAdmin } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateSuperAdmin, requireSuperAdmin);

router.get("/", getFeatureFlags);

router.patch("/:id", toggleFeatureFlag);

export default router;