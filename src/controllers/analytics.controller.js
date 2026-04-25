// src/controllers/client/Analytics.controller.js
// ─────────────────────────────────────────────────────────────
// Endpoints pour la vue Analytics (admin)
//
//   GET /analytics?range=7d|30d|6m|1y&locationId=
//       → tout en un appel : KPIs, chart, rating dist., funnel, locations
//
//   GET /analytics/export?range=
//       → CSV download des données du chart
//
// Sources de données (modèles existants, aucun ajout schema) :
//   - Review          → notes, ratings  (via Location.companyId)
//   - AnalyticsEvent  → SCAN, PAGE_VIEW (companyId direct)
//   - Feedback        → avis négatifs   (companyId direct)
//   - NfcScan         → scans physiques (companyId direct)
//   - Location        → comparatif par établissement
// ─────────────────────────────────────────────────────────────

import prisma from "../config/database.js";
import { Prisma } from "@prisma/client";

function getCompanyId(req) {
  const id = req.user?.companyId;
  if (!id) throw Object.assign(new Error("Aucune company active"), { status: 403 });
  return parseInt(id);
}

// ─── Plages de dates ──────────────────────────────────────────

function getDateBounds(range) {
  const now = new Date();
  const from = new Date();
  switch (range) {
    case "7d":  from.setDate(now.getDate() - 7);           break;
    case "30d": from.setDate(now.getDate() - 30);          break;
    case "6m":  from.setMonth(now.getMonth() - 6);         break;
    case "1y":  from.setFullYear(now.getFullYear() - 1);   break;
    default:    from.setMonth(now.getMonth() - 6);
  }
  return { from, to: now };
}

// Période précédente (même durée) — pour calculer les deltas KPI
function getPreviousBounds(range) {
  const { from: curFrom, to: curTo } = getDateBounds(range);
  const duration = curTo.getTime() - curFrom.getTime();
  return {
    from: new Date(curFrom.getTime() - duration),
    to:   curFrom,
  };
}

// Format MySQL pour les requêtes raw
function toMysql(d) {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

// ─── Groupement chart selon la plage ─────────────────────────
// Retourne la colonne MySQL de groupement + le label lisible
function getGroupFormat(range) {
  switch (range) {
    case "7d":  return { expr: "DATE(r.createdAt)",                       label: "DAYNAME(r.createdAt)",                                   type: "day"   };
    case "30d": return { expr: "YEARWEEK(r.createdAt, 1)",               label: "CONCAT('Week ', WEEK(r.createdAt, 1) - WEEK(DATE_SUB(r.createdAt, INTERVAL DAYOFMONTH(r.createdAt)-1 DAY), 1) + 1)", type: "week" };
    case "6m":
    case "1y":  return { expr: "DATE_FORMAT(r.createdAt, '%Y-%m')",      label: "DATE_FORMAT(r.createdAt, '%b')",                          type: "month" };
    default:    return { expr: "DATE_FORMAT(r.createdAt, '%Y-%m')",      label: "DATE_FORMAT(r.createdAt, '%b')",                          type: "month" };
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/client/shop/analytics
// Query : range (7d|30d|6m|1y), locationId (optional)
// ─────────────────────────────────────────────────────────────
export const getAnalytics = async (req, res, next) => {
  try {
    const companyId   = getCompanyId(req);
    const range       = ["7d", "30d", "6m", "1y"].includes(req.query.range) ? req.query.range : "6m";
    const locationId  = req.query.locationId ? parseInt(req.query.locationId) : null;

    const { from, to }      = getDateBounds(range);
    const { from: pFrom, to: pTo } = getPreviousBounds(range);

    const fromStr  = toMysql(from);
    const toStr    = toMysql(to);
    const pFromStr = toMysql(pFrom);
    const pToStr   = toMysql(pTo);

    // Filtre location optionnel pour les reviews (joins via locations table)
    const locationFilter = locationId ? Prisma.sql`AND l.id = ${locationId}` : Prisma.sql``;

    // ──────────────────────────────────────────────────────────
    // 1. KPIs — période courante
    // ──────────────────────────────────────────────────────────
    const [kpiCur] = await prisma.$queryRaw`
      SELECT
        COUNT(*)                                                    AS totalReviews,
        ROUND(AVG(r.rating), 1)                                    AS avgRating,
        SUM(CASE WHEN r.rating <= 3 THEN 1 ELSE 0 END)            AS negativeCount,
        SUM(CASE WHEN r.status = 'posted' THEN 1 ELSE 0 END)      AS postedCount
      FROM reviews r
      JOIN locations l ON r.locationId = l.id
      WHERE l.companyId = ${companyId}
        AND r.createdAt BETWEEN ${fromStr} AND ${toStr}
        ${locationFilter}
    `;

    // KPIs — période précédente (pour les deltas)
    const [kpiPrev] = await prisma.$queryRaw`
      SELECT
        COUNT(*)                                                    AS totalReviews,
        ROUND(AVG(r.rating), 1)                                    AS avgRating,
        SUM(CASE WHEN r.rating <= 3 THEN 1 ELSE 0 END)            AS negativeCount
      FROM reviews r
      JOIN locations l ON r.locationId = l.id
      WHERE l.companyId = ${companyId}
        AND r.createdAt BETWEEN ${pFromStr} AND ${pToStr}
        ${locationFilter}
    `;

    // Scans (AnalyticsEvent SCAN) — pour le taux de conversion
    const [scanCur] = await prisma.$queryRaw`
      SELECT COUNT(*) AS scans
      FROM analytics_events
      WHERE companyId = ${companyId}
        AND type = 'SCAN'
        AND occurredAt BETWEEN ${fromStr} AND ${toStr}
        ${locationId ? Prisma.sql`` : Prisma.sql``}
    `;
    const [scanPrev] = await prisma.$queryRaw`
      SELECT COUNT(*) AS scans
      FROM analytics_events
      WHERE companyId = ${companyId}
        AND type = 'SCAN'
        AND occurredAt BETWEEN ${pFromStr} AND ${pToStr}
    `;

    const totalCur  = Number(kpiCur.totalReviews)  || 0;
    const totalPrev = Number(kpiPrev.totalReviews) || 0;

    const scansCur  = Number(scanCur.scans)  || 1; // éviter /0
    const scansPrev = Number(scanPrev.scans) || 1;

    const convCur   = Math.round((totalCur  / scansCur)  * 100);
    const convPrev  = Math.round((totalPrev / scansPrev) * 100);

    const negCur    = totalCur  ? Math.round((Number(kpiCur.negativeCount)  / totalCur)  * 100) : 0;
    const negPrev   = totalPrev ? Math.round((Number(kpiPrev.negativeCount) / totalPrev) * 100) : 0;

    const kpis = {
      totalReviews:       totalCur,
      totalReviewsChange: totalCur - totalPrev,
      avgRating:          Number(kpiCur.avgRating)  || 0,
      avgRatingChange:    parseFloat(((Number(kpiCur.avgRating) || 0) - (Number(kpiPrev.avgRating) || 0)).toFixed(1)),
      conversionRate:     convCur,
      conversionRateChange: convCur - convPrev,
      negativeRate:       negCur,
      negativeRateChange: negCur - negPrev,
    };

    // ──────────────────────────────────────────────────────────
    // 2. Chart : reviews + rating moyens groupés par période
    // ──────────────────────────────────────────────────────────
    const { expr, label } = getGroupFormat(range);

    // On ne peut pas interpoler directement des expressions SQL dans queryRaw
    // → on utilise une requête raw avec Prisma.sql template
    const chartRows = await prisma.$queryRaw`
      SELECT
        ${Prisma.raw(label)}          AS month,
        ${Prisma.raw(expr)}           AS period,
        COUNT(*)                      AS reviews,
        ROUND(AVG(r.rating), 1)      AS rating
      FROM reviews r
      JOIN locations l ON r.locationId = l.id
      WHERE l.companyId = ${companyId}
        AND r.createdAt BETWEEN ${fromStr} AND ${toStr}
        ${locationFilter}
      GROUP BY period, month
      ORDER BY period ASC
    `;

    const chartData = chartRows.map((row) => ({
      month:   row.month   || "",
      reviews: Number(row.reviews) || 0,
      rating:  Number(row.rating)  || 0,
    }));

    // ──────────────────────────────────────────────────────────
    // 3. Distribution des notes (1 → 5)
    // ──────────────────────────────────────────────────────────
    const ratingRows = await prisma.$queryRaw`
      SELECT
        r.rating                                          AS stars,
        COUNT(*)                                          AS cnt
      FROM reviews r
      JOIN locations l ON r.locationId = l.id
      WHERE l.companyId = ${companyId}
        AND r.createdAt BETWEEN ${fromStr} AND ${toStr}
        ${locationFilter}
      GROUP BY r.rating
      ORDER BY r.rating DESC
    `;

    const totalForDist = ratingRows.reduce((s, r) => s + Number(r.cnt), 0) || 1;
    const ratingMap    = Object.fromEntries(ratingRows.map((r) => [r.stars, Number(r.cnt)]));

    const ratingDistribution = [5, 4, 3, 2, 1].map((stars) => {
      const count = ratingMap[stars] || 0;
      return {
        stars,
        count,
        pct: Math.round((count / totalForDist) * 100),
      };
    });

    // ──────────────────────────────────────────────────────────
    // 4. Funnel de conversion
    // ──────────────────────────────────────────────────────────
    const [[funnelScans], [funnelPageViews], [funnelFeedback]] = await Promise.all([
      prisma.$queryRaw`
        SELECT COUNT(*) AS val
        FROM analytics_events
        WHERE companyId = ${companyId}
          AND type = 'SCAN'
          AND occurredAt BETWEEN ${fromStr} AND ${toStr}
      `,
      prisma.$queryRaw`
        SELECT COUNT(*) AS val
        FROM analytics_events
        WHERE companyId = ${companyId}
          AND type = 'PAGE_VIEW'
          AND occurredAt BETWEEN ${fromStr} AND ${toStr}
      `,
      prisma.$queryRaw`
        SELECT COUNT(*) AS val
        FROM feedbacks
        WHERE companyId = ${companyId}
          AND createdAt BETWEEN ${fromStr} AND ${toStr}
          ${locationId ? Prisma.sql`AND locationId = ${locationId}` : Prisma.sql``}
      `,
    ]);

    const fScans      = Number(funnelScans.val)     || 0;
    const fPageViews  = Number(funnelPageViews.val) || 0;
    const fFeedback   = Number(funnelFeedback.val)  || 0;
    const fPublic     = Number(kpiCur.postedCount)  || 0;
    const fBase       = fScans || 1;

    const funnel = {
      cardScans:     fScans,
      cardScansPct:  100,
      pageViews:     fPageViews,
      pageViewsPct:  Math.round((fPageViews / fBase) * 100),
      feedbackGiven: fFeedback,
      feedbackPct:   Math.round((fFeedback  / fBase) * 100),
      publicReviews: fPublic,
      publicPct:     Math.round((fPublic    / fBase) * 100),
    };

    // ──────────────────────────────────────────────────────────
    // 5. Comparatif par location
    // ──────────────────────────────────────────────────────────
    const locationRows = await prisma.$queryRaw`
      SELECT
        l.id,
        l.name,
        COUNT(r.id)              AS reviews,
        ROUND(AVG(r.rating), 1) AS rating,

        -- Scans NFC liés à cette location (via nfc_cards)
        (
          SELECT COUNT(*)
          FROM analytics_events ae
          WHERE ae.companyId = ${companyId}
            AND ae.type = 'SCAN'
            AND ae.occurredAt BETWEEN ${fromStr} AND ${toStr}
            AND ae.cardUid IN (
              SELECT nc.uid FROM nfc_cards nc WHERE nc.locationId = l.id
            )
        ) AS scans
      FROM locations l
      LEFT JOIN reviews r
        ON r.locationId = l.id
        AND r.createdAt BETWEEN ${fromStr} AND ${toStr}
      WHERE l.companyId = ${companyId}
        AND l.active = 1
      GROUP BY l.id, l.name
      ORDER BY reviews DESC
    `;

    const locationData = locationRows.map((row) => {
      const scans      = Number(row.scans)   || 1;
      const reviews    = Number(row.reviews) || 0;
      const conversion = Math.round((reviews / scans) * 100);
      return {
        id:         row.id,
        name:       row.name,
        reviews,
        rating:     Number(row.rating) || 0,
        conversion: Math.min(conversion, 100), // cap à 100%
        scans:      Number(row.scans) || 0,
      };
    });

    // ──────────────────────────────────────────────────────────
    // Réponse finale
    // ──────────────────────────────────────────────────────────
    res.json({
      success: true,
      data: {
        range,
        kpis,
        chartData,
        ratingDistribution,
        funnel,
        locationData,
      },
    });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/client/shop/analytics/export?range=
// Retourne un CSV du chart data (colonnes: Period, Reviews, Rating)
// ─────────────────────────────────────────────────────────────
export const exportAnalytics = async (req, res, next) => {
  try {
    const companyId  = getCompanyId(req);
    const range      = ["7d", "30d", "6m", "1y"].includes(req.query.range) ? req.query.range : "6m";
    const locationId = req.query.locationId ? parseInt(req.query.locationId) : null;

    const { from, to } = getDateBounds(range);
    const fromStr      = toMysql(from);
    const toStr        = toMysql(to);
    const locationFilter = locationId ? Prisma.sql`AND l.id = ${locationId}` : Prisma.sql``;

    const { expr, label } = getGroupFormat(range);

    const rows = await prisma.$queryRaw`
      SELECT
        ${Prisma.raw(label)}          AS period,
        COUNT(*)                      AS reviews,
        ROUND(AVG(r.rating), 1)      AS rating
      FROM reviews r
      JOIN locations l ON r.locationId = l.id
      WHERE l.companyId = ${companyId}
        AND r.createdAt BETWEEN ${fromStr} AND ${toStr}
        ${locationFilter}
      GROUP BY ${Prisma.raw(expr)}
      ORDER BY ${Prisma.raw(expr)} ASC
    `;

    const lines   = rows.map((r) => `"${r.period}",${Number(r.reviews)},${Number(r.rating)}`);
    const csvBody = `Period,Reviews,AvgRating\n${lines.join("\n")}`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="analytics-${range}.csv"`);
    res.send(csvBody);
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/client/shop/analytics/locations
// Liste des locations pour le filtre du front (select box)
// ─────────────────────────────────────────────────────────────
export const getAnalyticsLocations = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);

    const locations = await prisma.location.findMany({
      where:   { companyId, active: true },
      select:  { id: true, name: true, city: true },
      orderBy: { name: "asc" },
    });

    res.json({ success: true, data: locations });
  } catch (e) {
    next(e);
  }
};