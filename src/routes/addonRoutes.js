import { Router } from "express";
import { authenticateAdmin, requireAdmin } from "../middleware/auth.middleware.js";
import {
  listAddons,
  getAddonPaymentMethods,
  purchaseAddons,
  confirmAddonStripe,
  cancelAddon,
} from "../controllers/addonController.js";

const router = Router();

const auth   = [authenticateAdmin, requireAdmin];

router.get("/",     ...auth, listAddons);
router.get("/payment-methods",    ...auth, getAddonPaymentMethods);
router.post("/purchase",          ...auth, purchaseAddons);
router.post("/confirm",           ...auth, confirmAddonStripe);
router.delete("/:addonSettingId", ...auth, cancelAddon);

export default router;
