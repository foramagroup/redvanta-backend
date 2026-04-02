// src/controllers/reviews.controller.js
// ─────────────────────────────────────────────────────────────
// Endpoints qui alimentent la vue client "Reviews" (admin company)
//
// La vue affiche une liste unifiée de 2 sources :
//   • Feedback (1-3 ⭐) → feedback interne négatif
//   • AnalyticsEvent GOOGLE_REDIRECT (4-5 ⭐) → avis positif redirigé Google
//
// Colonnes affichées dans la vue :
//   Customer | Rating | Review | Location | Source (NFC/QR) | Status | Date
//
// Endpoints :
//   GET    /api/reviews              Liste paginée + filtres
//   GET    /api/reviews/stats        Compteurs par statut + rating moyen
//   GET    /api/reviews/:id          Détail d'un feedback (dialog)
//   PATCH  /api/reviews/:id/status   Changer le statut (Resolved, Public, Private...)
//   PATCH  /api/reviews/:id/notes    Sauvegarder les notes internes (textarea dialog)
//   POST   /api/reviews/:id/reply    Répondre au feedback (bouton "Reply")
//   PATCH  /api/reviews/bulk/status  Marquer une sélection comme Resolved
//   GET    /api/reviews/export       Export CSV de la liste filtrée

import prisma from "../config/database.js";

// ─── Helper companyId ─────────────────────────────────────────
function getCompanyId(req) {
  const id = req.user?.companyId;
  if (!id) throw Object.assign(new Error("Aucune company active"), { status: 403 });
  return parseInt(id);
}

// ─── Format d'un feedback pour la réponse API ─────────────────
// Correspond exactement à la shape attendue par la vue Reviews
function formatReview(feedback) {
  return {
    id:           feedback.id,
    // ─ Identité client ──────────────────────────────────────
    name:         feedback.customerName   ?? "Anonymous",
    email:        feedback.email          ?? null,
    // ─ Contenu ──────────────────────────────────────────────
    rating:       feedback.stars,
    text:         feedback.message        ?? "",
    // ─ Contexte ─────────────────────────────────────────────
    location:     feedback.location?.name ?? null,
    locationId:   feedback.locationId     ?? null,
    source:       feedback.source         ?? "QR",    // "NFC" | "QR"
    cardUid:      feedback.cardUid,
    // ─ Statut (statusKey de la vue) ─────────────────────────
    // Mapping : DB status → clé i18n de la vue
    statusKey:    STATUS_TO_I18N[feedback.status] ?? "rev.pending",
    status:       feedback.status,
    // ─ Admin ────────────────────────────────────────────────
    internalNotes: feedback.internalNotes ?? null,
    adminReply:    feedback.adminReply    ?? null,
    repliedAt:     feedback.repliedAt     ?? null,
    // ─ Dates ────────────────────────────────────────────────
    date:         formatDate(feedback.createdAt),
    createdAt:    feedback.createdAt,
    updatedAt:    feedback.updatedAt      ?? feedback.createdAt,
  };
}

// Mapping statut DB ↔ clé i18n de la vue
const STATUS_TO_I18N = {
  PUBLIC:   "rev.public",
  PRIVATE:  "rev.private",
  RESOLVED: "rev.resolved",
  PENDING:  "rev.pending",
};

// Mapping clé i18n → statut DB (pour les filtres entrants)
const I18N_TO_STATUS = {
  "rev.public":   "PUBLIC",
  "rev.private":  "PRIVATE",
  "rev.resolved": "RESOLVED",
  "rev.pending":  "PENDING",
};

function formatDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─────────────────────────────────────────────────────────────
// GET /api/reviews
// ─────────────────────────────────────────────────────────────
// Query params :
//   search     — recherche sur customerName + message
//   rating     — filtrer par nombre d'étoiles (1-5)
//   statusKey  — "rev.public" | "rev.private" | "rev.resolved" | "rev.pending"
//   location   — locationId
//   source     — "NFC" | "QR"
//   page       — défaut 1
//   limit      — défaut 20, max 100

export const listReviews = async (req, res, next) => {
  try {
    const companyId   = getCompanyId(req);
    const page        = Math.max(1,   parseInt(req.query.page)   || 1);
    const limit       = Math.min(100, parseInt(req.query.limit)  || 20);
    const search      = req.query.search?.trim()      || null;
    const rating      = parseInt(req.query.rating)    || null;
    const statusKey   = req.query.statusKey           || null;
    const locationId  = parseInt(req.query.location)  || null;
    const source      = req.query.source              || null;   // "NFC" | "QR"

    // Résoudre le statut depuis la clé i18n envoyée par le front
    const status = statusKey ? I18N_TO_STATUS[statusKey] : null;

    const where = {
      companyId,
      ...(rating     && { stars:      rating }),
      ...(status     && { status }),
      ...(locationId && { locationId }),
      ...(source     && { source }),
      ...(search && {
        OR: [
          { customerName: { contains: search } },
          { message:      { contains: search } },
        ],
      }),
    };

    const [feedbacks, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        include: { location: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      prisma.feedback.count({ where }),
    ]);

    res.json({
      success: true,
      data:    feedbacks.map(formatReview),
      meta: {
        total,
        page,
        limit,
        last_page: Math.ceil(total / limit),
        // Utile pour la pagination de la vue
        showing: feedbacks.length,
      },
    });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// GET /api/reviews/stats
// ─────────────────────────────────────────────────────────────
// Compteurs utilisés par les filtres de statut (badges) + métriques globales
// Response :
//   { total, byStatus: { PUBLIC, PRIVATE, RESOLVED, PENDING },
//     avgRating, thisMonth, googleRedirects }

export const getReviewStats = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [total, byStatus, ratingAgg, thisMonthCount, googleRedirects] = await Promise.all([
      // Total feedbacks
      prisma.feedback.count({ where: { companyId } }),

      // Count par statut (pour les badges filtres de la vue)
      prisma.feedback.groupBy({
        by:    ["status"],
        where: { companyId },
        _count: { id: true },
      }),

      // Moyenne des étoiles
      prisma.feedback.aggregate({
        where: { companyId },
        _avg:  { stars: true },
      }),

      // Ce mois-ci
      prisma.feedback.count({ where: { companyId, createdAt: { gte: thisMonth } } }),

      // Avis positifs redirigés vers Google ce mois
      prisma.analyticsEvent.count({
        where: { companyId, type: "GOOGLE_REDIRECT", occurredAt: { gte: thisMonth } },
      }),
    ]);

    // Transformer le groupBy en objet plat
    const statusCounts = { PUBLIC: 0, PRIVATE: 0, RESOLVED: 0, PENDING: 0 };
    byStatus.forEach((s) => { statusCounts[s.status] = s._count.id; });

    res.json({
      success: true,
      data: {
        total,
        byStatus:       statusCounts,
        avgRating:      ratingAgg._avg.stars ? Math.round(ratingAgg._avg.stars * 10) / 10 : 0,
        thisMonth:      thisMonthCount,
        googleRedirects,
        // Taux de résolution
        resolutionRate: total > 0
          ? `${Math.round((statusCounts.RESOLVED / total) * 100)}%`
          : "0%",
      },
    });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// GET /api/reviews/:id
// ─────────────────────────────────────────────────────────────
// Détail complet d'un feedback pour le dialog de la vue

export const getReview = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const companyId = getCompanyId(req);

    const feedback = await prisma.feedback.findFirst({
      where:   { id, companyId },
      include: { location: { select: { id: true, name: true, address: true } } },
    });

    if (!feedback) return res.status(404).json({ success: false, error: "Feedback introuvable" });

    res.json({ success: true, data: formatReview(feedback) });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/reviews/:id/status
// ─────────────────────────────────────────────────────────────
// Changer le statut d'un feedback (bouton "Mark as Resolved" dans la vue)
// Body : { status: "RESOLVED" | "PUBLIC" | "PRIVATE" | "PENDING" }
//   ou  { statusKey: "rev.resolved" } — clé i18n envoyée par le front

export const updateReviewStatus = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const companyId = getCompanyId(req);

    // Accepter soit status (DB) soit statusKey (i18n front)
    let status = req.body.status;
    if (!status && req.body.statusKey) {
      status = I18N_TO_STATUS[req.body.statusKey];
    }

    const validStatuses = ["PUBLIC", "PRIVATE", "RESOLVED", "PENDING"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(422).json({ success: false, error: `status invalide. Valeurs : ${validStatuses.join(", ")}` });
    }

    const existing = await prisma.feedback.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ success: false, error: "Feedback introuvable" });

    const updated = await prisma.feedback.update({
      where:   { id },
      data:    { status },
      include: { location: { select: { id: true, name: true } } },
    });

    res.json({
      success: true,
      message: `Statut mis à jour : ${status}`,
      data:    formatReview(updated),
    });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/reviews/:id/notes
// ─────────────────────────────────────────────────────────────
// Sauvegarder les notes internes (textarea dans le dialog)
// Body : { notes: "..." }

export const updateInternalNotes = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const companyId = getCompanyId(req);
    const { notes } = req.body;

    if (notes === undefined) return res.status(422).json({ success: false, error: "notes requis" });

    const existing = await prisma.feedback.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ success: false, error: "Feedback introuvable" });

    const updated = await prisma.feedback.update({
      where:   { id },
      data:    { internalNotes: notes?.trim() || null },
      include: { location: { select: { id: true, name: true } } },
    });

    res.json({ success: true, message: "Notes sauvegardées", data: formatReview(updated) });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// POST /api/reviews/:id/reply
// ─────────────────────────────────────────────────────────────
// Répondre à un feedback (bouton "Reply" dans le dialog)
// Body : { reply: "Merci pour votre retour..." }
// → Sauvegarde adminReply + repliedAt + (optionnel) envoie un email au client

export const replyToReview = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const companyId = getCompanyId(req);
    const { reply } = req.body;

    if (!reply?.trim()) return res.status(422).json({ success: false, error: "reply requis" });

    const feedback = await prisma.feedback.findFirst({
      where:   { id, companyId },
      include: { location: { select: { name: true } } },
    });
    if (!feedback) return res.status(404).json({ success: false, error: "Feedback introuvable" });

    const updated = await prisma.feedback.update({
      where: { id },
      data: {
        adminReply: reply.trim(),
        repliedAt:  new Date(),
        // Marquer comme RESOLVED après réponse
        status:     "RESOLVED",
      },
      include: { location: { select: { id: true, name: true } } },
    });

    // Envoyer un email de réponse au client si email disponible
    if (feedback.email) {
      sendReplyEmail(feedback, reply.trim()).catch((e) =>
        console.error("[reviews] Erreur envoi email réponse:", e.message)
      );
    }

    res.json({
      success: true,
      message: "Réponse envoyée" + (feedback.email ? " et email notifié" : ""),
      data:    formatReview(updated),
    });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/reviews/bulk/status
// ─────────────────────────────────────────────────────────────
// Marquer une sélection de feedbacks (bouton "Mark Resolved" dans la barre bulk)
// Body : { ids: [1, 2, 3], status: "RESOLVED" }

export const bulkUpdateStatus = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    let { ids, status, statusKey } = req.body;

    // Accepter statusKey i18n ou status DB
    if (!status && statusKey) status = I18N_TO_STATUS[statusKey];

    const validStatuses = ["PUBLIC", "PRIVATE", "RESOLVED", "PENDING"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(422).json({ success: false, error: "status invalide" });
    }
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(422).json({ success: false, error: "ids[] requis (tableau non vide)" });
    }

    // Sécurité : ne mettre à jour que les feedbacks appartenant à la company
    const result = await prisma.feedback.updateMany({
      where: {
        id:        { in: ids.map(Number) },
        companyId,
      },
      data: { status },
    });

    res.json({
      success: true,
      message: `${result.count} feedback(s) mis à jour → ${status}`,
      updated: result.count,
    });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// GET /api/reviews/export
// ─────────────────────────────────────────────────────────────
// Export CSV de la liste filtrée (bouton "Export CSV" de la vue)
// Accepte les mêmes query params que /api/reviews
// Retourne directement un fichier CSV en streaming

export const exportReviewsCsv = async (req, res, next) => {
  try {
    const companyId  = getCompanyId(req);
    const search     = req.query.search?.trim()     || null;
    const rating     = parseInt(req.query.rating)   || null;
    const statusKey  = req.query.statusKey          || null;
    const locationId = parseInt(req.query.location) || null;
    const source     = req.query.source             || null;

    const status = statusKey ? I18N_TO_STATUS[statusKey] : null;

    const where = {
      companyId,
      ...(rating     && { stars:      rating }),
      ...(status     && { status }),
      ...(locationId && { locationId }),
      ...(source     && { source }),
      ...(search && {
        OR: [
          { customerName: { contains: search } },
          { message:      { contains: search } },
        ],
      }),
    };

    const feedbacks = await prisma.feedback.findMany({
      where,
      include: { location: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    // Construire le CSV
    const header = ["Customer", "Rating", "Review", "Location", "Source", "Status", "Date", "Notes", "Reply"].join(",");
    const rows   = feedbacks.map((f) => [
      csvCell(f.customerName ?? "Anonymous"),
      f.stars,
      csvCell(f.message ?? ""),
      csvCell(f.location?.name ?? ""),
      csvCell(f.source ?? ""),
      csvCell(STATUS_TO_I18N[f.status] ?? f.status),
      csvCell(formatDate(f.createdAt)),
      csvCell(f.internalNotes ?? ""),
      csvCell(f.adminReply ?? ""),
    ].join(","));

    const csv = [header, ...rows].join("\n");

    // Envoyer le fichier CSV
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="reviews-${Date.now()}.csv"`);
    res.send("\uFEFF" + csv); // BOM UTF-8 pour Excel
  } catch (e) { next(e); }
};

// ─── Helpers ──────────────────────────────────────────────────

// Échapper les cellules CSV (guillemets doubles, virgules, sauts de ligne)
function csvCell(value) {
  const str = String(value ?? "").replace(/"/g, '""');
  return `"${str}"`;
}

// Envoyer un email de réponse au client
async function sendReplyEmail(feedback, reply) {
  try {
    const { sendTemplatedMail } = await import("../../services/mail.service.js");
    await sendTemplatedMail({
      slug: "feedback_reply",
      to:   feedback.email,
      variables: {
        customerName: feedback.customerName ?? "Client",
        reply,
        stars:        String(feedback.stars),
        originalText: feedback.message ?? "",
      },
      fallbackFn: () => ({
        subject: "Réponse à votre avis",
        html: `<p>Bonjour,</p><p>Merci pour votre retour. Voici notre réponse :</p><blockquote>${reply}</blockquote>`,
        text: `Bonjour, voici notre réponse à votre avis : ${reply}`,
      }),
    });
  } catch (e) {
    console.error("[reviews] sendReplyEmail:", e.message);
  }
}