
import prisma  from "../../config/database.js";
import crypto  from "crypto";

// ─── Helpers ──────────────────────────────────────────────────
const detectDevice = (ua = "") => {
  const s = ua.toLowerCase();
  if (/tablet|ipad/.test(s))           return "tablet";
  if (/mobile|android|iphone|ipod/.test(s)) return "mobile";
  return "desktop";
};

const getIp = (req) => req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
const fingerprint = (ip, ua) =>
  crypto.createHash("sha256").update(`${ip}|${ua ?? ""}`).digest("hex").slice(0, 16);

async function logEvent(cardUid, companyId, type, extras = {}) {
  try {
    await prisma.analyticsEvent.create({ data: { cardUid, companyId, type, ...extras } });
  } catch (e) { console.error("[nfc] logEvent error:", e.message); }
}


// GET /r/:uid
export const handleScan = async (req, res, next) => {
  try {
    const { uid }    = req.params;
    const scanType   = req.query.type || "qr";
    const ip         = getIp(req);
    const ua         = req.headers["user-agent"] || null;
    const deviceType = detectDevice(ua);

    const card = await prisma.nFCCard.findUnique({ where: { uid } });
    if (!card) return res.status(404).json({ success: false, error: "Carte introuvable", uid });

    if (!card.active) {
      return res.json({
        success: false,
        error:   "Cette carte n'est pas encore active. Elle sera activée après livraison.",
        status:  card.status,
      });
    }

    // Enregistrer scan (asynchrone)
    Promise.all([
      prisma.nfcScan.create({ data: { cardUid: uid, companyId: card.companyId, scanType, ipAddress: ip, userAgent: ua, deviceType } }),
      logEvent(uid, card.companyId, "SCAN", { ipAddress: ip, userAgent: ua, deviceType, fingerprintHash: fingerprint(ip, ua) }),
      prisma.nFCCard.update({ where: { uid }, data: { used: true, scanCount: { increment: 1 }, lastScannedAt: new Date() } }),
    ]).catch((e) => console.error("[nfc] scan tracking error:", e.message));

    res.json({
      success: true, uid,
      locationName:    card.locationName    ?? null,
      locationAddress: card.locationAddress ?? null,
      googlePlaceId:   card.googlePlaceId   ?? null,
    });
  } catch (e) { next(e); }
};

// GET /review/:uid
export const getReviewPage = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const ip = getIp(req); const ua = req.headers["user-agent"] || null;
    const card = await prisma.nFCCard.findUnique({ where: { uid } });
    if (!card || !card.active) return res.status(404).json({ success: false, error: "Carte inactive ou introuvable" });

    logEvent(uid, card.companyId, "PAGE_VIEW", { ipAddress: ip, userAgent: ua, deviceType: detectDevice(ua) }).catch(console.error);

    const company = await prisma.company.findUnique({ where: { id: card.companyId }, select: { name: true, primaryColor: true, logo: true } });
    res.json({ success: true, uid, locationName: card.locationName ?? null, locationAddress: card.locationAddress ?? null, company: { name: company?.name ?? null, primaryColor: company?.primaryColor ?? "#E10600", logo: company?.logo ?? null } });
  } catch (e) { next(e); }
};

// POST /review/:uid/rate
export const submitRating = async (req, res, next) => {
  try {
    const { uid }  = req.params;
    const { stars } = req.body;
    const ip = getIp(req); const ua = req.headers["user-agent"] || null;

    if (!stars || stars < 1 || stars > 5) return res.status(422).json({ success: false, error: "stars doit être entre 1 et 5" });

    const card = await prisma.nFCCard.findUnique({ where: { uid } });
    if (!card || !card.active) return res.status(404).json({ success: false, error: "Carte introuvable ou inactive" });

    logEvent(uid, card.companyId, "RATING_SELECTED", { stars, ipAddress: ip, userAgent: ua, deviceType: detectDevice(ua) }).catch(console.error);

    if (stars >= 4) {
      // Positif → Google
      await Promise.all([
        logEvent(uid, card.companyId, "GOOGLE_REDIRECT", { stars, ipAddress: ip, userAgent: ua }),
        prisma.nFCCard.update({ where: { uid }, data: { googleRedirectCount: { increment: 1 } } }),
      ]).catch(console.error);

      return res.json({ success: true, action: "GOOGLE_REDIRECT", googleReviewUrl: card.googleReviewUrl, message: "Merci ! Vous allez être redirigé vers Google." });
    } else {
      // Négatif → formulaire interne
      return res.json({ success: true, action: "INTERNAL_FEEDBACK", internalFeedbackUrl: `${process.env.FRONTEND_URL}/feedback/${uid}`, stars });
    }
  } catch (e) { next(e); }
};

// POST /review/:uid/feedback
export const submitFeedback = async (req, res, next) => {
  try {
    const { uid }                   = req.params;
    const { stars, message, email } = req.body;
    if (!stars || stars < 1 || stars > 3) return res.status(422).json({ success: false, error: "stars doit être entre 1 et 3" });

    const card = await prisma.nFCCard.findUnique({ where: { uid } });
    if (!card || !card.active) return res.status(404).json({ success: false, error: "Carte introuvable" });

    const feedback = await prisma.feedback.create({ data: { cardUid: uid, companyId: card.companyId, locationId: card.locationId ?? null, stars, message: message?.trim() ?? null, email: email?.trim() ?? null } });
    logEvent(uid, card.companyId, "FEEDBACK_SUBMITTED", { stars }).catch(console.error);
    sendFeedbackNotification(feedback, card).catch((e) => console.error("[nfc] feedback email:", e.message));

    res.json({ success: true, message: "Merci pour votre retour. Nous allons améliorer notre service." });
  } catch (e) { next(e); }
};

async function sendFeedbackNotification(feedback, card) {
  try {
    const { sendTemplatedMail } = await import("../../services/client/mail.service.js");
    const ownerLink = await prisma.userCompany.findFirst({ where: { companyId: card.companyId, isOwner: true }, include: { user: true } });
    if (!ownerLink) return;
    await sendTemplatedMail({ slug: "feedback_received", to: ownerLink.user.email, variables: { stars: String(feedback.stars), message: feedback.message ?? "Aucun message", location: card.locationName ?? "Votre établissement", date: new Date().toLocaleDateString("fr-FR") }, fallbackFn: () => ({ subject: `⭐ Feedback ${feedback.stars}/5 — ${card.locationName ?? ""}`, html: `<p>Feedback <strong>${feedback.stars}/5</strong> pour "${card.locationName ?? ""}".</p><p>${feedback.message ?? ""}</p>`, text: `Feedback ${feedback.stars}/5 : ${feedback.message ?? ""}` }) });
    await prisma.feedback.update({ where: { id: feedback.id }, data: { notifiedAt: new Date() } });
  } catch (e) { console.error("[nfc] sendFeedbackNotification:", e.message); }
}