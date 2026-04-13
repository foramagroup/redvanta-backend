import express from "express";
import {
  getRoles,
  createRole,
  updatePermissions
} from "../../controllers/superadmin/roleController.js";

import { authenticateSuperAdmin, requireSuperAdmin } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateSuperAdmin, requireSuperAdmin);

router.get("/", getRoles);
router.post("/", createRole);
router.post("/permissions", updatePermissions);

export default router;