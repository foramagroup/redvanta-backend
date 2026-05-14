import { Router } from "express";
import { authenticateSuperAdmin, requireSuperAdmin } from "../../middleware/auth.middleware.js";
import {
  listPages,
  getPage,
  createPage,
  updatePage,
  upsertByKey,
  deletePage,
} from "../../controllers/superadmin/frontPagesSeo.controller.js";

const router = Router();
const auth   = [authenticateSuperAdmin, requireSuperAdmin];

router.get("/",            ...auth, listPages);
router.post("/",           ...auth, createPage);
router.put("/key/:key",    ...auth, upsertByKey);   // avant /:id pour éviter le conflit
router.get("/:id",         ...auth, getPage);
router.put("/:id",         ...auth, updatePage);
router.delete("/:id",      ...auth, deletePage);

export default router;
