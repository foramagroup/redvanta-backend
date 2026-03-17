// backend/src/routes/index.js
import express from "express";
import customizationRoutes from "./customizationRoutes.js";
import adminDesignRoutes from "./adminDesignRoutes.js";
// other routes...
const router = express.Router();

router.use("/customization", customizationRoutes);
router.use("/admin/designs", adminDesignRoutes);

export default router;
