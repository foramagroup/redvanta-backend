import { Router } from "express";

import { authenticateAdmin, requireAdmin } from "../middleware/auth.middleware.js";

import {
  getMyNfcStats,
  listMyCards,
  getMyCard,
  downloadCardExport,
  regenerateCardExport,
} from "../controllers/nfcCards.controller.js";


// ─────────────────────────────────────────────────────────────
// ROUTER CLIENT ADMIN — /api/nfc
// ─────────────────────────────────────────────────────────────

export const clientNfcRouter = Router();

const auth = [authenticateAdmin, requireAdmin];

clientNfcRouter.get("/stats",           ...auth,        getMyNfcStats);
clientNfcRouter.get("/cards",           ...auth,        listMyCards);
clientNfcRouter.get("/cards/:uid",        ...auth,      getMyCard);
// ?format=svg|png|pdf — Feuille d'impression : RECTO en haut / VERSO en bas
clientNfcRouter.get("/cards/:uid/export",  ...auth,     downloadCardExport);
clientNfcRouter.post("/cards/:uid/regenerate",  ...auth,  regenerateCardExport);
