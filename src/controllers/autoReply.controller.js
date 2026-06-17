import prisma from "../config/database.js";
import { getValidToken } from "./googleLocations.controller.js";
import { generateAiReply } from "../services/aiReply.service.js";
import { sendTemplatedMail, resolveCompanyLangId } from "../services/client/mail.service.js";

// Safety scoring
const DANGER_RX   = /\b(sue|lawsuit|lawyer|legal action|defamation|discrimination|illegal|report you|authorities)\b/i;
const LEGAL_RX    = /\b(guarantee|warranty|100%|no questions asked|always|never|best in the world)\b/i;
const TOXICITY_RX = /\b(idiot|moron|stupid|hate|despise|shut up|go away)\b/i;

function scoreReply(text) {
  if (!text) return 0;
  let score = 100;
  if (TOXICITY_RX.test(text)) score -= 40;
  if (DANGER_RX.test(text))   score -= 30;
  if (LEGAL_RX.test(text))    score -= 10;
  if (text.length > 500)      score -= 5;
  if (text.length < 20)       score -= 15;
  return Math.max(0, score);
}

async function postToGoogle(companyId, googleReviewId, replyText) {
  const token = await getValidToken(companyId);
  const loc = await prisma.googleBusinessLocation.findFirst({
    where: { companyId, connected: true, primary: true },
  });
  if (!loc) throw new Error("No connected primary Google location");

  const gRes = await fetch(
    `https://mybusiness.googleapis.com/v4/${loc.locationId}/reviews/${googleReviewId}/reply`,
    {
      method:  "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ comment: replyText }),
    }
  );
  if (!gRes.ok) {
    const body = await gRes.text();
    throw new Error(`Google API ${gRes.status}: ${body}`);
  }
}

async function notifyAdminBySuggestion(companyId, review, reply) {
  const [ownerLink, company, langId] = await Promise.all([
    prisma.userCompany.findFirst({ where: { companyId, isOwner: true }, include: { user: true } }),
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }),
    resolveCompanyLangId(companyId),
  ]);
  if (!ownerLink) return;
  await sendTemplatedMail({
    slug:      "ai_reply_suggestion",
    variables: {
      admin_name:    ownerLink.user.firstName || ownerLink.user.email,
      company_name:  company?.name ?? "",
      reviewer_name: review.authorName || "Anonymous",
      review_rating: review.rating,
      review_text:   review.comment || "",
      reply_draft:   reply,
      dashboard_url: `${process.env.FRONT_URL}/admin/settings/auto-reply`,
    },
    to:     ownerLink.user.email,
    langId,
  });
}

// ── Shared core logic (used by HTTP handler + cron) ──────────────────────────
export async function processReplyInternal(companyId, review) {
  const settings = await prisma.autoReplySetting.findUnique({ where: { companyId } });
  if (!settings || settings.mode === "off") return { skipped: true, reason: "mode_off" };
  if (review.rating < settings.minRating)   return { skipped: true, reason: "rating_below_threshold" };

  const reply       = await generateAiReply({ review, tone: settings.tone, language: settings.language });
  const safetyScore = scoreReply(reply);
  const blocked     = safetyScore < (settings.safetyThreshold ?? 80) || review.rating <= 2;

  let status;
  if (blocked) {
    status = "blocked";
  } else if (settings.mode === "publish") {
    status = "published";
  } else if (settings.mode === "hybrid") {
    const threshold = settings.publishThreshold ?? 5;
    status = review.rating >= threshold ? "published" : "suggested";
  } else {
    // mode === "suggest"
    status = "suggested";
  }

  const log = await prisma.aiAutoReplyLog.create({
    data: {
      companyId,
      reviewId:      review.id,
      googleReviewId: review.googleReviewId,
      reviewText:    review.comment,
      reply,
      safetyScore,
      status,
      publishedAt: status === "published" ? new Date() : null,
    },
  });

  if (status === "published" && review.googleReviewId) {
    try {
      await postToGoogle(companyId, review.googleReviewId, reply);
    } catch (e) {
      await prisma.aiAutoReplyLog.update({
        where: { id: log.id },
        data:  { status: "failed", errorMessage: e.message },
      });
      return { ok: true, status: "failed", safetyScore, reply, logId: log.id };
    }
  }

  if (status === "suggested") {
    notifyAdminBySuggestion(companyId, review, reply).catch((e) =>
      console.warn("[autoReply] email notification failed:", e.message)
    );
  }

  return { ok: true, status, safetyScore, reply, logId: log.id };
}

async function getCompanyPlanSlug(cid) {
  const company = await prisma.company.findUnique({
    where:  { id: cid },
    select: { package: { select: { slug: true } } },
  });
  return company?.package?.slug ?? "starter";
}

// ── GET /api/admin/ai/auto-reply/settings ────────────────────────────────────
export async function getSettings(req, res) {
  const companyId = req.user.companyId;
  try {
    const [settings, planSlug] = await Promise.all([
      prisma.autoReplySetting.findUnique({ where: { companyId } }),
      getCompanyPlanSlug(companyId),
    ]);
    const defaults = { mode: "off", minRating: 3, tone: "professional", language: "en", safetyThreshold: 80, publishThreshold: 5 };
    res.json({ ...(settings ?? defaults), planSlug });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── PUT /api/admin/ai/auto-reply/settings ────────────────────────────────────
export async function saveSettings(req, res) {
  const companyId = req.user.companyId;
  const { mode, minRating, tone, language, safetyThreshold, publishThreshold } = req.body;

  try {
    const settings = await prisma.autoReplySetting.upsert({
      where:  { companyId },
      create: { companyId, mode, minRating, tone, language, safetyThreshold, publishThreshold: publishThreshold ?? 5 },
      update: { mode, minRating, tone, language, safetyThreshold, ...(publishThreshold != null ? { publishThreshold } : {}) },
    });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── GET /api/admin/ai/auto-reply/history ─────────────────────────────────────
export async function getHistory(req, res) {
  const companyId = req.user.companyId;
  const page  = Math.max(1, Number(req.query.page  ?? 1));
  const limit = Math.min(Number(req.query.limit ?? 20), 100);
  const status = req.query.status;

  try {
    const where = { companyId, ...(status ? { status } : {}) };
    const [logs, total] = await Promise.all([
      prisma.aiAutoReplyLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      prisma.aiAutoReplyLog.count({ where }),
    ]);
    res.json({ logs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── POST /api/admin/ai/auto-reply/process  (manual / internal) ───────────────
export async function processReply(req, res) {
  const companyId = req.user.companyId;
  const { reviewId } = req.body;

  try {
    const review = await prisma.review.findFirst({ where: { id: reviewId, companyId } });
    if (!review) return res.status(404).json({ error: "Review not found" });

    const result = await processReplyInternal(companyId, review);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── POST /api/admin/ai/auto-reply/:id/publish ────────────────────────────────
// Publie manuellement une réponse "suggested" ou retente une "failed"
export async function publishReply(req, res) {
  const companyId = req.user.companyId;
  const logId     = parseInt(req.params.id);

  try {
    const log = await prisma.aiAutoReplyLog.findFirst({ where: { id: logId, companyId } });
    if (!log) return res.status(404).json({ error: "Log not found" });
    if (log.status === "published") return res.status(409).json({ error: "Already published" });
    if (log.status === "blocked")   return res.status(422).json({ error: "Cannot publish a blocked reply" });

    const review = await prisma.review.findFirst({ where: { id: log.reviewId, companyId } });
    if (!review?.googleReviewId) {
      return res.status(422).json({ error: "No Google review ID — cannot publish" });
    }

    try {
      await postToGoogle(companyId, review.googleReviewId, log.reply);
    } catch (e) {
      await prisma.aiAutoReplyLog.update({
        where: { id: logId },
        data:  { status: "failed", errorMessage: e.message },
      });
      return res.status(502).json({ error: "Google API error", detail: e.message });
    }

    await prisma.aiAutoReplyLog.update({
      where: { id: logId },
      data:  { status: "published", publishedAt: new Date(), errorMessage: null },
    });

    res.json({ ok: true, message: "Reply published successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
