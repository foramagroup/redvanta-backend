import { Router } from "express";
import { authenticateSuperAdmin, requireSuperAdmin } from "../../middleware/auth.middleware.js";

import {
  getSuperNfcStats,
  listAllCards,
  getSuperCard,
  downloadSuperCardExport,
  updateCardStatus,
  activateCard,
  regenerateSuperCardExport,
  deleteSuperCard,
  listTags,
  createTags,
  assignTag,
} from "../../controllers/superadmin/nfcCards.controller.js";

// ─────────────────────────────────────────────────────────────
// ROUTER SUPERADMIN — /api/superadmin/nfc
// ─────────────────────────────────────────────────────────────

export const superNfcRouter = Router();

const auth = [authenticateSuperAdmin, requireSuperAdmin];

// Stats plateforme
superNfcRouter.get("/stats",            ...auth,         getSuperNfcStats);

// Cartes (toutes companies)
superNfcRouter.get("/cards",          ...auth,           listAllCards);
superNfcRouter.get("/cards/:uid",           ...auth,     getSuperCard);
superNfcRouter.get("/cards/:uid/export",    ...auth,     downloadSuperCardExport);

// Progression production : NOT_PROGRAMMED → PRINTED → SHIPPED → ACTIVE
superNfcRouter.patch("/cards/:uid/status",   ...auth,    updateCardStatus);
superNfcRouter.post("/cards/:uid/activate",  ...auth,    activateCard);
superNfcRouter.post("/cards/:uid/regenerate", ...auth,   regenerateSuperCardExport);
superNfcRouter.delete("/cards/:uid",          ...auth,   deleteSuperCard);

// Puces hardware
superNfcRouter.get("/tags",               ...auth,       listTags);
superNfcRouter.post("/tags",                ...auth,     createTags);
superNfcRouter.patch("/tags/:id/assign",     ...auth,    assignTag);