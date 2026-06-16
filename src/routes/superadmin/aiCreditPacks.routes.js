import express from "express";
import {
  listPacks,
  createPack,
  updatePack,
  deletePack,
  upsertTranslations,
} from "../../controllers/superadmin/aiCreditPacks.controller.js";
import { authenticateSuperAdmin, requireSuperAdmin } from "../../middleware/auth.middleware.js";

const router = express.Router();
router.use(authenticateSuperAdmin, requireSuperAdmin);

router.get(   "/",                      listPacks);
router.post(  "/",                      createPack);
router.put(   "/:id",                   updatePack);
router.delete("/:id",                   deletePack);
router.put(   "/:id/translations",      upsertTranslations);

export default router;
