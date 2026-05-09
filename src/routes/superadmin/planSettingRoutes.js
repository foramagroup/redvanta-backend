import express from "express";
import {
  listPlans,
  getPlan,
  createPlan,
  updatePlan,
  deletePlan,
  updatePlanStatus,
  reorderPlans,
  getFeatureCatalog,
} from "../../controllers/superadmin/planSettingController.js";
import { authenticateSuperAdmin, requireSuperAdmin } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticateSuperAdmin, requireSuperAdmin);

router.get("/",               listPlans);
router.get("/features",       getFeatureCatalog);
router.get("/:id",            getPlan);
router.post("/",              createPlan);
router.post("/reorder",       reorderPlans);
router.put("/:id",            updatePlan);
router.patch("/:id/status",   updatePlanStatus);
router.delete("/:id",         deletePlan);

export default router;
