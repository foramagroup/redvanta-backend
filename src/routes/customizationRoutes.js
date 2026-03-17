import express from "express";
import customizationController from "../controllers/customizationController.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// USER ROUTES
router.post("/save", requireAuth, customizationController.saveDesign);
router.get("/my-designs", requireAuth, customizationController.listMyDesigns);
router.get("/download/:id", requireAuth, customizationController.downloadDesign);
router.post(
  "/:orderId/upload-image",
  requireAuth,
  customizationController.uploadImageMiddleware,
  customizationController.uploadImage
);

// ADMIN ROUTES
router.get("/admin/all", requireAdmin, customizationController.adminGetAllDesigns);

export default router;
