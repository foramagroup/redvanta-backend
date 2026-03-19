import express from "express";
import { getSystemStatus } from "../../controllers/superadmin/statusController.js";

const router = express.Router();

router.get("/", getSystemStatus);

export default router;
