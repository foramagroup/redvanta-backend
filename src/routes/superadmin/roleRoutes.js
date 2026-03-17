import express from "express";
import {
  getRoles,
  createRole,
  updatePermissions
} from "../../controllers/superadmin/roleController.js";

const router = express.Router();

router.get("/", getRoles);
router.post("/", createRole);
router.post("/permissions", updatePermissions);

export default router;