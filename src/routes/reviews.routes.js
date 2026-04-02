// src/routes/reviews.routes.js
// ─────────────────────────────────────────────────────────────
// Routes du module Reviews — vue admin client
// Montage : app.use("/api/reviews", reviewsRouter)
// Auth : admin_token (cookie HttpOnly — middleware authenticateAdmin)

import { Router } from "express";
import { authenticateAdmin, requireAdmin } from "../middleware/auth.middleware.js";
import {
  listReviews,
  getReviewStats,
  getReview,
  updateReviewStatus,
  updateInternalNotes,
  replyToReview,
  bulkUpdateStatus,
  exportReviewsCsv,
} from "../controllers/reviews.controller.js";

const router = Router();
const auth   = [authenticateAdmin, requireAdmin];


// GET  /api/reviews/stats              Stats globales (compteurs filtres + métriques)
router.get("/stats",              ...auth, getReviewStats);

// GET  /api/reviews/export             Export CSV (mêmes filtres que la liste)
// Doit être avant /:id pour ne pas être capturé comme ID
router.get("/export",             ...auth, exportReviewsCsv);

// PATCH /api/reviews/bulk/status        Bulk action (barre de sélection)
// Body : { ids: [1,2,3], status: "RESOLVED" }
router.patch("/bulk/status",      ...auth, bulkUpdateStatus);

// GET  /api/reviews                    Liste paginée + filtres
// Query: ?search=&rating=&statusKey=rev.public&location=&source=NFC&page=&limit=
router.get("/",                   ...auth, listReviews);

// GET  /api/reviews/:id                Détail pour le dialog
router.get("/:id",                ...auth, getReview);

// PATCH /api/reviews/:id/status         Changer le statut (Mark Resolved, etc.)
// Body : { status: "RESOLVED" } ou { statusKey: "rev.resolved" }
router.patch("/:id/status",       ...auth, updateReviewStatus);

// PATCH /api/reviews/:id/notes          Sauvegarder notes internes (textarea dialog)
// Body : { notes: "..." }
router.patch("/:id/notes",        ...auth, updateInternalNotes);

// POST  /api/reviews/:id/reply          Répondre au feedback (bouton Reply)
// Body : { reply: "Merci pour votre retour..." }
router.post("/:id/reply",         ...auth, replyToReview);

export default router;

// ─────────────────────────────────────────────────────────────
// TABLEAU COMPLET DES ENDPOINTS
// ─────────────────────────────────────────────────────────────
/*
  Tous protégés par admin_token (cookie HttpOnly)

  ┌─────────────────────────────────────┬───────────────────────────────────────────────────┐
  │ Endpoint                            │ Utilisation dans la vue Reviews                   │
  ├─────────────────────────────────────┼───────────────────────────────────────────────────┤
  │ GET  /api/reviews                   │ Chargement initial + filtres + recherche + pages   │
  │   ?search=sarah                     │   → Input de recherche (nom + texte du review)     │
  │   ?rating=5                         │   → Boutons filtre étoiles (1-5)                   │
  │   ?statusKey=rev.public             │   → Boutons filtre statut                          │
  │   ?source=NFC                       │   → Filtre source NFC/QR                           │
  │   ?location=3                       │   → Filtre par location                            │
  │   ?page=1&limit=20                  │   → Pagination (ChevronLeft / ChevronRight)        │
  ├─────────────────────────────────────┼───────────────────────────────────────────────────┤
  │ GET  /api/reviews/stats             │ Badges de comptage sur chaque filtre statut        │
  │                                     │ + métriques globales (avgRating, thisMonth...)     │
  ├─────────────────────────────────────┼───────────────────────────────────────────────────┤
  │ GET  /api/reviews/export            │ Bouton "Export CSV" (header de la vue)             │
  │   (mêmes query params)              │ → Même filtrage que la liste courante              │
  ├─────────────────────────────────────┼───────────────────────────────────────────────────┤
  │ PATCH /api/reviews/bulk/status      │ Barre de sélection : "Mark as Resolved"            │
  │   { ids: [1,2], status: "RESOLVED"} │ + "Export Selected" (le CSV passe par /export)    │
  ├─────────────────────────────────────┼───────────────────────────────────────────────────┤
  │ GET  /api/reviews/:id               │ Clic sur une ligne → dialog détail                 │
  ├─────────────────────────────────────┼───────────────────────────────────────────────────┤
  │ PATCH /api/reviews/:id/status       │ Bouton "Mark as Resolved" dans le dialog           │
  │   { statusKey: "rev.resolved" }     │ (CheckCircle icon)                                 │
  ├─────────────────────────────────────┼───────────────────────────────────────────────────┤
  │ PATCH /api/reviews/:id/notes        │ Textarea "Internal Notes" dans le dialog           │
  │   { notes: "..." }                  │ → Sauvegarde au blur ou bouton Save                │
  ├─────────────────────────────────────┼───────────────────────────────────────────────────┤
  │ POST  /api/reviews/:id/reply        │ Bouton "Reply" (MessageSquare) dans le dialog      │
  │   { reply: "..." }                  │ → Sauvegarde réponse + email client si email dispo │
  └─────────────────────────────────────┴───────────────────────────────────────────────────┘

  Intégration app.js :
    import reviewsRouter from "./src/routes/reviews.routes.js";
    app.use("/api/reviews", reviewsRouter);
*/