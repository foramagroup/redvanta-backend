import express from "express";
import { getAuditLogs } from "../../controllers/superadmin/auditLogController.js";

const router = express.Router();


router.get("/", getAuditLogs);

export default router