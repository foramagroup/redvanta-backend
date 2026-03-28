import { Router } from "express";
import * as OrderCtrl from "../../controllers/superadmin/order.controller.js";
import { authenticateSuperAdmin, requireSuperAdmin } from "../../middleware/auth.middleware.js";

const router = Router();
const auth   = [authenticateSuperAdmin, requireSuperAdmin];

router.get("/orders", ...auth, OrderCtrl.getAllOrders);
router.get("/orders/:id", ...auth, OrderCtrl.getAdminOrderDetails);
router.patch("/orders/:id/status", ...auth, OrderCtrl.updateOrderStatus);

// Remboursements
router.post("/refunds", ...auth, OrderCtrl.processRefund);

export default router;