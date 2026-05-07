// src/routes/planBuilder.routes.js
// ─────────────────────────────────────────────────────────────
// ROUTER CLIENT ADMIN — /api/admin/plan-builder
// À monter dans app.js :
//   import planBuilderRoutes from "./routes/planBuilder.routes.js";
//   app.use("/api/admin/plan-builder", planBuilderRoutes);
// ─────────────────────────────────────────────────────────────

import { Router } from "express";
import { authenticateAdmin, requireAdmin } from "../middleware/auth.middleware.js";
import {
  getCatalog,
  getCurrentSubscription,
  previewSubscription,
  subscribe,
  updateAddons,
  checkoutUpgrade,
  updateInterval,
} from "../controllers/planBuilder.controller.js";

const router = Router();

const auth = [authenticateAdmin, requireAdmin];

// ── Lecture ───────────────────────────────────────────────────

// Plans + addons disponibles — hydrate la vue initiale
router.get("/catalog",  ...auth, getCatalog);               // GET  /api/admin/plan-builder/catalog

// Subscription courante de la company (plan actif + addons)
router.get("/current",  ...auth, getCurrentSubscription);   // GET  /api/admin/plan-builder/current

// ── Simulation ────────────────────────────────────────────────

// Calcule le total à la volée sans rien persister (appelé côté front à chaque interaction)
router.post("/preview", ...auth, previewSubscription);      // POST /api/admin/plan-builder/preview

// ── Mutations ─────────────────────────────────────────────────

// Crée ou change de plan complet (upgrade / downgrade)
router.post("/subscribe",        ...auth, subscribe);       // POST /api/admin/plan-builder/subscribe

// Payer l'upgrade (Stripe ou Manuel)
router.post("/checkout", ...auth, checkoutUpgrade);

// Met à jour uniquement les add-ons sur le plan courant
router.patch("/addons",          ...auth, updateAddons);    // PATCH /api/admin/plan-builder/addons

// Bascule monthly ↔ yearly
router.patch("/interval",        ...auth, updateInterval);  // PATCH /api/admin/plan-builder/interval

export default router;