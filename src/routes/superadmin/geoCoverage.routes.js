import { Router } from "express";
import { authenticateSuperAdmin, requireSuperAdmin } from "../../middleware/auth.middleware.js";
import {
  getAll,
  getCoverage,
  getIncompleteCombos,
  getCatalog,
  getCountries,
  getStates,
  getCities,
} from "../../controllers/superadmin/geoCoverage.controller.js";

const router = Router();
const auth   = [authenticateSuperAdmin, requireSuperAdmin];

// Bootstrap (coverage + incompleteCombos + summary in one call)
router.get("/all",               ...auth, getAll);

// Full catalog (used by LocationSelect + shipping matrix)
router.get("/catalog",  getCatalog);

// Individual resources
router.get("/coverage",          ...auth, getCoverage);
router.get("/incomplete-combos", ...auth, getIncompleteCombos);

// Cascading dropdown helpers (used by shipping rules form)
router.get("/countries",         ...auth, getCountries);
router.get("/states",            ...auth, getStates);
router.get("/cities",            ...auth, getCities);

export default router;
