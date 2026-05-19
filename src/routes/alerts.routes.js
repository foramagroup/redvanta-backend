import { Router } from "express";
import { requireAuth }  from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import {
  getSettings,
  saveSettings,
  sendTest,
  getHistory,
  markRead,
  markAllRead,
} from "../controllers/alerts.controller.js";

const router = Router();
const auth   = [requireAuth, requireAdmin];

router.get  ("/settings",            ...auth, getSettings);
router.put  ("/settings",            ...auth, saveSettings);
router.post ("/test",                ...auth, sendTest);
router.get  ("/history",             ...auth, getHistory);
router.patch("/history/:id/read",    ...auth, markRead);
router.post ("/history/read-all",    ...auth, markAllRead);

export default router;
