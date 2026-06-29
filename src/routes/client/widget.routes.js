// src/routes/client/widget.routes.js
// Routes publiques appelées par widget.js (auth par token, pas de session JWT)
// Monté dans app.js : app.use("/api/client/widgets", widgetClientRoutes)

import { Router } from "express";
import {
  getWidgetConfig,
  submitWidgetReview,
  trackWidgetEvent,
} from "../../controllers/client/widget.controller.js";

const router = Router();

// GET /api/client/widgets/:widgetId?token=TOKEN&locale=fr
// widget.js l'appelle au chargement pour récupérer la config + les traductions
router.get("/:widgetId", getWidgetConfig);

// POST /api/client/widgets/event
// widget.js l'appelle pour tracker view / open
router.post("/event", trackWidgetEvent);

export default router;
