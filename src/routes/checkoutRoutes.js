// backend/src/routes/checkoutRoutes.js
import express from "express";
import checkoutController from "../controllers/checkoutController.js";
const router = express.Router();
router.use("/", checkoutController);
export default router;
