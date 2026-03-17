import express from "express";
import {
  getAddons,
  createAddon,
  updateAddon,
  toggleAddon,
} from "../../controllers/superadmin/addonSettingController.js";

const router = express.Router();

router.get("/", getAddons);
router.post("/", createAddon);
router.put("/:id", updateAddon);
router.patch("/:id/toggle", toggleAddon);

export default router;