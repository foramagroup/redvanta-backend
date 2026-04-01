// src/controllers/nfc.controller.js — v3
// Même flux B du scénario, mis à jour pour NFCCard (au lieu de nfctag)

import prisma  from "../config/database.js";
import { formatNfcCard} from "../services/nfc.service.js";

// ─────────────────────────────────────────────────────────────
// CLIENT (admin_token)
// ─────────────────────────────────────────────────────────────

export const getMyCards = async (req, res, next) => {
  try {
    const companyId = parseInt(req.user.companyId);
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const where = { companyId, ...(req.query.status && { status: req.query.status }) };

    const [cards, total] = await Promise.all([
      prisma.nFCCard.findMany({ where, include: { tag: true, company: { select: { name: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.nFCCard.count({ where }),
    ]);

    res.json({ success: true, data: cards.map(formatNfcCard), meta: { total, page, last_page: Math.ceil(total / limit) } });
  } catch (e) { next(e); }
};

export const getMyNfcStats = async (req, res, next) => {
  try {
    const companyId = parseInt(req.user.companyId);
    const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [total, active, scans, monthScans, redirects, feedbacks] = await Promise.all([
      prisma.nFCCard.count({ where: { companyId } }),
      prisma.nFCCard.count({ where: { companyId, active: true } }),
      prisma.nFCCard.aggregate({ where: { companyId }, _sum: { scanCount: true } }),
      prisma.analyticsEvent.count({ where: { companyId, type: "SCAN", occurredAt: { gte: thisMonth } } }),
      prisma.nFCCard.aggregate({ where: { companyId }, _sum: { googleRedirectCount: true } }),
      prisma.feedback.count({ where: { companyId } }),
    ]);

    const totalScans = scans._sum.scanCount ?? 0;
    const totalRedirects = redirects._sum.googleRedirectCount ?? 0;
    res.json({ success: true, data: { totalCards: total, activeCards: active, pendingCards: total - active, totalScans, thisMonthScans: monthScans, googleRedirects: totalRedirects, feedbacks, conversionRate: totalScans > 0 ? `${Math.round((totalRedirects / totalScans) * 100)}%` : "0%" } });
  } catch (e) { next(e); }
};

export const getMyFeedbacks = async (req, res, next) => {
  try {
    const companyId = parseInt(req.user.companyId);
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const [feedbacks, total] = await Promise.all([
      prisma.feedback.findMany({ where: { companyId }, include: { location: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.feedback.count({ where: { companyId } }),
    ]);
    res.json({ success: true, data: feedbacks, meta: { total, page } });
  } catch (e) { next(e); }
};



