// ═══════════════════════════════════════════════════════════
// src/controllers/superadmin/aiAnalytics.controller.js
// Usage · Financials · Logs · Reports — superadmin
// ═══════════════════════════════════════════════════════════

import prisma from "../../config/database.js";

// Limites IA par plan slug (même map que le côté admin)
const AI_PLAN_LIMITS = {
  starter:   { monthlyIncluded: 50  },
  growth:    { monthlyIncluded: 200 },
  dominator: { monthlyIncluded: 1000 },
  default:   { monthlyIncluded: 50  },
};

function planIncluded(slug) {
  return (AI_PLAN_LIMITS[slug] ?? AI_PLAN_LIMITS.default).monthlyIncluded;
}

// ── Génère toutes les dates d'une plage (YYYY-MM-DD) ─────────
function dateRange(days) {
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

// ── Derniers N mois sous forme { year, month, label } ────────
function lastNMonths(n) {
  const months = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      year:  d.getFullYear(),
      month: d.getMonth() + 1,
      label: d.toLocaleString("en", { month: "short", year: "2-digit" }),
    });
  }
  return months;
}

// ════════════════════════════════════════════════════════════
// GET /api/superadmin/ai/usage
// ════════════════════════════════════════════════════════════
export async function getUsage(req, res) {
  try {
    const now   = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth() + 1;

    // Tableau mensuel des 6 derniers mois (agrégat plateforme)
    const sixMonths = lastNMonths(6);
    const firstMonth = sixMonths[0];

    const [usageThisMonth, monthlySeries] = await Promise.all([
      // Usage du mois courant, par company
      prisma.aiUsageMonth.findMany({
        where: { year, month },
        include: {
          company: {
            select: {
              id: true, name: true,
              package: { select: { slug: true } },
            },
          },
        },
        orderBy: { generatedCount: "desc" },
      }),

      // Agrégat mensuel (6 derniers mois)
      prisma.$queryRaw`
        SELECT year, month,
          SUM(generatedCount) AS replies,
          SUM(totalTokens)    AS tokens,
          SUM(totalCostUsd)   AS cost
        FROM ai_usage_months
        WHERE (year > ${firstMonth.year})
           OR (year = ${firstMonth.year} AND month >= ${firstMonth.month})
        GROUP BY year, month
        ORDER BY year ASC, month ASC
      `,
    ]);

    // Associe le résultat des 6 mois aux labels
    const chartMap = {};
    for (const row of monthlySeries) {
      chartMap[`${row.year}-${row.month}`] = {
        replies: Number(row.replies ?? 0),
        cost:    Number(row.cost    ?? 0),
      };
    }
    const monthlyChart = sixMonths.map((m) => ({
      month:   m.label,
      replies: chartMap[`${m.year}-${m.month}`]?.replies ?? 0,
      cost:    chartMap[`${m.year}-${m.month}`]?.cost    ?? 0,
    }));

    // Résumé plateforme
    const totalReplies      = usageThisMonth.reduce((s, r) => s + r.generatedCount, 0);
    const totalCost         = usageThisMonth.reduce((s, r) => s + r.totalCostUsd, 0);
    const activeBusinesses  = usageThisMonth.filter((r) => r.generatedCount > 0).length;

    // Tableau par company
    const businesses = usageThisMonth.map((u) => ({
      companyId:   u.companyId,
      name:        u.company?.name ?? `Company #${u.companyId}`,
      plan:        u.company?.package?.slug ?? "starter",
      generated:   u.generatedCount,
      totalTokens: u.totalTokens,
      totalCostUsd: u.totalCostUsd,
      lastUsed:    u.updatedAt,
    }));

    res.json({
      success: true,
      data: {
        summary: {
          totalReplies,
          activeBusinesses,
          estimatedCost: totalCost,
          avgPerBusiness: activeBusinesses > 0
            ? Math.round(totalReplies / activeBusinesses) : 0,
        },
        monthlyChart,
        businesses,
        year,
        month,
      },
    });
  } catch (err) {
    console.error("[aiAnalytics] getUsage:", err);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
}

// ════════════════════════════════════════════════════════════
// GET /api/superadmin/ai/financials?days=30
// ════════════════════════════════════════════════════════════
export async function getFinancials(req, res) {
  try {
    const days      = Math.min(parseInt(req.query.days, 10) || 30, 365);
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    sinceDate.setHours(0, 0, 0, 0);

    const [costSeries, revSeries, companyAgg] = await Promise.all([
      // Coût + tokens + replies par jour (depuis AiRequestLog)
      prisma.$queryRaw`
        SELECT DATE(createdAt) AS date,
          COUNT(*)                         AS replies,
          SUM(inputTokens + outputTokens)  AS tokens,
          SUM(costUsd)                     AS cost
        FROM ai_request_logs
        WHERE createdAt >= ${sinceDate} AND status = 'success'
        GROUP BY DATE(createdAt)
        ORDER BY date ASC
      `,

      // Revenue par jour (achats de crédits)
      prisma.$queryRaw`
        SELECT DATE(createdAt) AS date,
          SUM(revenueUsd) AS revenue
        FROM ai_credit_transactions
        WHERE createdAt >= ${sinceDate} AND kind = 'purchase' AND revenueUsd IS NOT NULL
        GROUP BY DATE(createdAt)
        ORDER BY date ASC
      `,

      // Profitabilité par company sur la période
      prisma.$queryRaw`
        SELECT
          c.id                              AS companyId,
          c.name                            AS companyName,
          ps.slug                           AS planSlug,
          COALESCE(SUM(l.generatedCount),0) AS generatedReplies,
          COALESCE(SUM(l.totalCostUsd),0)   AS aiCost,
          COALESCE(SUM(l.totalTokens),0)    AS tokens,
          MAX(l.updatedAt)                  AS lastActivity
        FROM companies c
        LEFT JOIN ai_usage_months l
          ON l.companyId = c.id
          AND (l.year * 100 + l.month) >= ${
            (sinceDate.getFullYear() * 100 + sinceDate.getMonth() + 1)
          }
        LEFT JOIN plansetting ps ON c.planId = ps.id
        WHERE l.companyId IS NOT NULL
        GROUP BY c.id, c.name, ps.slug
        ORDER BY aiCost DESC
      `,
    ]);

    // Merge series par date
    const allDates = dateRange(days);
    const costMap = {};
    for (const r of costSeries) {
      const d = String(r.date).slice(0, 10);
      costMap[d] = { replies: Number(r.replies ?? 0), tokens: Number(r.tokens ?? 0), cost: Number(r.cost ?? 0) };
    }
    const revMap = {};
    for (const r of revSeries) {
      const d = String(r.date).slice(0, 10);
      revMap[d] = Number(r.revenue ?? 0);
    }

    const series = allDates.map((date) => {
      const c = costMap[date] ?? { replies: 0, tokens: 0, cost: 0 };
      const revenue = revMap[date] ?? 0;
      const profit  = revenue - c.cost;
      return { date, ...c, revenue, profit };
    });

    // Totaux
    const totals = series.reduce((acc, d) => ({
      revenue: acc.revenue + d.revenue,
      cost:    acc.cost    + d.cost,
      tokens:  acc.tokens  + d.tokens,
      replies: acc.replies + d.replies,
    }), { revenue: 0, cost: 0, tokens: 0, replies: 0 });

    // Revenue par company (purchases)
    const companyRevMap = {};
    const allRevTxns = await prisma.aiCreditTransaction.findMany({
      where: { createdAt: { gte: sinceDate }, kind: "purchase" },
      select: { companyId: true, revenueUsd: true },
    });
    for (const t of allRevTxns) {
      companyRevMap[t.companyId] = (companyRevMap[t.companyId] ?? 0) + (t.revenueUsd ?? 0);
    }

    const businesses = companyAgg.map((b) => {
      const generated = Number(b.generatedReplies ?? 0);
      const included  = planIncluded(b.planSlug ?? "starter");
      const extra     = Math.max(generated - included, 0);
      const revenue   = companyRevMap[Number(b.companyId)] ?? 0;
      const cost      = Number(b.aiCost ?? 0);
      const profit    = revenue - cost;
      const margin    = revenue > 0 ? (profit / revenue) * 100 : 0;

      return {
        id:               String(b.companyId),
        name:             b.companyName,
        plan:             b.planSlug ?? "starter",
        generatedReplies: generated,
        includedReplies:  included,
        extraReplies:     extra,
        revenue,
        aiCost:           cost,
        profit,
        margin,
        tokens:           Number(b.tokens ?? 0),
        lastActivity:     b.lastActivity ?? new Date().toISOString(),
      };
    });

    res.json({
      success: true,
      data: {
        days,
        totals: { ...totals, profit: totals.revenue - totals.cost, active: businesses.filter((b) => b.generatedReplies > 0).length },
        series,
        businesses,
      },
    });
  } catch (err) {
    console.error("[aiAnalytics] getFinancials:", err);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
}

// ════════════════════════════════════════════════════════════
// GET /api/superadmin/ai/logs?provider=&search=&page=1&limit=50
// ════════════════════════════════════════════════════════════
export async function getLogs(req, res) {
  try {
    const { provider, search, page = 1, limit = 50 } = req.query;
    const take = Math.min(parseInt(limit, 10) || 50, 200);
    const skip = (Math.max(parseInt(page, 10), 1) - 1) * take;

    const where = {};
    if (provider && provider !== "all") {
      where.provider = { name: provider };
    }

    const [total, logs] = await Promise.all([
      prisma.aiRequestLog.count({ where }),
      prisma.aiRequestLog.findMany({
        where,
        include: {
          company:  { select: { id: true, name: true } },
          provider: { select: { name: true, displayName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
    ]);

    // Enrichir avec les snippets de reviews (si reviewId présent)
    const reviewIds = [...new Set(logs.map((l) => l.reviewId).filter(Boolean))];
    let reviewMap = {};
    if (reviewIds.length > 0) {
      const reviews = await prisma.review.findMany({
        where: { id: { in: reviewIds } },
        select: { id: true, comment: true },
      });
      reviewMap = Object.fromEntries(reviews.map((r) => [r.id, r.comment]));
    }

    const rows = logs.map((l) => {
      const rawText    = reviewMap[l.reviewId] ?? "";
      const snippet    = rawText ? rawText.slice(0, 80) + (rawText.length > 80 ? "…" : "") : "";
      const totalTokens = l.inputTokens + l.outputTokens;

      return {
        id:            l.id,
        createdAt:     l.createdAt,
        companyId:     l.companyId,
        businessName:  l.company?.name ?? `Company #${l.companyId}`,
        provider:      l.provider?.name ?? l.model?.split("-")[0] ?? "unknown",
        providerLabel: l.provider?.displayName ?? l.provider?.name ?? "—",
        model:         l.model ?? "—",
        reviewId:      l.reviewId,
        reviewSnippet: snippet,
        inputTokens:   l.inputTokens,
        outputTokens:  l.outputTokens,
        totalTokens,
        costUsd:       l.costUsd,
        status:        l.status,
        durationMs:    l.durationMs,
      };
    });

    // Filtrage search côté serveur (business name ou snippet)
    const filtered = search
      ? rows.filter((r) =>
          r.businessName.toLowerCase().includes(search.toLowerCase()) ||
          r.reviewSnippet.toLowerCase().includes(search.toLowerCase())
        )
      : rows;

    res.json({
      success: true,
      data: filtered,
      meta: {
        total,
        page:      parseInt(page, 10),
        limit:     take,
        last_page: Math.max(1, Math.ceil(total / take)),
      },
    });
  } catch (err) {
    console.error("[aiAnalytics] getLogs:", err);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
}

// ════════════════════════════════════════════════════════════
// GET /api/superadmin/ai/reports?period=monthly
// period : daily (1j) | weekly (7j) | monthly (30j)
// ════════════════════════════════════════════════════════════
export async function getReports(req, res) {
  try {
    const PERIOD_DAYS = { daily: 1, weekly: 7, monthly: 30 };
    const period = req.query.period in PERIOD_DAYS ? req.query.period : "monthly";
    const days   = PERIOD_DAYS[period];

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    sinceDate.setHours(0, 0, 0, 0);

    // Série journalière sur la période
    const [costSeries, revSeries, companyAgg] = await Promise.all([
      prisma.$queryRaw`
        SELECT DATE(createdAt) AS date,
          COUNT(*)                        AS replies,
          SUM(inputTokens + outputTokens) AS tokens,
          SUM(costUsd)                    AS cost
        FROM ai_request_logs
        WHERE createdAt >= ${sinceDate} AND status = 'success'
        GROUP BY DATE(createdAt)
        ORDER BY date ASC
      `,
      prisma.$queryRaw`
        SELECT DATE(createdAt) AS date, SUM(revenueUsd) AS revenue
        FROM ai_credit_transactions
        WHERE createdAt >= ${sinceDate} AND kind = 'purchase' AND revenueUsd IS NOT NULL
        GROUP BY DATE(createdAt)
        ORDER BY date ASC
      `,
      // Ranking companies
      prisma.$queryRaw`
        SELECT
          c.id AS companyId, c.name AS companyName, ps.slug AS planSlug,
          COALESCE(SUM(l.generatedCount),0) AS generatedReplies,
          COALESCE(SUM(l.totalCostUsd),0)   AS aiCost,
          COALESCE(SUM(l.totalTokens),0)    AS tokens
        FROM companies c
        LEFT JOIN ai_usage_months l
          ON l.companyId = c.id
          AND (l.year * 100 + l.month) >= ${
            sinceDate.getFullYear() * 100 + sinceDate.getMonth() + 1
          }
        LEFT JOIN plansetting ps ON c.planId = ps.id
        WHERE l.companyId IS NOT NULL
        GROUP BY c.id, c.name, ps.slug
      `,
    ]);

    // Revenue par company
    const companyRevMap = {};
    const revTxns = await prisma.aiCreditTransaction.findMany({
      where: { createdAt: { gte: sinceDate }, kind: "purchase" },
      select: { companyId: true, revenueUsd: true },
    });
    for (const t of revTxns) {
      companyRevMap[t.companyId] = (companyRevMap[t.companyId] ?? 0) + (t.revenueUsd ?? 0);
    }

    // Merge series
    const allDates = dateRange(days);
    const costMap = {};
    for (const r of costSeries) {
      const d = String(r.date).slice(0, 10);
      costMap[d] = { replies: Number(r.replies ?? 0), tokens: Number(r.tokens ?? 0), cost: Number(r.cost ?? 0) };
    }
    const revMap = {};
    for (const r of revSeries) {
      revMap[String(r.date).slice(0, 10)] = Number(r.revenue ?? 0);
    }

    const series = allDates.map((date) => {
      const c = costMap[date] ?? { replies: 0, tokens: 0, cost: 0 };
      const revenue = revMap[date] ?? 0;
      return { date, ...c, revenue, profit: revenue - c.cost };
    });

    const totals = series.reduce(
      (acc, d) => ({ revenue: acc.revenue + d.revenue, cost: acc.cost + d.cost, replies: acc.replies + d.replies, tokens: acc.tokens + d.tokens }),
      { revenue: 0, cost: 0, replies: 0, tokens: 0 }
    );
    const profit = totals.revenue - totals.cost;
    const margin = totals.revenue > 0 ? (profit / totals.revenue) * 100 : 0;

    // Rankings
    const businesses = companyAgg.map((b) => ({
      id:               String(b.companyId),
      name:             b.companyName,
      plan:             b.planSlug ?? "starter",
      generatedReplies: Number(b.generatedReplies ?? 0),
      aiCost:           Number(b.aiCost ?? 0),
      tokens:           Number(b.tokens ?? 0),
      revenue:          companyRevMap[Number(b.companyId)] ?? 0,
    }));

    const mostActive   = [...businesses].sort((a, b) => b.generatedReplies - a.generatedReplies).slice(0, 5);
    const highestRev   = [...businesses].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const highestCost  = [...businesses].sort((a, b) => b.aiCost - a.aiCost).slice(0, 5);

    res.json({
      success: true,
      data: {
        period,
        days,
        totals: { ...totals, profit, margin },
        series,
        rankings: { mostActive, highestRev, highestCost },
      },
    });
  } catch (err) {
    console.error("[aiAnalytics] getReports:", err);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
}
