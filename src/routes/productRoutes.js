// backend/src/routes/productRoutes.js
import express from "express";
import productController from "../controllers/productController.js";

const router = express.Router();
router.use("/", productController);
export default router;
