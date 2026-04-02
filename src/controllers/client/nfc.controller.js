// src/controllers/nfc.controller.js

import prisma from "../../config/database.js";
import crypto  from "crypto";

// ─── Helpers ──────────────────────────────────────────────────

const detectDevice = (ua = "") => {
  const s = ua.toLowerCase();
  if (/tablet|ipad/.test(s))                return "tablet";
  if (/mobile|android|iphone|ipod/.test(s)) return "mobile";
  return "desktop";
};

const getIp = (req) =>
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;

const buildFingerprint = (ip, ua) =>
  crypto.createHash("sha256").update(`${ip}|${ua ?? ""}`).digest("hex").slice(0, 16);


async function logEvent(cardUid, companyId, type, extras = {}) {
  try {
    await prisma.analyticsEvent.create({
      data: {
        cardUid,
        companyId,
        type,
        // Tous les champs optionnels du schéma Prisma AnalyticsEvent
        ipAddress:       extras.ipAddress       ?? null,
        userAgent:       extras.userAgent        ?? null,
        deviceType:      extras.deviceType       ?? null,
        country:         extras.country          ?? null,
        city:            extras.city             ?? null,
        referrer:        extras.referrer         ?? null,
        fingerprintHash: extras.fingerprintHash  ?? null,
        stars:           extras.stars            ?? null,
      },
    });
  } catch (e) {
    console.error("[nfc] logEvent error:", e.message);
  }
}

// Format complet d'une NFCCard pour la page d'avis
// Exposé sur GET /review/:uid — tout ce dont le front a besoin en un seul call
function formatCardForReview(card, company) {
  return {
    uid:             card.uid,
    // ── Location (établissement physique) ─────────────────────
    locationName:    card.locationName    ?? company?.name   ?? null,
    locationAddress: card.locationAddress ?? null,
    // ── Business (company) ────────────────────────────────────
    business: {
      name:             company?.name         ?? null,
      logo:             company?.logo         ?? null,
      primaryColor:     company?.primaryColor ?? "#E10600",
      thankYouMessage:  company?.thankYouMessage ?? "We value your feedback",
    },
    // ── Google ────────────────────────────────────────────────
    // NE PAS exposer googleReviewUrl ici — retourné seulement après vote positif
    googlePlaceId: card.googlePlaceId ?? null,
    // ── Status ────────────────────────────────────────────────
    active:    card.active,
    scanCount: card.scanCount ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────
// GET /r/:uid  — Point d'entrée scan NFC/QR
// ─────────────────────────────────────────────────────────────
// Appelé automatiquement quand le client scanne la carte.
// Enregistre le scan puis retourne les données de redirection.
// Le front redirige vers /review/:uid pour la page d'avis.

export const handleScan = async (req, res, next) => {
  try {
    const { uid }    = req.params;
    const scanType   = (req.query.type || "qr").toLowerCase(); // "nfc" | "qr"
    const ip         = getIp(req);
    const ua         = req.headers["user-agent"] || null;
    const deviceType = detectDevice(ua);
    const fingerprint = buildFingerprint(ip, ua);

    // Chercher la carte
    const card = await prisma.nFCCard.findUnique({ where: { uid } });

    if (!card) {
      return res.status(404).json({
        success: false,
        error:   "Carte introuvable",
        uid,
      });
    }

    // Carte non encore activée (pas encore livrée)
    if (!card.active) {
      return res.status(403).json({
        success: false,
        error:   "Cette carte n'est pas encore active.",
        status:  card.status,
      });
    }

    // Enregistrer le scan en arrière-plan (ne bloque pas la réponse)
    Promise.all([
      // Scan brut
      prisma.nfcScan.create({
        data: {
          cardUid:   uid,
          companyId: card.companyId,
          scanType,
          ipAddress:  ip,
          userAgent:  ua,
          deviceType,
        },
      }),
      // Événement analytics
      logEvent(uid, card.companyId, "SCAN", {
        ipAddress:       ip,
        userAgent:       ua,
        deviceType,
        referrer:        req.headers["referer"] ?? null,
        fingerprintHash: fingerprint,
      }),
      // Mise à jour compteurs sur la carte
      prisma.nFCCard.update({
        where: { uid },
        data: {
          used:          true,
          scanCount:     { increment: 1 },
          lastScannedAt: new Date(),
        },
      }),
    ]).catch((e) => console.error("[nfc] scan tracking error:", e.message));

    // Retourner les données de redirection
    // Le front redirige vers /review/:uid pour afficher la page d'avis
    res.json({
      success:     true,
      uid,
      redirectUrl: `/review/${uid}`,  // URL de la page d'avis (Next.js route)
      // Données basiques pour afficher un état intermédiaire si besoin
      locationName:    card.locationName    ?? null,
      locationAddress: card.locationAddress ?? null,
    });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// GET /review/:uid  — Données de la page d'avis
// ─────────────────────────────────────────────────────────────
// Appelé par le front au chargement de /review/[uid].
// Enregistre PAGE_VIEW et retourne tout ce qu'il faut pour
// afficher la page (nom, logo, couleurs, message d'accueil...).

export const getReviewPage = async (req, res, next) => {
  try {
    const { uid }    = req.params;
    const ip         = getIp(req);
    const ua         = req.headers["user-agent"] || null;
    const deviceType = detectDevice(ua);

    const card = await prisma.nFCCard.findUnique({ where: { uid } });

    if (!card) {
      return res.status(404).json({ success: false, error: "Carte introuvable" });
    }

    if (!card.active) {
      return res.status(403).json({ success: false, error: "Carte inactive" });
    }

    // Charger les données de la company pour la page d'avis
    const company = await prisma.company.findUnique({
      where:  { id: card.companyId },
      select: {
        name:             true,
        logo:             true,
        primaryColor:     true,
        thankYouMessage:  true,  // message personnalisé affiché sur la page
      },
    });

    // Enregistrer PAGE_VIEW (async — ne bloque pas)
    logEvent(uid, card.companyId, "PAGE_VIEW", {
      ipAddress:  ip,
      userAgent:  ua,
      deviceType,
      referrer:   req.headers["referer"] ?? null,
    }).catch(console.error);

    res.json({
      success: true,
      data:    formatCardForReview(card, company),
    });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// POST /review/:uid/rate  — Soumettre la note (étoiles)
// ─────────────────────────────────────────────────────────────
// Body : { stars: 1-5 }
//
// 4-5 ⭐ → POSITIVE
//   → enregistre RATING_SELECTED + GOOGLE_REDIRECT
//   → retourne { action: "GOOGLE_REDIRECT", googleReviewUrl }
//   → le front ouvre l'URL Google dans un nouvel onglet
//
// 1-3 ⭐ → NEGATIVE
//   → enregistre RATING_SELECTED
//   → retourne { action: "INTERNAL_FEEDBACK" }
//   → le front affiche le formulaire de feedback interne

export const submitRating = async (req, res, next) => {
  try {
    const { uid }   = req.params;
    const { stars } = req.body;
    const ip        = getIp(req);
    const ua        = req.headers["user-agent"] || null;
    const deviceType = detectDevice(ua);

    // Validation
    const starsNum = parseInt(stars);
    if (!starsNum || starsNum < 1 || starsNum > 5) {
      return res.status(422).json({
        success: false,
        error:   "stars doit être un entier entre 1 et 5",
      });
    }

    const card = await prisma.nFCCard.findUnique({ where: { uid } });
    if (!card || !card.active) {
      return res.status(404).json({ success: false, error: "Carte introuvable ou inactive" });
    }

    // Enregistrer RATING_SELECTED dans tous les cas
    logEvent(uid, card.companyId, "RATING_SELECTED", {
      stars:      starsNum,
      ipAddress:  ip,
      userAgent:  ua,
      deviceType,
      referrer:   req.headers["referer"] ?? null,
    }).catch(console.error);

    if (starsNum >= 4) {
      // ── POSITIF (4-5 ⭐) → redirection Google ───────────────

      // Enregistrer GOOGLE_REDIRECT + incrémenter le compteur (async)
      Promise.all([
        logEvent(uid, card.companyId, "GOOGLE_REDIRECT", {
          stars:     starsNum,
          ipAddress: ip,
          userAgent: ua,
          deviceType,
          referrer:  req.headers["referer"] ?? null,
        }),
        prisma.nFCCard.update({
          where: { uid },
          data:  { googleRedirectCount: { increment: 1 } },
        }),
      ]).catch(console.error);

      return res.json({
        success:         true,
        action:          "GOOGLE_REDIRECT",
        googleReviewUrl: card.googleReviewUrl,  // URL Google Reviews
        message:         "Merci ! Vous allez être redirigé vers Google.",
        stars:           starsNum,
      });

    } else {
      // ── NÉGATIF (1-3 ⭐) → formulaire interne ───────────────
      // Pas de redirection Google
      return res.json({
        success: true,
        action:  "INTERNAL_FEEDBACK",
        message: "Votre avis compte beaucoup pour nous.",
        stars:   starsNum,
        // uid retourné pour le POST /review/:uid/feedback suivant
        uid,
      });
    }
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// POST /review/:uid/feedback  — Soumettre le feedback interne
// ─────────────────────────────────────────────────────────────
// Appelé uniquement pour les notes négatives (1-3 ⭐)
// Body : { stars, message, email? }
//
// → Sauvegarde le Feedback en DB
// → Enregistre FEEDBACK_SUBMITTED
// → Envoie un email de notification à l'admin (async)

export const submitFeedback = async (req, res, next) => {
  try {
    const { uid }                    = req.params;
    const { stars, message, email }  = req.body;

    // Validation
    const starsNum = parseInt(stars);
    if (!starsNum || starsNum < 1 || starsNum > 3) {
      return res.status(422).json({
        success: false,
        error:   "stars doit être entre 1 et 3 pour un feedback négatif",
      });
    }
    if (!message?.trim()) {
      return res.status(422).json({ success: false, error: "message requis" });
    }

    const card = await prisma.nFCCard.findUnique({ where: { uid } });
    if (!card || !card.active) {
      return res.status(404).json({ success: false, error: "Carte introuvable" });
    }

    // Détecter la source du scan depuis le dernier NfcScan de cette carte
    // Le scan le plus récent a été enregistré dans handleScan
    const lastScan = await prisma.nfcScan.findFirst({
      where:   { cardUid: uid },
      orderBy: { scannedAt: "desc" },
      select:  { scanType: true },
    });
    const source = (lastScan?.scanType ?? "qr").toUpperCase(); // "NFC" | "QR"

    // Sauvegarder le feedback
    // Champs alignés exactement avec le modèle Prisma Feedback :
    //   cardUid, companyId, locationId, status, internalNotes, adminReply,
    //   repliedAt, source, customerName, stars, message, email, notifiedAt
    const feedback = await prisma.feedback.create({
      data: {
        cardUid:      uid,
        companyId:    card.companyId,
        locationId:   card.locationId ?? null,
        stars:        starsNum,
        message:      message.trim(),
        email:        email?.trim() ?? null,
        customerName: null,        // non collecté à ce stade (visiteur anonyme)
        status:       "PENDING",   // FeedbackStatus.PENDING
        source,                    // "NFC" | "QR" — depuis le dernier scan
        // internalNotes / adminReply / repliedAt : remplis par l'admin via la vue Reviews
      },
    });

    // Enregistrer FEEDBACK_SUBMITTED (async)
    logEvent(uid, card.companyId, "FEEDBACK_SUBMITTED", { stars: starsNum }).catch(console.error);

    // Email de notification admin (async — ne bloque pas)
    sendFeedbackNotification(feedback, card).catch((e) =>
      console.error("[nfc] feedback email:", e.message)
    );

    res.json({
      success: true,
      message: "Merci pour votre retour. Nous allons l'examiner et améliorer notre service.",
    });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// Notification email admin
// ─────────────────────────────────────────────────────────────

async function sendFeedbackNotification(feedback, card) {
  try {
    const { sendTemplatedMail } = await import("../../services/client/mail.service.js");

    const ownerLink = await prisma.userCompany.findFirst({
      where:   { companyId: card.companyId, isOwner: true },
      include: { user: true },
    });
    if (!ownerLink) return;

    await sendTemplatedMail({
      slug: "feedback_received",
      to:   ownerLink.user.email,
      variables: {
        stars:    String(feedback.stars),
        message:  feedback.message ?? "Aucun message",
        location: card.locationName ?? "Votre établissement",
        date:     new Date().toLocaleDateString("fr-FR"),
      },
      fallbackFn: () => ({
        subject: `⭐ Feedback ${feedback.stars}/5 — ${card.locationName ?? ""}`,
        html: `
          <p>Nouveau feedback <strong>${feedback.stars}/5</strong> pour
          "${card.locationName ?? "votre établissement"}".</p>
          <p><strong>Message :</strong> ${feedback.message ?? ""}</p>
          <p><em>${new Date().toLocaleDateString("fr-FR")}</em></p>
        `,
        text: `Feedback ${feedback.stars}/5 : ${feedback.message ?? ""}`,
      }),
    });

    await prisma.feedback.update({
      where: { id: feedback.id },
      data:  { notifiedAt: new Date() },
    });
  } catch (e) {
    console.error("[nfc] sendFeedbackNotification:", e.message);
  }
}