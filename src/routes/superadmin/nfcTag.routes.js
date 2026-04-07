import { Router } from "express";
import { authenticateSuperAdmin, requireSuperAdmin } from "../../middleware/auth.middleware.js";
import {
  getTagsStats, listTags, createTags, updateTagStatus
} from "../../controllers/superadmin/nfcTag.controller.js";

export const router = Router();
const auth = [authenticateSuperAdmin, requireSuperAdmin];
 
router.get("/",     ...auth, listTags);
router.get("/stats",                   ...auth, getTagsStats);
router.post("/",                   ...auth, createTags);
router.patch("/:id/status",       ...auth, updateTagStatus);

export default router;