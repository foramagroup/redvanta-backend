// src/controllers/nfc.controller.js — VERSION FINALE v4
// ─────────────────────────────────────────────────────────────
// Support multi-plateformes avec 2 flux :
//
//  ┌─────────────────┬──────────────────┬────────────────────────────────────┐
//  │ Plateforme      │ Comportement     │ Flux                               │
//  ├─────────────────┼──────────────────┼────────────────────────────────────┤
//  │ google          │ redirect_filtered│ Scan → Page → Rating → Redirect/FB │
//  │ tripadvisor     │ redirect_filtered│ Scan → Page → Rating → Redirect/FB │
//  │ booking         │ redirect_filtered│ Scan → Page → Rating → Redirect/FB │
//  │ airbnb          │ redirect_filtered│ Scan → Page → Rating → Redirect/FB │
//  ├─────────────────┼──────────────────┼────────────────────────────────────┤
//  │ facebook        │ direct           │ Scan → Redirect direct (skip page) │
//  │ instagram       │ direct           │ Scan → Redirect direct (skip page) │
//  │ tiktok          │ direct           │ Scan → Redirect direct (skip page) │
//  ├─────────────────┼──────────────────┼────────────────────────────────────┤
//  │ custom          │ selon redirectMode│ "filtered" ou "direct" (Design)    │
//  └─────────────────┴──────────────────┴────────────────────────────────────┘

import prisma from "../../config/database.js";
import crypto  from "crypto";
import { fireAlert }       from "../../services/alertTrigger.service.js";
import { generateAiReply } from "../../services/aiReply.service.js";

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
  return "redirect_filtered"; 
}

function resolveRedirectUrl(platform, card, design, company, location) {
  if (platform === "google") {
    // 1. URL directe (card → location → design → company)
    const url = card.googleReviewUrl
      || location?.googleReviewUrl
      || design?.googleReviewUrl
      || company?.googleReviewUrl
      || null;
    if (url) return url;
    // 2. Fallback : construire depuis googlePlaceId
    const placeId = card.googlePlaceId
      || location?.googlePlaceId
      || design?.googlePlaceId
      || company?.googlePlaceId
      || null;
    if (placeId) return `https://search.google.com/local/writereview?placeid=${placeId}`;
    return null;
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
      // thankYouMessage: company?.thankYouMessage ?? "We value your feedback",
    },
    platform,
    platformLabel:    platformLabel(platform),
    platformBehavior: behavior,
    positiveThreshold: POSITIVE_THRESHOLD,
    googlePlaceId: platform === "google" ? (card.googlePlaceId ?? null) : null,
    active:    card.active,
    scanCount: card.scanCount ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────
// GET /r/:uid — Point d'entrée scan NFC/QR
// ─────────────────────────────────────────────────────────────
// ✅ NOUVEAU : Flux différencié selon la plateforme

export const handleScan = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const scanType = (req.query.type || "qr").toLowerCase();
    const ip = getIp(req);
    const ua = req.headers["user-agent"] || null;
    const deviceType = detectDevice(ua);
    const fingerprint = buildFingerprint(ip, ua);

    // ✅ Récupérer la carte avec le design pour connaître la plateforme
    const card = await prisma.nFCCard.findUnique({
      where: { uid },
      include: {
        company: true,
        location: { select: { googleReviewUrl: true, googlePlaceId: true } },
        design: {
          select: {
            platform: true,
            platformUrl: true,
            googleReviewUrl: true,
            googlePlaceId: true,
            redirectMode: true,
          }
        }
      }
    });

    if (!card) {
      return res.status(404).json({ success: false, error: req.t("nfc.card_not_found"), uid });
    }

    if (!card.active) {
      const platform = await prisma.platformSetting.findFirst({
        select: { companyName: true, companyEmail: true, companyPhone: true, countryCode: true },
      });
      const phone = [platform?.countryCode, platform?.companyPhone].filter(Boolean).join(" ").trim();
      const email = platform?.companyEmail || "";
      const name  = platform?.companyName  || "Opinoor";
      const frontUrl = process.env.URL_PROD_FRONTEND || process.env.URL_DEV_FRONTEND || "http://localhost:3000";
      const qs = new URLSearchParams({ name, ...(phone && { phone }), ...(email && { email }) });
      return res.redirect(302, `${frontUrl}/r/card-not-active?${qs}`);
    }

    // ✅ Tracker le scan (async)
    Promise.all([
      prisma.nfcScan.create({ 
        data: { 
          cardUid: uid, 
          companyId: card.companyId, 
          scanType, 
          ipAddress: ip, 
          userAgent: ua, 
          deviceType 
        } 
      }),
      logEvent(uid, card.companyId, "SCAN", { 
        ipAddress: ip, 
        userAgent: ua, 
        deviceType, 
        referrer: req.headers["referer"] ?? null, 
        fingerprintHash: fingerprint 
      }),
      prisma.nFCCard.update({ 
        where: { uid }, 
        data: { 
          used: true, 
          scanCount: { increment: 1 }, 
          lastScannedAt: new Date() 
        } 
      }),
    ]).catch((e) => console.error("[nfc] scan tracking error:", e.message));

    // ✅ Déterminer le comportement selon la plateforme
    const platform = card.design?.platform ?? "google";
    const redirectMode = card.design?.redirectMode ?? null;
    const behavior = getPlatformBehavior(platform, redirectMode);

    // ─────────────────────────────────────────────────────────
    // ✅ FLUX B : REDIRECT DIRECT (Facebook, Instagram, TikTok)
    // ─────────────────────────────────────────────────────────
    if(behavior === "direct") {
      const redirectUrl = resolveRedirectUrl(platform, card, card.design, card.company, card.location);

        if (!redirectUrl) {
          // Fallback : Si pas d'URL configurée, on redirige vers la page review quand même
          console.warn(`[nfc] Platform ${platform} en mode direct mais pas d'URL configurée → fallback page review`);
          const companySlug = (card.company?.name ?? "review")
            .toLowerCase().trim().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
            return res.redirect(302, `${process.env.URL_PROD_FRONTEND}/review/${companySlug}?uid=${uid}`);
        }
        // ✅ Tracker la redirection directe
        Promise.all([
          logEvent(uid, card.companyId, "PLATFORM_REDIRECT_DIRECT", {
            ipAddress: ip,
            userAgent: ua,
            deviceType,
            referrer: req.headers["referer"] ?? null,
          }),
          prisma.nFCCard.update({ 
            where: { uid }, 
            data: { googleRedirectCount: { increment: 1 } }  // Réutilise le compteur existant
          }),
        ]).catch(console.error);

        console.log(`[nfc] Redirect direct ${platform} → ${redirectUrl}`);
        
        // ✅ Redirection directe vers le réseau social
       return res.redirect(302, redirectUrl);
    }

    // ─────────────────────────────────────────────────────────
    // ✅ FLUX A : PAGE REVIEW (Google, TripAdvisor, Booking, Airbnb)
    // ─────────────────────────────────────────────────────────
    const companySlug = (card.company?.name ?? "review")
      .toLowerCase().trim().replace(/\s+/g, "-").replace(/[^\w-]/g, "");

    return res.redirect(302, `${process.env.URL_PROD_FRONTEND}/review/${companySlug}?uid=${uid}`);

  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// GET /review/:uid
// ─────────────────────────────────────────────────────────────
// ✅ INCHANGÉ (sert uniquement pour redirect_filtered)

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
            redirectMode: true,
          },
        },
      },
    });

    if (!card)        return res.status(404).json({ success: false, error: req.t("nfc.card_not_found") });
    if (!card.active) return res.status(403).json({ success: false, error: req.t("nfc.card_not_active") });

    const company = await prisma.company.findUnique({
      where:  { id: card.companyId },
      select: { name: true, logo: true, primaryColor: true, googleReviewUrl: true },
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
// ✅ Sert uniquement pour redirect_filtered (Google, TripAdvisor, etc.)
// Les plateformes "direct" ne passent jamais par ici

export const submitRating = async (req, res, next) => {
  try {
    const { uid }    = req.params;
    const { stars, comment, email } = req.body;
    const ip         = getIp(req);
    const ua         = req.headers["user-agent"] || null;
    const deviceType = detectDevice(ua);

    const starsNum = parseInt(stars);
    if (!starsNum || starsNum < 1 || starsNum > 5) {
      return res.status(422).json({ success: false, error: req.t("nfc.invalid_stars") });
    }

    const card = await prisma.nFCCard.findUnique({
      where:   { uid },
      include: {
        company:  { select: { googleReviewUrl: true, googlePlaceId: true } },
        location: { select: { googleReviewUrl: true, googlePlaceId: true } },
        design:   { select: { platform: true, platformUrl: true, googleReviewUrl: true, googlePlaceId: true, redirectMode: true } },
      },
    });

    if (!card || !card.active) {
      return res.status(404).json({ success: false, error: req.t("nfc.card_not_found") });
    }

    const platform     = card.design?.platform    ?? "google";
    const redirectMode = card.design?.redirectMode ?? null;
    const behavior     = getPlatformBehavior(platform, redirectMode);
    const redirectUrl  = resolveRedirectUrl(platform, card, card.design, card.company, card.location);

    // Tracker RATING_SELECTED dans tous les cas
    logEvent(uid, card.companyId, "RATING_SELECTED", {
      stars: starsNum, ipAddress: ip, userAgent: ua, deviceType,
      referrer: req.headers["referer"] ?? null,
    }).catch(console.error);

    // Décider du flux (redirect_filtered uniquement)
    const shouldRedirect = (behavior === "redirect_filtered" && starsNum >= POSITIVE_THRESHOLD);

    if (shouldRedirect) {
      if (!redirectUrl) {
        console.warn(`[nfc] No redirectUrl for uid=${uid} platform=${platform}`);
        return res.json({ success: true, action: "INTERNAL_FEEDBACK", message: req.t("nfc.thank_you"), stars: starsNum, uid });
      }

      const lastScanForRating = await prisma.nfcScan.findFirst({
        where: { cardUid: uid }, orderBy: { scannedAt: "desc" }, select: { scanType: true },
      }).catch(() => null);
      const ratingSource = (lastScanForRating?.scanType ?? "qr").toUpperCase();

      // Créer Review + Feedback en parallèle (le Feedback assure la visibilité dans le dashboard admin)
      await Promise.allSettled([
        prisma.review.create({
          data: {
            companyId: card.companyId,
            locationId: card.locationId || null,
            rating: starsNum,
            status: "posted",
            source: platform,
            comment: comment?.trim() || null,
            userName: null,
            email: email?.trim() || null,
            postedAt: new Date(),
          },
        }),
        prisma.feedback.create({
          data: {
            cardUid: uid,
            companyId: card.companyId,
            locationId: card.locationId ?? null,
            stars: starsNum,
            message: comment?.trim() || null,
            email: email?.trim() || null,
            customerName: null,
            status: "PUBLIC",
            source: ratingSource,
          },
        }),
      ]).then(results =>
        results.forEach((r, i) => {
          if (r.status === "rejected")
            console.error(`[nfc] ❌ Failed to create ${i === 0 ? "Review" : "Feedback"}:`, r.reason?.message);
          else if (i === 0)
            console.log(`[nfc] ✅ Review created: ${starsNum}★ (posted) - company=${card.companyId}`);
        })
      );

      fireAlert(
        card.companyId,
        "review",
        "New Public Review",
        `A ${starsNum}-star review was submitted at ${card.locationName ?? card.company?.name ?? "your location"}.`
      ).catch(() => {});

      // Tracker + incrémenter compteur
      Promise.all([
        logEvent(uid, card.companyId, "GOOGLE_REDIRECT", {
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
        ...(platform === "google" && {
          googleReviewUrl: redirectUrl,
          googlePlaceId:   card.googlePlaceId || card.location?.googlePlaceId || card.design?.googlePlaceId || card.company?.googlePlaceId || null,
        }),
        message: req.t("nfc.redirect_message", { platform: platformLabel(platform) }),
        stars:   starsNum,
      });

    } else {
      // redirect_filtered + note négative
      return res.json({
        success:          true,
        action:           "INTERNAL_FEEDBACK",
        platform,
        platformBehavior: behavior,
        message:          req.t("nfc.feedback_appreciated"),
        stars:            starsNum,
        uid,
      });
    }
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// POST /review/:uid/feedback
// ─────────────────────────────────────────────────────────────
// ✅ INCHANGÉ (reçoit uniquement les feedbacks négatifs redirect_filtered)

export const submitFeedback = async (req, res, next) => {
  try {
    const { uid }                   = req.params;
    const { stars, message, email } = req.body;

    const starsNum = parseInt(stars);
    if (!starsNum || starsNum < 1 || starsNum > 5) {
      return res.status(422).json({ success: false, error: req.t("nfc.invalid_stars") });
    }

    const card = await prisma.nFCCard.findUnique({ where: { uid } });
    if (!card || !card.active) {
      return res.status(404).json({ success: false, error: req.t("nfc.card_not_found") });
    }

    const lastScan = await prisma.nfcScan.findFirst({
      where: { cardUid: uid }, orderBy: { scannedAt: "desc" }, select: { scanType: true },
    });
    const source = (lastScan?.scanType ?? "qr").toUpperCase();


    try {
      await prisma.review.create({
        data: {
          companyId: card.companyId,              // ✅ TOUJOURS renseigné
          locationId: card.locationId || null,    // ✅ Nullable
          rating: starsNum,
          status: "pending",
          source: "internal_feedback",
          comment: message.trim(),
          email: email?.trim() || null,
          userName: null,
        },
      });
      console.log(`[nfc] ✅ Review created: ${starsNum}★ (pending) - company=${card.companyId}, location=${card.locationId || 'none'}`);
    } catch (err) {
      console.error(`[nfc] ❌ Failed to create Review:`, err);
    }

    const feedback = await prisma.feedback.create({
      data: {
        cardUid: uid, companyId: card.companyId, locationId: card.locationId ?? null,
        stars: starsNum, message: message.trim(), email: email?.trim() ?? null,
        customerName: null, status: "PENDING", source,
      },
    });

    logEvent(uid, card.companyId, "FEEDBACK_SUBMITTED", { stars: starsNum }).catch(console.error);
    processNegativeFeedback(feedback, card).catch((e) => console.error("[nfc] processNegativeFeedback:", e.message));
    fireAlert(
      card.companyId,
      "negative",
      "Negative Review Alert",
      `A ${starsNum}-star feedback was received at ${card.locationName ?? "your location"}.`
    ).catch(() => {});

    res.json({ success: true, message: req.t("nfc.feedback_submitted") });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// POST /review/:uid/suggest — AI suggestion chips (public)
// ─────────────────────────────────────────────────────────────

const STATIC_SUGGESTIONS = {
  5: ["Amazing experience, highly recommend!"],
  4: ["Great experience overall!"],
  3: ["Decent experience, some room to improve."],
  2: ["Disappointing, expected more."],
  1: ["Very poor experience."],
};

export const getSuggestions = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const starsNum = parseInt(req.body.rating);
    if (!starsNum || starsNum < 1 || starsNum > 5) return res.json({ suggestions: [] });

    // ── 1. Carte + relations complètes ──────────────────────────
    const card = await prisma.nFCCard.findUnique({
      where: { uid },
      include: {
        company:  { select: { id: true, name: true, defaultLanguageId: true } },
        location: { select: { name: true, city: true, country: true, address: true } },
        design:   { select: { platform: true } },
      },
    });
    if (!card || !card.companyId) {
      return res.json({ suggestions: STATIC_SUGGESTIONS[starsNum] ?? [] });
    }

    const companyId  = card.companyId;
    const isPositive = starsNum >= 4;

    // ── 2. Tous les paramètres admin + superadmin en parallèle ──
    const [provider, balance, aiSetting, autoReplySetting, defaultLang] = await Promise.all([
      // Superadmin : provider actif par défaut (modèle, clé API, nom)
      prisma.aiProvider.findFirst({ where: { isDefault: true, active: true } })
        .catch(() => null),
      // Company : crédits disponibles
      prisma.aiCreditBalance.findUnique({ where: { companyId } })
        .catch(() => null),
      // Company : paramètres IA (langue, ton, contexte métier)
      prisma.aiSetting.findUnique({ where: { companyId } })
        .catch(() => null),
      // Company : paramètres auto-reply (langue + ton comme fallback)
      prisma.autoReplySetting.findUnique({ where: { companyId } })
        .catch(() => null),
      // Company : langue par défaut résolue depuis defaultLanguageId
      card.company?.defaultLanguageId
        ? prisma.language.findUnique({
            where:  { id: card.company.defaultLanguageId },
            select: { code: true },
          }).catch(() => null)
        : Promise.resolve(null),
    ]);

    // ── 3. Vérification crédits ─────────────────────────────────
    if (provider?.apiKey && balance) {
      const remaining = Math.max(
        (balance.planIncluded ?? 0) + (balance.purchased ?? 0) - (balance.used ?? 0),
        0
      );
      if (remaining > 0) {
        try {
          const prompt = buildSuggestionPrompt({
            starsNum, isPositive, card,
            aiSetting, autoReplySetting, defaultLang,
            acceptLanguage: req.headers["accept-language"] ?? null,
          });
          const suggs = await callAIForSuggestions(provider, prompt);
          if (Array.isArray(suggs) && suggs.length >= 1) {
            // Tracker la génération + décrémenter les crédits (fire-and-forget)
            // Promise.allSettled : les deux s'exécutent même si l'une échoue
            Promise.allSettled([
              prisma.reviewBoosterEvent.create({
                data: {
                  companyId: card.companyId,
                  nfcCardId: card.id ?? null,
                  locationId: card.locationId ?? null,
                  rating: starsNum,
                  suggestionUsed: false,
                  reviewSubmitted: false,
                },
              }),
              // upsert : crée le record si absent (évite P2025 "record not found")
              prisma.aiCreditBalance.upsert({
                where: { companyId },
                update: { used: { increment: 1 } },
                create: { companyId, planIncluded: 0, purchased: 0, used: 1 },
              }),
            ]).then(results =>
              results.forEach(r => {
                if (r.status === "rejected")
                  console.warn("[suggest] tracking error:", r.reason?.message);
              })
            );
            return res.json({ suggestions: suggs.slice(0, 1) });
          }
        } catch (e) {
          console.warn("[suggest] AI call failed:", e.message);
        }
      }
    }

    res.json({ suggestions: STATIC_SUGGESTIONS[starsNum] ?? [] });
  } catch (e) { next(e); }
};

// ── Résolution de la langue (toutes couches, priorité décroissante) ──────────
function resolveLanguageFull({ aiSetting, autoReplySetting, defaultLang, acceptLanguage }) {
  // 1. AiSetting.language défini explicitement (admin IA)
  if (aiSetting?.language && aiSetting.language !== "auto") return aiSetting.language;
  // 2. AutoReplySetting.language (admin auto-reply)
  if (autoReplySetting?.language) return autoReplySetting.language;
  // 3. Company.defaultLanguageId → code ISO
  if (defaultLang?.code) return defaultLang.code;
  // 4. Accept-Language du navigateur du client (auto-detect)
  if (acceptLanguage) {
    const first = acceptLanguage.split(",")[0]?.trim().split(";")[0]?.trim().toLowerCase().split("-")[0];
    if (first && /^[a-z]{2}$/.test(first)) return first;
  }
  return "en";
}

// ── Construction du prompt complet ──────────────────────────────────────────
function buildSuggestionPrompt({ starsNum, isPositive, card, aiSetting, autoReplySetting, defaultLang, acceptLanguage }) {
  // Ton : AiSetting → AutoReplySetting → défaut
  const tone = aiSetting?.tone ?? autoReplySetting?.tone ?? "professional";

  // Langue : toutes les couches
  const language = resolveLanguageFull({ aiSetting, autoReplySetting, defaultLang, acceptLanguage });

  // Contexte métier : AiSetting.businessContext → Location → Card → Company
  const locationDetail = [card.location?.city, card.location?.country]
    .filter(Boolean).join(", ");
  const ctx = aiSetting?.businessContext?.trim()
    || (card.location?.name
        ? `${card.location.name}${locationDetail ? ` — ${locationDetail}` : ""}`
        : null)
    || card.locationName
    || card.company?.name
    || "the business";

  // Plateforme cible (Google, TripAdvisor, Booking…)
  const PLATFORM_LABELS = {
    google: "Google Reviews", tripadvisor: "TripAdvisor",
    booking: "Booking.com", airbnb: "Airbnb", custom: "the review platform",
  };
  const platform = card.design?.platform ?? "google";
  const platformLabel = PLATFORM_LABELS[platform] ?? "the review platform";

  // Description de la note
  const ratingDesc = ["", "terrible (1★)", "poor (2★)", "average (3★)", "good (4★)", "excellent (5★)"][starsNum];
  const sentiment  = isPositive ? "positive" : "negative";

  // Instruction de langue
  const langInstruction = language === "en"
    ? "Write in English."
    : `Write in the language with ISO 639-1 code "${language}".`;

  return [
    `You are helping a customer write a short ${platformLabel} review.`,
    `Business: "${ctx}".`,
    `Rating given: ${ratingDesc} — ${sentiment} experience.`,
    `Tone required: ${tone}.`,
    langInstruction,
    `Generate exactly 1 short review starter the customer can use or adapt (max 8 words).`,
    `It should sound natural, authentic, and match the rating.`,
    `Return ONLY a valid JSON array of 1 string — no explanation, no markdown.`,
    `Example: ["Great service!"]`,
  ].join(" ");
}

async function callAIForSuggestions(provider, prompt) {
  const signal = AbortSignal.timeout(5000);

  if (provider.name === "openai") {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: provider.model ?? "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 40, temperature: 0.7,
      }),
      signal,
    });
    if (!r.ok) throw new Error(`OpenAI ${r.status}`);
    const d = await r.json();
    return JSON.parse(d.choices[0].message.content.trim());
  }

  if (provider.name === "anthropic") {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": provider.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: provider.model ?? "claude-haiku-4-5-20251001",
        max_tokens: 40,
        messages: [{ role: "user", content: prompt }],
      }),
      signal,
    });
    if (!r.ok) throw new Error(`Anthropic ${r.status}`);
    const d = await r.json();
    return JSON.parse(d.content[0].text.trim());
  }

  if (provider.name === "google") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${provider.model ?? "gemini-2.0-flash"}:generateContent?key=${provider.apiKey}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 40, temperature: 0.7 },
      }),
      signal,
    });
    if (!r.ok) throw new Error(`Google ${r.status}`);
    const d = await r.json();
    return JSON.parse(d.candidates[0].content.parts[0].text.trim());
  }

  throw new Error("Unknown provider");
}

// ─── Génération IA + Email admin ──────────────────────────────
// Appelé en fire-and-forget depuis submitFeedback.
// 1. Génère une réponse IA si le client a laissé un message
// 2. Sauvegarde la suggestion dans aiSuggestedReply
// 3. Envoie l'email de notification à l'admin (avec la réponse IA si dispo)
async function processNegativeFeedback(feedback, card) {
  let aiReply = null;

  if (feedback.message?.trim()) {
    try {
      const settings = await prisma.autoReplySetting.findUnique({
        where: { companyId: card.companyId },
      }).catch(() => null);

      aiReply = await generateAiReply({
        review: {
          rating:     feedback.stars,
          comment:    feedback.message,
          authorName: feedback.customerName ?? null,
        },
        tone:     settings?.tone     ?? "professional",
        language: settings?.language ?? "auto",
      });

      await prisma.feedback.update({
        where: { id: feedback.id },
        data:  { aiSuggestedReply: aiReply },
      });
      console.log(`[nfc] ✅ AI reply generated for feedback ${feedback.id}`);
    } catch (e) {
      console.warn(`[nfc] AI reply skipped for feedback ${feedback.id}:`, e.message);
    }
  }

  await sendFeedbackNotification(feedback, card, aiReply);
}

async function sendFeedbackNotification(feedback, card, aiReply = null) {
  try {
    const { sendTemplatedMail, resolveCompanyLangId } = await import("../../services/client/mail.service.js");
    const ownerLink = await prisma.userCompany.findFirst({
      where: { companyId: card.companyId, isOwner: true }, include: { user: true },
    });
    if (!ownerLink) return;

    const langId = await resolveCompanyLangId(card.companyId);

    const aiBlock = aiReply
      ? `<div style="margin-top:16px;padding:12px;background:#f0fdf4;border-left:4px solid #22c55e;border-radius:4px">
           <p style="margin:0 0 6px;font-size:12px;color:#16a34a;font-weight:600">✨ Réponse suggérée par l'IA :</p>
           <p style="margin:0;color:#166534">${aiReply}</p>
         </div>`
      : "";

    await sendTemplatedMail({
      slug: "feedback_received",
      to:   ownerLink.user.email,
      langId,
      variables: {
        stars:               String(feedback.stars),
        message:             feedback.message ?? "Aucun message",
        location:            card.locationName ?? "Votre établissement",
        date:                new Date().toLocaleDateString("fr-FR"),
        ai_suggested_reply:  aiReply ?? "",
      },
      fallbackFn: () => ({
        subject: `⭐ Feedback ${feedback.stars}/5 — ${card.locationName ?? ""}`,
        html: `<p>Nouveau feedback <strong>${feedback.stars}/5</strong> pour "${card.locationName ?? "votre établissement"}".</p>
               <p><strong>Message :</strong> ${feedback.message ?? ""}</p>
               ${aiBlock}
               <p><em>${new Date().toLocaleDateString("fr-FR")}</em></p>
               <p style="margin-top:16px"><a href="${process.env.FRONT_URL}/dashboard/reviews" style="color:#E10600">Consulter dans le dashboard →</a></p>`,
        text: `Feedback ${feedback.stars}/5 : ${feedback.message ?? ""}${aiReply ? `\n\nRéponse IA proposée :\n${aiReply}` : ""}\n\nConsulter : ${process.env.FRONT_URL}/dashboard/reviews`,
      }),
    });

    await prisma.feedback.update({ where: { id: feedback.id }, data: { notifiedAt: new Date() } });
  } catch (e) { console.error("[nfc] sendFeedbackNotification:", e.message); }
}