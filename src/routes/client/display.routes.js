// src/routes/client/display.routes.js
// Monté dans app.js : app.use("/api/client/display", displayRoutes)
//
// ⚠ CORS * — appelé depuis des sites externes qui ont intégré display.js.
//   Le middleware cors("*") est appliqué AVANT les routes.

import { Router } from "express";
import cors from "cors";
import { getDisplayReviews } from "../../controllers/client/display.controller.js";

const router = Router();

// Autoriser toutes les origines pour cet endpoint public (scripts embarqués sur sites tiers)
const openCors = cors({
  origin:  "*",
  methods: ["GET", "OPTIONS"],
});

router.options("/reviews", openCors);
router.get("/reviews", openCors, getDisplayReviews);

export default router;
