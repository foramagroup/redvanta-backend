import express from "express";
import { submitReview, getUserReviews, getReviewPDF } from "../controllers/reviewController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

router.post("/submit", requireAuth, submitReview);
router.get("/mine", requireAuth, getUserReviews);
router.get("/:id/pdf", requireAuth, getReviewPDF);

export default router;
