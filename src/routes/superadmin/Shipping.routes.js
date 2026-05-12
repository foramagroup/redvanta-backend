import { Router } from "express";
import { authenticateSuperAdmin, requireSuperAdmin } from "../../middleware/auth.middleware.js";
import {
  listRules,
  createRule,
  updateRule,
  deleteRule,
  toggleRule,
  getSettings,
  updateSettings,
  calculateShipping,
  getAll,
} from "../../controllers/superadmin/Shipping.controller.js";

const router = Router();
const auth   = [authenticateSuperAdmin, requireSuperAdmin];

// Bootstrap (règles + fallbackCost en un seul appel)
router.get("/all", ...auth, getAll);

// Règles CRUD
router.get   ("/rules",          ...auth, listRules);
router.post  ("/rules",          ...auth, createRule);
router.put   ("/rules/:id",      ...auth, updateRule);
router.delete("/rules/:id",      ...auth, deleteRule);
router.patch ("/rules/:id/toggle", ...auth, toggleRule);

// Paramètres globaux (fallbackCost)
router.get("/settings", ...auth, getSettings);
router.put("/settings", ...auth, updateSettings);

// Calcul du coût d'expédition (checkout + test serveur)
router.post("/calculate", ...auth, calculateShipping);

export default router;
