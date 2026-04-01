import { Router } from "express";
import { authenticateAdmin, requireAdmin } from "../../middleware/auth.middleware.js";
import {
  getMyCards, getMyNfcStats, getMyFeedbacks,
} from "../controllers/nfc.controller.js";

export const router = Router();
const auth = [authenticateAdmin, requireAdmin];
router.get("/stats",     ...auth, getMyNfcStats);
router.get("/cards",     ...auth, getMyCards);
router.get("/feedbacks", ...auth, getMyFeedbacks);

export default router;