// src/controllers/adminController.js
import express from "express";
import adminAffiliateController from "./adminAffiliateController.js";
import adminPayoutController from "./adminPayoutController.js";
import { exportCSV } from "../services/exportService.js";
import { getDashboardStats } from "../services/statsService.js";
import db from "../config/db.js";

const router = express.Router();

router.get("/stats", async (req, res) => {
  const stats = await getDashboardStats();
  res.json(stats);
});

router.get("/export/orders", async (req, res) => {
  const data = await db.order.findMany();

  const csv = exportCSV(data);

  res.header("Content-Type", "text/csv");
  res.attachment("orders.csv");
  return res.send(csv);
});

router.get("/products", async (req, res) => {
  const products = await db.product.findMany();
  res.json(products);
});

// backend/src/controllers/adminController.js (ajoute)
router.put("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const updated = await prisma.product.update({ where: { id }, data: { ...data } });
    res.json({ ok: true, product: updated });
  } catch (err) { console.error(err); res.status(500).json({ ok:false, error: err.message }); }
});

router.get("/export/orders", async (req, res) => {
  const data = await prisma.order.findMany({ include: { items: true }});
  const csv = exportCSV(data);
  res.header("Content-Type", "text/csv");
  res.attachment("orders.csv");
  return res.send(csv);
});

router.get("/stats", async (req, res) => {
  const orders = await prisma.order.findMany({ where: { status: "paid" }, select: { createdAt: true, totalCents: true }});
  const map = {};
  orders.forEach(o => { const d = o.createdAt.toISOString().slice(0,10); map[d] = (map[d] || 0) + o.totalCents; });
  const days = Object.keys(map).sort().map(d => ({ date: d, revenueCents: map[d] }));
  res.json({ daily: days });
});

// mount sub-controllers (when app.js mounts /api/admin with requireAdmin)
router.use("/affiliates", adminAffiliateController);
router.use("/payouts", adminPayoutController);

// basic admin root
router.get("/", (req, res) => res.json({ ok: true, msg: "admin root" }));

export default router;
