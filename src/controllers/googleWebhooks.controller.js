import prisma from "../config/database.js";

// GET /api/admin/google/webhooks/history
export async function getWebhookHistory(req, res) {
  const companyId = req.user.companyId;
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  try {
    const logs = await prisma.aiAutoReplyLog.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        googleReviewId: true,
        reviewText: true,
        reply: true,
        safetyScore: true,
        status: true,
        errorMessage: true,
        publishedAt: true,
        createdAt: true,
      },
    });
    res.json({ history: logs, total: logs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/google/webhooks/flush
export async function flushRetryQueue(req, res) {
  const companyId = req.user.companyId;
  try {
    // Retry all failed logs
    const failed = await prisma.aiAutoReplyLog.findMany({
      where: { companyId, status: "failed" },
      take: 20,
    });

    let retried = 0;
    for (const log of failed) {
      await prisma.aiAutoReplyLog.update({
        where: { id: log.id },
        data: { status: "pending", errorMessage: null },
      });
      retried++;
    }

    res.json({ ok: true, retried });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
