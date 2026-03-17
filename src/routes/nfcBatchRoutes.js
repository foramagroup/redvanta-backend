import express from "express";
import { auth } from "../middlewares/auth.js";
import { listBatches, downloadBatchZip } from "../controllers/nfcBatchController.js";

const router = express.Router();

router.get("/", auth, listBatches);
router.get("/:batchId/download", auth, downloadBatchZip);

export default router;
