import reviewService from "../services/reviewService.js";
import generateReviewPDF from "../utils/pdfGenerator.js";

export const submitReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId, rating, comment } = req.body;

    const review = await reviewService.createReview(userId, orderId, rating, comment);

    res.json({ success: true, review });
  } catch (err) {
    console.error("Review error:", err);
    res.status(500).json({ error: "Unable to submit review" });
  }
};

export const getUserReviews = async (req, res) => {
  try {
    const reviews = await reviewService.getUserReviews(req.user.id);
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: "Cannot load reviews" });
  }
};

export const getReviewPDF = async (req, res) => {
  try {
    const reviewId = req.params.id;

    const review = await reviewService.getReviewById(reviewId);
    if (!review) return res.status(404).json({ error: "Review not found" });

    // Permission check
    if (req.user.role !== "admin" && req.user.id !== review.userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const pdfPath = await generateReviewPDF(review);
    res.download(pdfPath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "PDF generation failed" });
  }
};
