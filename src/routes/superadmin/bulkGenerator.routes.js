import express from "express";
import {
  getBulkTemplates,
  getBulkPlatforms,
  getBulkBatches,
  createBulkBatch,
  updateBulkBatch,
  deleteBulkBatch,
} from "../../controllers/superadmin/bulkGeneratorController.js";
import {
  batchGenerateCards,
  assignCard,
} from "../../controllers/superadmin/cardsBatchController.js";
import { authenticateSuperAdmin, requireSuperAdmin } from "../../middleware/auth.middleware.js";

const router = express.Router();
router.use(authenticateSuperAdmin, requireSuperAdmin);

// Templates
router.get("/templates", getBulkTemplates);
router.get("/platforms", getBulkPlatforms);

// Batches (frontend job tracking)
router.get("/batches", getBulkBatches);
router.post("/batches", createBulkBatch);
router.patch("/batches/:id", updateBulkBatch);
router.delete("/batches/:id", deleteBulkBatch);

// Card generation & assignment (UIDs générés au back)
router.post("/cards/batch/generate", batchGenerateCards);
router.post("/cards/assign", assignCard);

export default router;
