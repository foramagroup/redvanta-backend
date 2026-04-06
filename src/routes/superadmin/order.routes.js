import { Router } from "express";
import * as OrderCtrl from "../../controllers/superadmin/order.controller.js";
import { authenticateSuperAdmin, requireSuperAdmin } from "../../middleware/auth.middleware.js";

const router = Router();
const auth   = [authenticateSuperAdmin, requireSuperAdmin];

router.get("/", ...auth, OrderCtrl.getAllOrders);

router.get("/:id", ...auth, OrderCtrl.getOrderDetail);

router.patch("/:id/status", ...auth, OrderCtrl.updateOrderStatus);

// GET    /api/superadmin/orders/:id/history
router.get("/:id/history", ...auth, OrderCtrl.getOrderHistory);

// Remboursements
router.post("/refunds", ...auth, OrderCtrl.processRefund);

export default router;