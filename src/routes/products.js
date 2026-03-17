import { Router } from "express";
import * as controller from "../controllers/productsController.js";
import { exportProductsCSV } from "../lib/exportCsv.js";
import upload from "../utils/upload.js";

const router = Router();

/* ADMIN ONLY */
router.get("/", controller.list);
router.get("/:id", controller.get);
router.post("/", upload.single("image"), controller.create);
router.put("/:id", upload.single("image"), controller.update);
router.delete("/:id", controller.remove);

/* PRICE SYNC */
router.post("/:id/sync-stripe", controller.syncStripePrice);

router.get("/export/csv", async (req,res) => {
  const csv = await exportProductsCSV();
  res.setHeader("Content-Type","text/csv");
  res.setHeader("Content-Disposition","attachment; filename=products.csv");
  res.send(csv);
});


export default router;
