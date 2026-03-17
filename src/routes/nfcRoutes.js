// backend/src/routes/nfcRoutes.js
import express from "express";
import prisma from "../config/prisma.js";

// OLD controllers (keep compatibility)
import {
  create as oldCreate,
  mine as oldMine,
  updateDesign as oldUpdateDesign,
  adminList as oldAdminList,
  scanRedirect as oldScanRedirect,
} from "../controllers/nfcController.js";

// NEW controllers
import {
  createTag,
  listTags,
  getTag,
  updateTag,
  deleteTag,
  logScan,
  getQrFile,
  exportTagsCsv
} from "../controllers/nfcController.js";

// Middleware
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../middleware/auth.js";

const router = express.Router();

/* ============================================
   PUBLIC SCAN — NEW SYSTEM
   /api/nfc/r?uid=XXXX
============================================ */
router.get("/r", logScan);

/* ============================================
   PUBLIC SCAN — OLD SYSTEM
   /api/nfc/scan/:tagId
============================================ */
router.get("/scan/:tagId", oldScanRedirect);

/* ============================================
   PUBLIC: GET TAG BY UID (old mini API)
   /api/nfc/uid/:uid
============================================ */
router.get("/uid/:uid", async (req, res) => {
  try {
    const tag = await prisma.nFCTag.findUnique({
      where: { uid: req.params.uid }
    });

    if (!tag) return res.status(404).json({ ok: false, error: "Tag not found" });

    return res.json({ ok: true, tag });
  } catch (err) {
    console.error("UID GET error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* ============================================
   ADMIN PANEL — NEW SYSTEM
============================================ */
router.post("/", requireAuth, requireAdmin, createTag);
router.get("/", requireAuth, requireAdmin, listTags);
router.get("/export", requireAuth, requireAdmin, exportTagsCsv);
router.get("/:id", requireAuth, requireAdmin, getTag);
router.put("/:id", requireAuth, requireAdmin, updateTag);
router.delete("/:id", requireAuth, requireAdmin, deleteTag);

// Fetch QR code for authenticated users
router.get("/:id/qrcode", requireAuth, getQrFile);

/* ============================================
   OLD ENDPOINTS — STILL WORKING
============================================ */
// Create NFC entry (old)
router.post("/create", requireAuth, oldCreate);

// List tags of logged user
router.get("/mine", requireAuth, oldMine);

// Update design of existing tag
router.put("/:id/design", requireAuth, oldUpdateDesign);

// Admin list old style
router.get("/admin/list", requireAuth, oldAdminList);

export default router;
