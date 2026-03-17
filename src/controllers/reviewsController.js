// src/controllers/reviewsController.js
import express from "express";
import db from "../config/db.js";
import { sendReviewRequest } from "../services/reviewAutomationService.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const review = await db.review.create({
      data: req.body
    });

    return res.json(review);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "REVIEW_CREATE_FAILED" });
  }
});

router.get("/product/:productId", async (req, res) => {
  const reviews = await db.review.findMany({
    where: { productId: req.params.productId }
  });

  res.json(reviews);
});

router.post("/request/:orderId", async (req, res) => {
  try {
    const order = await db.order.findUnique({
      where: { id: req.params.orderId },
      include: { user: true }
    });

    if (!order) return res.status(404).json({ error: "ORDER_NOT_FOUND" });

    await sendReviewRequest(order.user, order);

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "REVIEW_REQUEST_FAILED" });
  }
});

export default router;
