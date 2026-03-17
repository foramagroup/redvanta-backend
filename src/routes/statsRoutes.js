// backend/src/routes/statsRoutes.js
import express from "express";
import { tagStats, myTopTags, exportCsv } from "../controllers/statsController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

// public-ish: tag stats (owner or admin? here public if tag owner wants to see via frontend using auth)
router.get("/tag/:tagId", requireAuth, tagStats); // owner view
router.get("/top", requireAuth, myTopTags);
router.get("/export/:tagId.csv", requireAuth, exportCsv);

export default router;
