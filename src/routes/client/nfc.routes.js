import { Router } from "express";
import {
  handleScan, getReviewPage, submitRating, submitFeedback,
} from "../../controllers/client/nfc.controller.js";

// ─── PUBLICS — Flux B Scan ────────────────────────────────────
export const publicScanRouter = Router();
publicScanRouter.get("/:uid", handleScan);          // GET /r/:uid
 
export const reviewRouter = Router();
reviewRouter.get("/:uid",          getReviewPage);  // GET /review/:uid
reviewRouter.post("/:uid/rate",    submitRating);   // POST /review/:uid/rate
reviewRouter.post("/:uid/feedback", submitFeedback); // POST /review/:uid/feedback