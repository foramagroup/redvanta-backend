import { Router }  from "express";
import {getMyOrders, getOrderTracking} from "../controllers/orderTracking.controller.js";
import { authenticateAdmin, requireAdmin } from "../middleware/auth.middleware.js";


const router = Router();
const auth   = [authenticateAdmin, requireAdmin];

router.get("/", ...auth, getMyOrders);

router.get("/:orderNumber", ...auth, getOrderTracking);

export default router;