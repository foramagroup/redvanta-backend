// src/controllers/nfc.controller.js — VERSION FINALE v3
// ─────────────────────────────────────────────────────────────
// Support multi-plateformes avec comportements différenciés :
//
//  ┌─────────────────┬──────────────────┬────────────────────────────────────┐
//  │ Plateforme      │ Comportement     │ Flux                               │
//  ├─────────────────┼──────────────────┼────────────────────────────────────┤
//  │ google          │ redirect_filtered│ stars → ≥4 redirect, <4 feedback   │
//  │ tripadvisor     │ redirect_filtered│ stars → ≥4 redirect, <4 feedback   │
//  │ booking         │ redirect_filtered│ stars → ≥4 redirect, <4 feedback   │
//  │ airbnb          │ redirect_filtered│ stars → ≥4 redirect, <4 feedback   │
//  ├─────────────────┼──────────────────┼────────────────────────────────────┤
//  │ facebook        │ direct           │ toujours redirect (pas de filtre)   │
//  │ instagram       │ direct           │ toujours redirect (pas de filtre)   │
//  │ tiktok          │ direct           │ toujours redirect (pas de filtre)   │
//  ├─────────────────┼──────────────────┼────────────────────────────────────┤
//  │ custom          │ selon redirectMode│ "filtered" ou "direct" (Design)    │
//  └─────────────────┴──────────────────┴────────────────────────────────────┘
//
//  Tous les événements sont trackés dans AnalyticsEvent.

import prisma from "../../config/database.js";
import crypto  from "crypto";

// ─── Constantes de comportement ───────────────────────────────

const FILTERED_PLATFORMS = new Set(["google", "tripadvisor", "booking", "airbnb"]);
const DIRECT_PLATFORMS   = new Set(["facebook", "instagram", "tiktok"]);
const POSITIVE_THRESHOLD = 4;

function getPlatformBehavior(platform, redirectMode = null) {
  if (FILTERED_PLATFORMS.has(platform)) return "redirect_filtered";
  if (DIRECT_PLATFORMS.has(platform))   return "direct";
  if (platform === "custom") {
    return redirectMode === "filtered" ? "redirect_filtered" : "direct";
  }
  return "redirect_filtered"; // défaut sûr
}

function resolveRedirectUrl(platform, card, design, company) {
  if (platform === "google") {
    return card.googleReviewUrl || design?.googleReviewUrl || company?.googleReviewUrl || null;
  }
  return design?.platformUrl || null;
}

function platformLabel(platform) {
  const labels = {
    google: "Google", facebook: "Facebook", instagram: "Instagram",
    tiktok: "TikTok", tripadvisor: "TripAdvisor", booking: "Booking.com",
    airbnb: "Airbnb", custom: "notre page d'avis",
  };
  return labels[platform] ?? "la plateforme";
}

const detectDevice = (ua = "") => {
  const s = ua.toLowerCase();
  if (/tablet|ipad/.test(s)) return "tablet";
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
        cardUid, companyId, type,
        ipAddress: extras.ipAddress ?? null, userAgent: extras.userAgent ?? null,
        deviceType: extras.deviceType ?? null, country: extras.country ?? null,
        city: extras.city ?? null, referrer: extras.referrer ?? null,
        fingerprintHash: extras.fingerprintHash ?? null, stars: extras.stars ?? null,
      },
    });
  } catch (e) { console.error("[nfc] logEvent error:", e.message); }
}

function formatCardForReview(card, company, design) {
  const platform     = design?.platform    ?? "google";
  const redirectMode = design?.redirectMode ?? null;
  const behavior     = getPlatformBehavior(platform, redirectMode);

  return {
    uid:             card.uid,
    locationName:    card.locationName    ?? company?.name ?? null,
    locationAddress: card.locationAddress ?? null,
    business: {
      name:            company?.name            ?? null,
      logo:            company?.logo            ?? null,
      primaryColor:    company?.primaryColor    ?? "#E10600",
      thankYouMessage: company?.thankYouMessage ?? "We value your feedback",
    },
    platform,
    platformLabel:    platformLabel(platform),
    // Le front adapte son UI selon ce champ :
    // "redirect_filtered" → afficher les étoiles d'abord
    // "direct"            → bouton direct "Laisser un avis"
    platformBehavior: behavior,
    positiveThreshold: POSITIVE_THRESHOLD,
    googlePlaceId: platform === "google" ? (card.googlePlaceId ?? null) : null,
    active:    card.active,
    scanCount: card.scanCount ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────
// GET /r/:uid
// ─────────────────────────────────────────────────────────────

export const handleScan = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const scanType = (req.query.type || "qr").toLowerCase();
    const ip = getIp(req);
    const ua = req.headers["user-agent"] || null;
    const deviceType = detectDevice(ua);
    const fingerprint = buildFingerprint(ip, ua);

    const card = await prisma.nFCCard.findUnique({ where: { uid }, include: { company: true } });

    if (!card) return res.status(404).json({ success: false, error: "Carte introuvable", uid });
    if (!card.active) return res.status(403).json({ success: false, error: "Cette carte n'est pas encore active.", status: card.status });

    Promise.all([
      prisma.nfcScan.create({ data: { cardUid: uid, companyId: card.companyId, scanType, ipAddress: ip, userAgent: ua, deviceType } }),
      logEvent(uid, card.companyId, "SCAN", { ipAddress: ip, userAgent: ua, deviceType, referrer: req.headers["referer"] ?? null, fingerprintHash: fingerprint }),
      prisma.nFCCard.update({ where: { uid }, data: { used: true, scanCount: { increment: 1 }, lastScannedAt: new Date() } }),
    ]).catch((e) => console.error("[nfc] scan tracking error:", e.message));

    const companySlug = (card.company?.name ?? "review")
      .toLowerCase().trim().replace(/\s+/g, "-").replace(/[^\w-]/g, "");

    return res.redirect(302, `${process.env.URL_PROD_FRONTEND}/review/${companySlug}?uid=${uid}`);
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// GET /review/:uid
// ─────────────────────────────────────────────────────────────

export const getReviewPage = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const ip = getIp(req);
    const ua = req.headers["user-agent"] || null;
    const deviceType = detectDevice(ua);

    const card = await prisma.nFCCard.findUnique({
      where:   { uid },
      include: {
        design: {
          select: {
            platform: true, platformUrl: true,
            googleReviewUrl: true, googlePlaceId: true,
            redirectMode: true, // "filtered" | "direct" | null (pour custom)
          },
        },
      },
    });

    if (!card)        return res.status(404).json({ success: false, error: "Carte introuvable" });
    if (!card.active) return res.status(403).json({ success: false, error: "Carte inactive" });

    const company = await prisma.company.findUnique({
      where:  { id: card.companyId },
      select: { name: true, logo: true, primaryColor: true, thankYouMessage: true, googleReviewUrl: true },
    });

    logEvent(uid, card.companyId, "PAGE_VIEW", {
      ipAddress: ip, userAgent: ua, deviceType, referrer: req.headers["referer"] ?? null,
    }).catch(console.error);

    res.json({ success: true, data: formatCardForReview(card, company, card.design) });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// POST /review/:uid/rate
// ─────────────────────────────────────────────────────────────
//
// redirect_filtered (google, tripadvisor, booking, airbnb) :
//   ≥4 → PLATFORM_REDIRECT
//   <4 → INTERNAL_FEEDBACK
//
// direct (facebook, instagram, tiktok) :
//   toujours → PLATFORM_REDIRECT (stars trackées quand même)
//
// custom : selon design.redirectMode

export const submitRating = async (req, res, next) => {
  try {
    const { uid }    = req.params;
    const { stars }  = req.body;
    const ip         = getIp(req);
    const ua         = req.headers["user-agent"] || null;
    const deviceType = detectDevice(ua);

    const starsNum = parseInt(stars);
    if (!starsNum || starsNum < 1 || starsNum > 5) {
      return res.status(422).json({ success: false, error: "stars doit être un entier entre 1 et 5" });
    }

    const card = await prisma.nFCCard.findUnique({
      where:   { uid },
      include: {
        company: { select: { googleReviewUrl: true, googlePlaceId: true } },
        design:  { select: { platform: true, platformUrl: true, googleReviewUrl: true, googlePlaceId: true, redirectMode: true } },
      },
    });

    if (!card || !card.active) {
      return res.status(404).json({ success: false, error: "Carte introuvable ou inactive" });
    }

    const platform     = card.design?.platform    ?? "google";
    const redirectMode = card.design?.redirectMode ?? null;
    const behavior     = getPlatformBehavior(platform, redirectMode);
    const redirectUrl  = resolveRedirectUrl(platform, card, card.design, card.company);

    // Tracker RATING_SELECTED dans tous les cas
    logEvent(uid, card.companyId, "RATING_SELECTED", {
      stars: starsNum, ipAddress: ip, userAgent: ua, deviceType,
      referrer: req.headers["referer"] ?? null,
    }).catch(console.error);

    // Décider du flux
    const shouldRedirect =
      behavior === "direct" ||
      (behavior === "redirect_filtered" && starsNum >= POSITIVE_THRESHOLD);

    if (shouldRedirect) {

      if (!redirectUrl) {
        // URL non configurée → fallback feedback interne
        console.warn(`[nfc] No redirectUrl for uid=${uid} platform=${platform}`);
        return res.json({ success: true, action: "INTERNAL_FEEDBACK", message: "Merci pour votre avis !", stars: starsNum, uid });
      }

      // Tracker + incrémenter compteur
      Promise.all([
        logEvent(uid, card.companyId, "GOOGLE_REDIRECT", {
          // Conserve "GOOGLE_REDIRECT" en DB pour compat analytics existants
          stars: starsNum, ipAddress: ip, userAgent: ua, deviceType,
          referrer: req.headers["referer"] ?? null,
        }),
        prisma.nFCCard.update({ where: { uid }, data: { googleRedirectCount: { increment: 1 } } }),
      ]).catch(console.error);

      return res.json({
        success:          true,
        action:           "PLATFORM_REDIRECT",
        platform,
        platformLabel:    platformLabel(platform),
        platformBehavior: behavior,
        redirectUrl,
        // Compat legacy : si Google, exposer aussi googleReviewUrl
        ...(platform === "google" && {
          googleReviewUrl: redirectUrl,
          googlePlaceId:   card.design?.googlePlaceId || card.company?.googlePlaceId || null,
        }),
        message: `Merci ! Vous allez être redirigé vers ${platformLabel(platform)}.`,
        stars:   starsNum,
      });

    } else {
      // redirect_filtered + note négative
      return res.json({
        success:          true,
        action:           "INTERNAL_FEEDBACK",
        platform,
        platformBehavior: behavior,
        message:          "Votre avis compte beaucoup pour nous.",
        stars:            starsNum,
        uid,
      });
    }
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// POST /review/:uid/feedback
// ─────────────────────────────────────────────────────────────
// Reçoit les feedbacks négatifs des plateformes redirect_filtered.
// Les plateformes "direct" n'arrivent jamais ici.

export const submitFeedback = async (req, res, next) => {
  try {
    const { uid }                   = req.params;
    const { stars, message, email } = req.body;

    const starsNum = parseInt(stars);
    if (!starsNum || starsNum < 1 || starsNum > 5) {
      return res.status(422).json({ success: false, error: "stars doit être entre 1 et 5" });
    }
    if (!message?.trim()) {
      return res.status(422).json({ success: false, error: "message requis" });
    }

    const card = await prisma.nFCCard.findUnique({ where: { uid } });
    if (!card || !card.active) {
      return res.status(404).json({ success: false, error: "Carte introuvable" });
    }

    const lastScan = await prisma.nfcScan.findFirst({
      where: { cardUid: uid }, orderBy: { scannedAt: "desc" }, select: { scanType: true },
    });
    const source = (lastScan?.scanType ?? "qr").toUpperCase();

    const feedback = await prisma.feedback.create({
      data: {
        cardUid: uid, companyId: card.companyId, locationId: card.locationId ?? null,
        stars: starsNum, message: message.trim(), email: email?.trim() ?? null,
        customerName: null, status: "PENDING", source,
      },
    });

    logEvent(uid, card.companyId, "FEEDBACK_SUBMITTED", { stars: starsNum }).catch(console.error);
    sendFeedbackNotification(feedback, card).catch((e) => console.error("[nfc] feedback email:", e.message));

    res.json({ success: true, message: "Merci pour votre retour. Nous allons l'examiner et améliorer notre service." });
  } catch (e) { next(e); }
};

// ─── Email admin ───────────────────────────────────────────────

async function sendFeedbackNotification(feedback, card) {
  try {
    const { sendTemplatedMail } = await import("../../services/client/mail.service.js");
    const ownerLink = await prisma.userCompany.findFirst({
      where: { companyId: card.companyId, isOwner: true }, include: { user: true },
    });
    if (!ownerLink) return;

    await sendTemplatedMail({
      slug: "feedback_received",
      to:   ownerLink.user.email,
      variables: {
        stars: String(feedback.stars), message: feedback.message ?? "Aucun message",
        location: card.locationName ?? "Votre établissement",
        date: new Date().toLocaleDateString("fr-FR"),
      },
      fallbackFn: () => ({
        subject: `Feedback ${feedback.stars}/5 — ${card.locationName ?? ""}`,
        html: `<p>Nouveau feedback <strong>${feedback.stars}/5</strong> pour "${card.locationName ?? "votre établissement"}".</p><p><strong>Message :</strong> ${feedback.message ?? ""}</p><p><em>${new Date().toLocaleDateString("fr-FR")}</em></p>`,
        text: `Feedback ${feedback.stars}/5 : ${feedback.message ?? ""}`,
      }),
    });

    await prisma.feedback.update({ where: { id: feedback.id }, data: { notifiedAt: new Date() } });
  } catch (e) { console.error("[nfc] sendFeedbackNotification:", e.message); }
}