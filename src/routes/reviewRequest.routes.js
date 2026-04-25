// src/routes/shop.routes.js — v2 avec Review Requests

import { Router } from "express";
import { authenticateAdmin, requireAdmin } from "../middleware/auth.middleware.js";

import {
  listRequests,
  createRequest,
  bulkCreateRequests,
  resendRequest,
  cancelRequest,
  deleteRequest,
  updateRequestStatus,
  getLocationsForRequests
} from "../controllers/reviewRequest.controller.js";

import express from "express";

const router = Router();
const auth = [authenticateAdmin, requireAdmin];


// ── Review Requests ───────────────────────────────────────────
// IMPORTANT : /requests/bulk AVANT /requests/:id pour éviter que
// "bulk" soit capturé comme un :id par Express
router.get   ("/",                  ...auth, listRequests);
router.post  ("/bulk",             ...auth, bulkCreateRequests);
router.post  ("/",                  ...auth, createRequest);
router.post  ("/:id/resend",       ...auth, resendRequest);
router.put   ("/:id/cancel",       ...auth, cancelRequest);
router.patch ("/:id/status",       ...auth, updateRequestStatus);
router.delete("/:id",              ...auth, deleteRequest);
router.get   ("/locations", ...auth, getLocationsForRequests); 

export default router;