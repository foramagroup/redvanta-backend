import { Router } from "express";
import { authenticateAdmin, requireAdmin } from "../../middleware/auth.middleware.js";
import {
  getMyCards, getMyNfcStats, getMyFeedbacks,
} from "../controllers/nfc.controller.js";


export const clientNfcRouter = Router();
const auth = [authenticateAdmin, requireAdmin];
clientNfcRouter.get("/stats",     ...auth, getMyNfcStats);
clientNfcRouter.get("/cards",     ...auth, getMyCards);
clientNfcRouter.get("/feedbacks", ...auth, getMyFeedbacks);