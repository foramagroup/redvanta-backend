// src/routes/order.routes.js

import { Router }  from "express";
import { authenticateAdmin, requireAdmin } from "../../middleware/auth.middleware.js";
import {
  getShippingRates,
  createOrder,
  listOrders,
  getOrder,
  stripeWebhook,
} from "../../controllers/client/Order.controller.js";

const router = Router();
const auth   = [authenticateAdmin, requireAdmin];

// GET /api/orders/shipping-rates?currency=USD&rate=1.08
router.get ("/shipping-rates", ...auth, getShippingRates);

// POST /api/orders
router.post("/",    ...auth, createOrder);

// GET /api/orders
router.get ("/",    ...auth, listOrders);

// GET /api/orders/:id
router.get ("/:id", ...auth, getOrder);

export default router;

// ─── IMPORTANT : Le webhook Stripe doit être monté séparément ─
// dans app.js AVANT express.json() :
//
// import express from "express";
// import { stripeWebhook } from "./src/controllers/order.controller.js";
//
// app.post(
//   "/api/orders/webhook",
//   express.raw({ type: "application/json" }),
//   (req, res, next) => { req.rawBody = req.body; next(); },
//   stripeWebhook
// );
//
// app.use(express.json({ limit: "60mb" }));  // ← après le webhook
// app.use("/api/orders", orderRoutes);