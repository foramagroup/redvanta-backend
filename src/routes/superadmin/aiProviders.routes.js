import express from "express";
import {
  listProviders,
  getProvider,
  updateProvider,
  setDefaultProvider,
  testProvider,
} from "../../controllers/superadmin/aiProviders.controller.js";
import { authenticateSuperAdmin, requireSuperAdmin } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticateSuperAdmin, requireSuperAdmin);

router.get("/",                      listProviders);
router.get("/:id",                   getProvider);
router.put("/:id",                   updateProvider);
router.patch("/:id/set-default",     setDefaultProvider);
router.post("/:id/test",             testProvider);

export default router;
