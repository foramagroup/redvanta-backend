// backend/src/controllers/checkoutController.js
import express from "express";
import prisma from "../config/prisma.js";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

/**
 * GET /api/checkout/cart/:userId
 * Example simple cart fetch (you can adapt to session-based cart)
 */
router.get("/cart/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const orders = await prisma.order.findMany({ where: { userId, status: "pending" }, include: { items: true }});
    res.json({ cart: orders });
  } catch (err) {
    console.error("checkout.cart:", err);
    res.status(500).json({ error: "server error" });
  }
});

/**
 * POST /api/checkout/confirm
 * Simple confirm after payment: marks order paid (optionally used if you don't use webhooks)
 */
router.post("/confirm", async (req, res) => {
  const { orderId } = req.body;
  try {
    const order = await prisma.order.update({ where: { id: orderId }, data: { status: "paid" }});
    res.json({ ok: true, order });
  } catch (err) {
    console.error("checkout.confirm:", err);
    res.status(500).json({ error: "server error" });
  }
});

export default router;
