import express from "express";
import { listPrices, createCheckoutSession } from "../controllers/stripeController.js";
const router = express.Router();

router.get("/prices", listPrices);
router.post("/create-session", createCheckoutSession);

export default router;
