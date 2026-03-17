// backend/src/routes/orderRoutes.js
import express from "express";
import orderController from "../controllers/orderController.js";

const router = express.Router();
router.use("/", orderController);
export default router;
