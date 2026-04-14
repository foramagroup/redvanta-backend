// src/routes/admin/billing.routes.js

import express from 'express';
import { authenticateAdmin, requireAdmin } from "../middleware/auth.middleware.js";
import {
  getBillingOverview,
  getUsageHistory,
  getInvoices,
  getAvailableAddons,
  activateAddon,
  deactivateAddon,
  trackUsage,
  exportUsage,
} from '../controllers/billing.controller.js';

const router = express.Router();

// Middleware - Authentification requise
router.use(authenticateAdmin, requireAdmin);

// Vue d'ensemble billing
router.get('/overview', getBillingOverview);

// Historique usage (pour graphique)
router.get('/usage-history', getUsageHistory);

// Invoices
router.get('/invoices', getInvoices);

// Add-ons disponibles
router.get('/addons/available', getAvailableAddons);

// Activer/Désactiver add-on
router.post('/addons/:addonId/activate', activateAddon);
router.post('/addons/:addonId/deactivate', deactivateAddon);

// Tracking usage (pour usage programmatique)
router.post('/usage/track', trackUsage);

// Export CSV
router.post('/export-usage', exportUsage);

export default router;