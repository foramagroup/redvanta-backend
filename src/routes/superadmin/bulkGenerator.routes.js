import express from "express";
import {
  getBulkTemplates,
  getBulkPlatforms,
  getBulkBatches,
  createBulkBatch,
  updateBulkBatch,
  deleteBulkBatch,
} from "../../controllers/superadmin/bulkGeneratorController.js";
import { authenticateSuperAdmin, requireSuperAdmin } from "../../middleware/auth.middleware.js";

const router = express.Router();
router.use(authenticateSuperAdmin, requireSuperAdmin);

// Templates
router.get("/templates", getBulkTemplates);
router.get("/platforms", getBulkPlatforms);

// Batches
router.get("/batches", getBulkBatches);
router.post("/batches", createBulkBatch);
router.patch("/batches/:id", updateBulkBatch);
router.delete("/batches/:id", deleteBulkBatch);

export default router;
