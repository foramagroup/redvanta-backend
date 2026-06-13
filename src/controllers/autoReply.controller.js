import prisma from "../config/database.js";
import { getValidToken } from "./googleLocations.controller.js";
import { generateAiReply } from "../services/aiReply.service.js";

// Safety scoring
const DANGER_RX = /\b(sue|lawsuit|lawyer|legal action|defamation|discrimination|illegal|report you|authorities)\b/i;
const LEGAL_RX = /\b(guarantee|warranty|100%|no questions asked|always|never|best in the world)\b/i;
const TOXICITY_RX = /\b(idiot|moron|stupid|hate|despise|shut up|go away)\b/i;

function scoreReply(text) {
  if (!text) return 0;
  let score = 100;
  if (TOXICITY_RX.test(text)) score -= 40;
  if (DANGER_RX.test(text)) score -= 30;
  if (LEGAL_RX.test(text)) score -= 10;
  if (text.length > 500) score -= 5;
  if (text.length < 20) score -= 15;
  return Math.max(0, score);
}

// GET /api/admin/ai/auto-reply/settings
export async function getSettings(req, res) {
  const companyId = req.user.companyId;
  try {
    const settings = await prisma.autoReplySetting.findUnique({ where: { companyId } });
    if (!settings) {
      return res.json({
        mode: "off",
        minRating: 3,
        tone: "professional",
        language: "en",
        safetyThreshold: 80,
      });
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PUT /api/admin/ai/auto-reply/settings
export async function saveSettings(req, res) {
  const companyId = req.user.companyId;
  const { mode, minRating, tone, language, safetyThreshold } = req.body;

  try {
    const settings = await prisma.autoReplySetting.upsert({
      where: { companyId },
      create: { companyId, mode, minRating, tone, language, safetyThreshold },
      update: { mode, minRating, tone, language, safetyThreshold },
    });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/ai/auto-reply/history
export async function getHistory(req, res) {
  const companyId = req.user.companyId;
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(Number(req.query.limit ?? 20), 100);
  const status = req.query.status;

  try {
    const where = { companyId, ...(status ? { status } : {}) };
    const [logs, total] = await Promise.all([
      prisma.aiAutoReplyLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.aiAutoReplyLog.count({ where }),
    ]);
    res.json({ logs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/ai/auto-reply/process  (internal/cron use)
export async function processReply(req, res) {
  const companyId = req.user.companyId;
  const { reviewId } = req.body;

  try {
    const settings = await prisma.autoReplySetting.findUnique({ where: { companyId } });
    if (!settings || settings.mode === "off") {
      return res.status(400).json({ error: "Auto reply is off" });
    }

    const review = await prisma.review.findFirst({ where: { id: reviewId, companyId } });
    if (!review) return res.status(404).json({ error: "Review not found" });
    if (review.rating < settings.minRating) {
      return res.json({ skipped: true, reason: "rating_below_threshold" });
    }

    const reply = await generateAiReply({ review, tone: settings.tone, language: settings.language });
    const safetyScore = scoreReply(reply);

    const blocked = safetyScore < (settings.safetyThreshold ?? 80) || review.rating <= 2;
    const status = blocked ? "blocked" : settings.mode === "publish" ? "published" : "suggested";

    const log = await prisma.aiAutoReplyLog.create({
      data: {
        companyId,
        reviewId: review.id,
        googleReviewId: review.googleReviewId,
        reviewText: review.comment,
        reply,
        safetyScore,
        status,
        publishedAt: status === "published" ? new Date() : null,
      },
    });

    if (status === "published" && review.googleReviewId) {
      try {
        const token = await getValidToken(companyId);
        const loc = await prisma.googleBusinessLocation.findFirst({ where: { companyId, connected: true, primary: true } });
        if (loc) {
          await fetch(`https://mybusiness.googleapis.com/v4/${loc.locationId}/reviews/${review.googleReviewId}/reply`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ comment: reply }),
          });
        }
      } catch (e) {
        await prisma.aiAutoReplyLog.update({ where: { id: log.id }, data: { status: "failed", errorMessage: e.message } });
      }
    }

    res.json({ ok: true, status, safetyScore, reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
