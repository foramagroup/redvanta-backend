import { Router } from "express";
import { authenticateAdmin, requireAdmin, authenticateSuperAdmin, requireSuperAdmin } from "../../middleware/auth.middleware.js";
import {
  listAllCards, listAllTags, addTag, assignTag, toggleCard,
} from "../../controllers/superadmin/nfc.controller.js";

export const router = Router();
const auth = [authenticateSuperAdmin, requireSuperAdmin];
 
// NFCCard (logique métier)
router.get("/cards",                   ...auth, listAllCards);
router.patch("/cards/:uid/toggle",     ...auth, toggleCard);
 
// NFCTag (hardware — gestion stock puces)
router.get("/tags",                    ...auth, listAllTags);
router.post("/tags",                   ...auth, addTag);
router.patch("/tags/:id/assign",       ...auth, assignTag);