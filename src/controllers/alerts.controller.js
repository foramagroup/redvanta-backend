// backend/src/controllers/alerts.controller.js
// Alert preferences + notification history
// Mounted at /api/admin/alerts

import prisma from "../config/database.js";
import { sendEmail } from "../config/mailer.js";

function getCompanyId(req) {
  const id = req.user?.companyId;
  if (!id) throw Object.assign(new Error("No active company"), { status: 403 });
  return parseInt(id);
}

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatNotification(n) {
  return {
    id:      n.id,
    type:    n.type,
    title:   n.title,
    message: n.message,
    read:    n.read,
    time:    timeAgo(n.createdAt),
    createdAt: n.createdAt,
  };
}

// GET /api/admin/alerts/settings
export async function getSettings(req, res) {
  try {
    const companyId = getCompanyId(req);
    let settings = await prisma.alertSettings.findUnique({ where: { companyId } });
    if (!settings) {
      settings = await prisma.alertSettings.create({
        data: { companyId, negativeAlert: true, reviewAlert: true, weeklySummary: "monday" },
      });
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
}

// PUT /api/admin/alerts/settings
export async function saveSettings(req, res) {
  try {
    const companyId = getCompanyId(req);
    const { negativeAlert, reviewAlert, weeklySummary, emailNotif, slackUrl } = req.body;

    const settings = await prisma.alertSettings.upsert({
      where:  { companyId },
      create: { companyId, negativeAlert: !!negativeAlert, reviewAlert: !!reviewAlert, weeklySummary: weeklySummary ?? "monday", emailNotif: emailNotif ?? null, slackUrl: slackUrl ?? null },
      update: {
        ...(negativeAlert  !== undefined && { negativeAlert:  Boolean(negativeAlert) }),
        ...(reviewAlert    !== undefined && { reviewAlert:    Boolean(reviewAlert) }),
        ...(weeklySummary  !== undefined && { weeklySummary }),
        ...(emailNotif     !== undefined && { emailNotif:     emailNotif || null }),
        ...(slackUrl       !== undefined && { slackUrl:       slackUrl   || null }),
      },
    });
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
}

// POST /api/admin/alerts/test
export async function sendTest(req, res) {
  try {
    const companyId = getCompanyId(req);
    const settings = await prisma.alertSettings.findUnique({ where: { companyId } });
    const company  = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });

    const email = settings?.emailNotif;
    if (!email) return res.status(400).json({ error: "No notification email configured." });

    await sendEmail({
      to:      email,
      subject: `[Test] Alert notification from ${company?.name ?? "Krootal"}`,
      html:    `<p>This is a test alert notification. Your alert settings are working correctly.</p>`,
      text:    "This is a test alert notification. Your alert settings are working correctly.",
    });

    res.json({ success: true, message: `Test email sent to ${email}.` });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
}

// GET /api/admin/alerts/history
export async function getHistory(req, res) {
  try {
    const companyId = getCompanyId(req);
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);

    const [notifications, total] = await Promise.all([
      prisma.alertNotification.findMany({
        where:   { companyId },
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      prisma.alertNotification.count({ where: { companyId } }),
    ]);

    const unreadCount = await prisma.alertNotification.count({ where: { companyId, read: false } });

    res.json({
      success: true,
      data:    notifications.map(formatNotification),
      meta:    { total, page, limit, unreadCount },
    });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
}

// PATCH /api/admin/alerts/history/:id/read
export async function markRead(req, res) {
  try {
    const companyId = getCompanyId(req);
    const id = parseInt(req.params.id);

    const existing = await prisma.alertNotification.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ error: "Notification not found." });

    const updated = await prisma.alertNotification.update({ where: { id }, data: { read: true } });
    res.json({ success: true, data: formatNotification(updated) });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
}

// POST /api/admin/alerts/history/read-all
export async function markAllRead(req, res) {
  try {
    const companyId = getCompanyId(req);
    await prisma.alertNotification.updateMany({ where: { companyId, read: false }, data: { read: true } });
    res.json({ success: true });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
}
