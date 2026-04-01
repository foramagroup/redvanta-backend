import { Router } from "express";
import {
  handleScan, getReviewPage, submitRating, submitFeedback,
} from "../../controllers/client/nfc.controller.js";

// ─── PUBLICS — Flux B Scan ────────────────────────────────────
export const router = Router();
router.get("scan/:uid", handleScan);          // GET /r/:uid
router.get("/:uid",          getReviewPage);  // GET /review/:uid
router.post("/:uid/rate",    submitRating);   // POST /review/:uid/rate
router.post("/:uid/feedback", submitFeedback); // POST /review/:uid/feedback
export default router;