// src/routes/location.routes.js
import { Router } from "express";
import { authenticateAdmin, requireAdmin } from "../middleware/auth.middleware.js";
import {
  listLocations,
  getLocation,
  createLocation,
  updateLocation,
  toggleLocation,
  deleteLocation,
  getLocationAnalytics,
  getLocationStats,
  refreshGoogleData,
  assignNfcCard,
  listCompanyNfcCards
} from "../controllers/location.controller.js";

const router = Router();
const auth   = [authenticateAdmin, requireAdmin];

// ─── Stats globales de toutes les locations ───────────────────
// GET /api/locations/stats
router.get("/stats", ...auth, getLocationStats);

// ─── CRUD ─────────────────────────────────────────────────────

// GET    /api/locations
// → Liste toutes les locations de la company (avec cardCount dynamique)
router.get("/", ...auth, listLocations);


router.get("/list-company-card", ...auth, listCompanyNfcCards);

// GET    /api/locations/:id
router.get("/:id", ...auth, getLocation);

// POST   /api/locations
// Body: { name, address?, placeId?, cards? }
// → Vérifie la limite du plan (maxLocations de company_settings)
// → Si placeId fourni : enrichit via Google Places Cache
router.post("/", ...auth, createLocation);

// PUT    /api/locations/:id
// Body: { name?, address?, placeId?, cards? }
router.put("/:id", ...auth, updateLocation);

// PATCH  /api/locations/:id/toggle
// → Bascule active ↔ inactive (switch de la carte)
router.patch("/:id/toggle", ...auth, toggleLocation);

// DELETE /api/locations/:id
// → Détache les tags NFC (SetNull) puis supprime
router.delete("/:id", ...auth, deleteLocation);



// ─── Actions spécifiques ──────────────────────────────────────

// GET  /api/locations/:id/analytics
// → Données pour le dialog Analytics :
//    rating, reviews, conversion%, monthlyTrend (6 mois)
router.get("/:id/analytics", ...auth, getLocationAnalytics);

// POST /api/locations/:id/refresh-google
// → Force le rechargement des données Google (rating, reviews)
//    en invalidant le cache Places
router.post("/:id/refresh-google", ...auth, refreshGoogleData);

// POST /api/locations/:id/assign-card
// Body: { tagId }
// → Associe un tag NFC existant à cette location
router.post("/:id/assign-card", ...auth, assignNfcCard);

export default router;
