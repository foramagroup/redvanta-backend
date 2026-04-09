import express from 'express';
import {
  getAnalyticsEvents,
  getEventById,
  getAnalyticsStats
} from '../controllers/analyticsEvents.controller.js';
import { authenticateAdmin, requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

// Toutes les routes nécessitent une authentification admin
router.use(authenticateAdmin, requireAdmin);

// GET - Liste des événements avec filtres
router.get('/', getAnalyticsEvents);

// GET - Statistiques
router.get('/stats', getAnalyticsStats);

// GET - Détail d'un événement
router.get('/:id', getEventById);

export default router;