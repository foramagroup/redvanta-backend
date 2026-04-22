// src/controllers/nfc.controller.js — VERSION FINALE
// ─────────────────────────────────────────────────────────────
// FLUX B — Scan NFC/QR → Redirect HTTP → Page d'avis → Google ou Feedback
//
// Flux complet :
//   1. Client scanne → GET /r/:uid
//      → enregistre SCAN (async)
//      → HTTP 302 redirect vers ${FRONTEND_URL}/review/:uid
//      → Android affiche bannière native avec le <title> de la page
//
//   2. GET /review/:uid (appelé par Next.js au chargement de la page)
//      → enregistre PAGE_VIEW
//      → retourne toutes les données (nom, logo, couleurs, thankYouMessage...)
//
//   3. POST /review/:uid/rate  { stars }
//      → 4-5 ⭐ : enregistre RATING_SELECTED + GOOGLE_REDIRECT
//                  retourne { action: "GOOGLE_REDIRECT", googleReviewUrl }
//      → 1-3 ⭐ : enregistre RATING_SELECTED
//                  retourne { action: "INTERNAL_FEEDBACK" }
//
//   4. POST /review/:uid/feedback  { stars, message, email? }
//      → enregistre FEEDBACK_SUBMITTED
//      → sauvegarde Feedback en DB
//      → email de notification à l'admin (async)
//
// Identifiant : uid (UUID stable, encodé dans le QR + puce NFC)
// La bannière Android affiche le <title> de la page /review/:uid
// configuré via generateMetadata() dans Next.js — aucun code push nécessaire

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

// logEvent — wrappeur pour analyticsEvent.create
// Champs du modèle AnalyticsEvent supportés via extras :
//   ipAddress, userAgent, deviceType, country, city, referrer,
//   fingerprintHash, stars
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
// Déclenché automatiquement quand Android lit la puce NFC ou quand
// le client scanne le QR code avec son appareil photo.
// → enregistre le scan en DB (async, ne bloque pas)
// → HTTP 302 redirect vers FRONTEND_URL/review/:uid
// Android affiche la bannière native avec le titre de la page destination.

export const handleScan = async (req, res, next) => {
  try {
    const { uid }    = req.params;
    const scanType   = (req.query.type || "qr").toLowerCase(); // "nfc" | "qr"
    const ip         = getIp(req);
    const ua         = req.headers["user-agent"] || null;
    const deviceType = detectDevice(ua);
    const fingerprint = buildFingerprint(ip, ua);

    // Chercher la carte
    const card = await prisma.nFCCard.findUnique({ where: { uid }, include: { company: true } });

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

    // ── HTTP 302 redirect vers la page d'avis ───────────────
    // Android Chrome lit la puce NFC → suit le redirect → affiche le
    // <title> de la page dans la bannière native en haut de l'écran.
    // Le visiteur tape sur la bannière → arrive sur /review/:uid.
    // Aucune lib push / Service Worker nécessaire — c'est le comportement
    // natif d'Android NFC avec une URL HTTP redirect.

   const companySlug = card.company?.name
  .toLowerCase()
  .trim()
  .replace(/\s+/g, '-')
  .replace(/[^\w-]/g, '');

   return res.redirect(302, `${process.env.URL_PROD_FRONTEND}/review/${companySlug}?uid=${uid}`);
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// GET /review/:uid  — Données de la page d'avis
// ─────────────────────────────────────────────────────────────
// Appelé par le front au chargement de /review/[companyName].
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

    const card = await prisma.nFCCard.findUnique({ 
      where: { uid },
      include: {
        company: true
      }
    });
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
        googleReviewUrl: card.googleReviewUrl||card.company.googleReviewUrl,  // URL Google Reviews
        googlePlaceId: card.company.googlePlaceId,  // URL Google Reviews
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