import { Router } from "express";
import {
  handleScan, getReviewPage, submitRating, submitFeedback, getSuggestions,
} from "../../controllers/client/nfc.controller.js";
import { recordBoosterEvent } from "../../controllers/reviewBooster.controller.js";

// ─── PUBLICS — Flux B Scan ────────────────────────────────────
export const scanRouter = Router();
scanRouter.get("/:uid", handleScan);
        // GET /r/:uid
export const reviewRouter = Router();
reviewRouter.get("/:uid",            getReviewPage);    // GET  /review/:uid
reviewRouter.post("/:uid/rate",      submitRating);     // POST /review/:uid/rate
reviewRouter.post("/:uid/feedback",  submitFeedback);   // POST /review/:uid/feedback
reviewRouter.post("/:uid/suggest",   getSuggestions);   // POST /review/:uid/suggest
reviewRouter.post("/booster-event",  recordBoosterEvent); // POST /review/booster-event