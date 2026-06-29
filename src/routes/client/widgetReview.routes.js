// src/routes/client/widgetReview.routes.js
// Route publique appelée par widget.js pour soumettre un avis
// Monté dans app.js : app.use("/api/client/widget-reviews", widgetReviewRoutes)

import { Router } from "express";
import { submitWidgetReview } from "../../controllers/client/widget.controller.js";

const router = Router();

// POST /api/client/widget-reviews
// Payload: { widgetId, token, rating, name, email, comment, locale, page, referrer }
router.post("/", submitWidgetReview);

export default router;
