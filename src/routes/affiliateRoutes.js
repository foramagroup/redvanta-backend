// backend/src/routes/affiliateRoutes.js
import express from "express";
import affiliateController from "../controllers/affiliateController.js";

const router = express.Router();
router.use("/", affiliateController);
export default router;
