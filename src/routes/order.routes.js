import { Router }  from "express";
import {listMyOrders, getOrderDetails} from "../controllers/order.controller.js";
import { authenticateAdmin, requireAdmin } from "../middleware/auth.middleware.js";


const router = Router();
const auth   = [authenticateAdmin, requireAdmin];

router.get("/", ...auth, listMyOrders);
router.get("/:orderNumber", ...auth, getOrderDetails);

export default router;