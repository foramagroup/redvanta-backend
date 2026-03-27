// src/routes/googlePlaces.routes.js

import { Router } from "express";
import { authenticateAdmin, requireAdmin, requireSuperAdmin } from "../../middleware/auth.middleware.js";
import { autocompleteRateLimit } from "../../middleware/Placesratelimit.middleware.js";
import {
  search,
  details,
  linkToCompany,
  linkToDesign,
  invalidatePlaceCache,
  placeCacheStats,
} from "../../controllers/client/Googleplaces.controller.js";

const router = Router();

const auth = [authenticateAdmin, requireAdmin];

// ─── Recherche (autocomplete) ─────────────────────────────────
// GET /api/places/search?q=urban+bites&session=uuid&lang=fr
// Rate limité : 30 req/min/user

router.get("/search", ...auth, autocompleteRateLimit, search);

// ─── Détails d'un lieu ────────────────────────────────────────
// GET /api/places/details/:placeId?session=uuid
// Résultat mis en cache 30 jours — pas de rate limit nécessaire

router.get("/details/:placeId", ...auth, details);

// ─── Lier à la company ────────────────────────────────────────
// POST /api/places/link-to-company
// Body: { placeId, designId? }
// router.post("/link-to-company", ...auth, linkToCompany);

// ─── Lier à un design spécifique ─────────────────────────────
// POST /api/places/link-to-design
// Body: { placeId, designId }
// router.post("/link-to-design", ...auth, linkToDesign);

// ─── Admin cache ─────────────────────────────────────────────
// POST /api/places/cache/invalidate  (superadmin)
// GET  /api/places/cache/stats       (superadmin)
// router.post("/cache/invalidate", authenticateAdmin, requireSuperAdmin, invalidatePlaceCache);
// router.get ("/cache/stats",      authenticateAdmin, requireSuperAdmin, placeCacheStats);

export default router;