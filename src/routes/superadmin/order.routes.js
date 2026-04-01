import { Router } from "express";
import * as OrderCtrl from "../../controllers/superadmin/order.controller.js";
import { authenticateSuperAdmin, requireSuperAdmin } from "../../middleware/auth.middleware.js";

const router = Router();
const auth   = [authenticateSuperAdmin, requireSuperAdmin];

router.get("/orders", ...auth, OrderCtrl.getAllOrders);
router.get("/orders/:id", ...auth, OrderCtrl.getOrderDetail);
router.patch("/orders/:id/status", ...auth, OrderCtrl.updateOrderStatus);
// GET    /api/superadmin/orders/:id/history
saRouter.get("/:id/history", ...saAuth, OrderCtrl.getOrderHistory);

// Remboursements
router.post("/refunds", ...auth, OrderCtrl.processRefund);

export default router;