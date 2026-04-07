import { Router } from "express";
import { authenticateSuperAdmin, requireSuperAdmin } from "../../middleware/auth.middleware.js";
import {
  getCardsStats, listCards, handleAssign, handleUnassign
} from "../../controllers/superadmin/nfcListCard.controller.js";

export const router = Router();
const auth = [authenticateSuperAdmin, requireSuperAdmin];
router.get("/",     ...auth, listCards);
router.get("/stats",                   ...auth, getCardsStats);
router.post("/assign",                   ...auth, handleAssign);
router.patch("/:cardId/unassign",       ...auth, handleUnassign);

export default router;