import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import adminDesignController from "../controllers/adminDesignController.js";

const router = express.Router();

router.get("/download/:id", requireAdmin, adminDesignController.download);
// list all designs (admin)
router.get("/", requireAuth, requireAdmin, adminDesignController.list);

// get single design
router.get("/:id", requireAuth, requireAdmin, adminDesignController.get);

// update design (partial)
router.put("/:id", requireAuth, requireAdmin, adminDesignController.update);

// delete design
router.delete("/:id", requireAuth, requireAdmin, adminDesignController.remove);

// export selected design to PDF (admin)
router.post("/:id/export-pdf", requireAuth, requireAdmin, adminDesignController.exportPdf);

export default router;
