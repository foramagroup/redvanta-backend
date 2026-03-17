// backend/src/routes/bundles.js
import express from "express";
import { listBundles, getBundle, createBundle, deleteBundle } from "../controllers/bundlesController.js";
const router = express.Router();

router.get("/", listBundles);
router.get("/:id", getBundle);
router.post("/", createBundle);
router.delete("/:id", deleteBundle);

export default router;
