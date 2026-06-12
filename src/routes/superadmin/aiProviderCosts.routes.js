import express from "express";
import {
  listCosts,
  saveCosts,
  createCost,
  updateCost,
  deleteCost,
} from "../../controllers/superadmin/aiProviderCosts.controller.js";
import { authenticateSuperAdmin, requireSuperAdmin } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticateSuperAdmin, requireSuperAdmin);

router.get("/",      listCosts);
router.put("/",      saveCosts);    // bulk save (page save button)
router.post("/",     createCost);   // ajouter une ligne
router.patch("/:id", updateCost);   // éditer une ligne
router.delete("/:id", deleteCost);

export default router;
