import express from "express";
import {

  getFeatureFlags,
  
  toggleFeatureFlag

} from "../../controllers/superadmin/featureFlagController.js";

const router = express.Router();

router.get("/", getFeatureFlags);

router.patch("/:id", toggleFeatureFlag);

export default router;