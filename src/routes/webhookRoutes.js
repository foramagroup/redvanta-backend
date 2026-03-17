// backend/src/routes/webhookRoutes.js
import express from "express";
import { webToTag } from "../controllers/webhookController.js";

const router = express.Router();

// POST webhook route
router.post("/web-to-tag", express.json({ limit: "2mb" }), webToTag);

export default router;
