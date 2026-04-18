// src/routes/admin/nfcCards.routes.js

import express from "express";
import { authenticateAdmin, requireAdmin } from "../middleware/auth.middleware.js";
import {
  listNfcCards,
  getNfcCard,
  assignCardToLocation,
  unassignCardFromLocation,
  updateCardStatus,
  deleteNfcCard,
   getAvailableLocations 
} from "../controllers/nfcCards.controller.js";

const router = express.Router();

// Toutes les routes nécessitent une authentification
const auth   = [authenticateAdmin, requireAdmin];

// Liste des cartes avec filtres
router.get("/", ...auth, listNfcCards);

// Détails d'une carte
router.get("/:id", ...auth, getNfcCard);

// Assigner une carte à une location
router.patch("/:id/assign", ...auth, assignCardToLocation);

// Désassigner une carte
router.patch("/:id/unassign", ...auth, unassignCardFromLocation);

// Changer le statut d'une carte
router.patch("/:id/status", ...auth, updateCardStatus);

// Supprimer (désactiver) une carte
router.delete("/:id", ...auth, deleteNfcCard);

router.get("/locations/available", ...auth, getAvailableLocations);

export default router;