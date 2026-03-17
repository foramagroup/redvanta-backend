import express from "express";
import paymentController from "../controllers/paymentController.js";
const router = express.Router();
router.use("/", paymentController);
export default router;
