// backend/src/routes/request.routes.js
// Monté à /api/admin/requests  — AVANT reviewRequest.routes.js dans app.js

import { Router } from "express";
import { authenticateAdmin, requireAdmin } from "../middleware/auth.middleware.js";

import {
  listContacts,
  createContact,
  updateContact,
  bulkDeleteContacts,
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  archiveTemplate,
  listCampaigns,
  getAnalytics,
} from "../controllers/request.controller.js";

const router = Router();
const auth = [authenticateAdmin, requireAdmin];

// ── Campaigns (main page) ─────────────────────────────────────
router.get("/campaigns", ...auth, listCampaigns);

// ── Analytics ─────────────────────────────────────────────────
router.get("/analytics/data", ...auth, getAnalytics);

// ── Contacts ──────────────────────────────────────────────────
// IMPORTANT: DELETE /contacts (bulk, ids in body) AVANT toute route /:id
// pour éviter que "contacts" soit capturé comme param par reviewRequest.routes
router.get   ("/contacts",      ...auth, listContacts);
router.post  ("/contacts",      ...auth, createContact);
router.put   ("/contacts/:id",  ...auth, updateContact);
router.delete("/contacts",      ...auth, bulkDeleteContacts);

// ── Groups ────────────────────────────────────────────────────
router.get   ("/groups",      ...auth, listGroups);
router.post  ("/groups",      ...auth, createGroup);
router.put   ("/groups/:id",  ...auth, updateGroup);
router.delete("/groups/:id",  ...auth, deleteGroup);

// ── Templates ─────────────────────────────────────────────────
// Sous-routes AVANT /:id (duplicate, archive)
router.post  ("/templates/:id/duplicate", ...auth, duplicateTemplate);
router.post  ("/templates/:id/archive",   ...auth, archiveTemplate);
router.get   ("/templates",               ...auth, listTemplates);
router.post  ("/templates",               ...auth, createTemplate);
router.put   ("/templates/:id",           ...auth, updateTemplate);
router.delete("/templates/:id",           ...auth, deleteTemplate);

export default router;
