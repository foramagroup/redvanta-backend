// backend/src/controllers/request.controller.js
// Contacts · Groups · Templates · Campaigns (stats) · Analytics
// Mounted at /api/admin/requests/*

import prisma from "../config/database.js";

function getCompanyId(req) {
  const id = req.user?.companyId;
  if (!id) throw Object.assign(new Error("No active company"), { status: 403 });
  return parseInt(id);
}

// ── Helpers ───────────────────────────────────────────────────

function formatContact(c) {
  return {
    id: c.id,
    first_name: c.firstName,
    last_name: c.lastName,
    email: c.email,
    phone: c.phone,
    preferred_language: c.preferredLanguage,
    tags: c.tags ?? [],
    groups: c.groupMembers?.map((m) => m.group.name) ?? [],
    groupIds: c.groupMembers?.map((m) => m.group.id) ?? [],
    notes: c.notes,
    status: c.status,
    last_contacted_at: c.lastContactedAt,
    createdAt: c.createdAt,
  };
}

function formatGroup(g) {
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    type: g.type,
    rule: g.rule,
    campaignsUsed: g.campaignsUsed,
    contactIds: g.members?.map((m) => m.contactId) ?? [],
    createdAt: g.createdAt,
  };
}

function formatTemplate(t) {
  return {
    id: t.id,
    name: t.name,
    category: t.category,
    channel: t.channel,
    isDefault: t.isDefault,
    archived: t.isArchived,
    createdAt: t.createdAt,
    variants: t.variants.map((v) => ({
      id: v.id,
      language: v.language,
      subject: v.subject,
      body: v.body,
      sms: v.sms,
    })),
  };
}

// ─────────────────────────────────────────────────────────────
// CONTACTS
// GET  /api/admin/requests/contacts      — liste + stats
// POST /api/admin/requests/contacts      — créer
// PUT  /api/admin/requests/contacts/:id  — modifier
// DELETE /api/admin/requests/contacts    — suppression bulk (body: { ids })
// ─────────────────────────────────────────────────────────────

export const listContacts = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const { q, status, language, groupId } = req.query;

    const where = { companyId };
    if (status && status !== "All") where.status = status;
    if (language && language !== "all") where.preferredLanguage = language;
    if (groupId) where.groupMembers = { some: { groupId: parseInt(groupId) } };
    if (q) {
      where.OR = [
        { firstName: { contains: q } },
        { lastName:  { contains: q } },
        { email:     { contains: q } },
        { phone:     { contains: q } },
      ];
    }

    const [contacts, total, active, unsubscribed, groups] = await Promise.all([
      prisma.contact.findMany({
        where,
        include: {
          groupMembers: { include: { group: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.contact.count({ where: { companyId } }),
      prisma.contact.count({ where: { companyId, status: "Active" } }),
      prisma.contact.count({ where: { companyId, status: "Unsubscribed" } }),
      prisma.contactGroup.count({ where: { companyId } }),
    ]);

    res.json({
      success: true,
      data: contacts.map(formatContact),
      stats: { total, active, unsubscribed, groups },
    });
  } catch (e) {
    next(e);
  }
};

export const createContact = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const {
      first_name, last_name, email, phone,
      preferred_language = "en",
      tags = [], notes, status = "Active",
      groupIds = [],
    } = req.body;

    if (!email?.trim() && !phone?.trim()) {
      return res.status(422).json({ success: false, error: "Email or phone is required." });
    }

    const contact = await prisma.contact.create({
      data: {
        companyId,
        firstName: first_name?.trim() || null,
        lastName:  last_name?.trim()  || null,
        email:     email?.trim().toLowerCase() || null,
        phone:     phone?.trim()  || null,
        preferredLanguage: preferred_language,
        tags:   Array.isArray(tags) ? tags : [],
        notes:  notes?.trim() || null,
        status,
        ...(groupIds.length && {
          groupMembers: {
            create: groupIds.map((id) => ({ groupId: parseInt(id) })),
          },
        }),
      },
      include: {
        groupMembers: { include: { group: { select: { id: true, name: true } } } },
      },
    });

    res.status(201).json({ success: true, data: formatContact(contact) });
  } catch (e) {
    next(e);
  }
};

export const updateContact = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const id = parseInt(req.params.id);
    const {
      first_name, last_name, email, phone,
      preferred_language, tags, notes, status,
      groupIds,
    } = req.body;

    const existing = await prisma.contact.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ success: false, error: "Contact not found." });

    const data = {};
    if (first_name !== undefined) data.firstName = first_name?.trim() || null;
    if (last_name  !== undefined) data.lastName  = last_name?.trim()  || null;
    if (email      !== undefined) data.email     = email?.trim().toLowerCase() || null;
    if (phone      !== undefined) data.phone     = phone?.trim() || null;
    if (preferred_language !== undefined) data.preferredLanguage = preferred_language;
    if (tags   !== undefined) data.tags  = Array.isArray(tags) ? tags : [];
    if (notes  !== undefined) data.notes = notes?.trim() || null;
    if (status !== undefined) data.status = status;

    if (Array.isArray(groupIds)) {
      await prisma.contactGroupMember.deleteMany({ where: { contactId: id } });
      if (groupIds.length) {
        await prisma.contactGroupMember.createMany({
          data: groupIds.map((gId) => ({ contactId: id, groupId: parseInt(gId) })),
          skipDuplicates: true,
        });
      }
    }

    const updated = await prisma.contact.update({
      where: { id },
      data,
      include: {
        groupMembers: { include: { group: { select: { id: true, name: true } } } },
      },
    });

    res.json({ success: true, data: formatContact(updated) });
  } catch (e) {
    next(e);
  }
};

export const bulkDeleteContacts = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(422).json({ success: false, error: "ids[] is required." });
    }

    const result = await prisma.contact.deleteMany({
      where: { id: { in: ids.map(Number) }, companyId },
    });

    res.json({ success: true, deleted: result.count });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// GROUPS
// GET    /api/admin/requests/groups       — liste
// POST   /api/admin/requests/groups       — créer
// PUT    /api/admin/requests/groups/:id   — modifier
// DELETE /api/admin/requests/groups/:id   — supprimer
// ─────────────────────────────────────────────────────────────

export const listGroups = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);

    const groups = await prisma.contactGroup.findMany({
      where:   { companyId },
      include: { members: { select: { contactId: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: groups.map(formatGroup) });
  } catch (e) {
    next(e);
  }
};

export const createGroup = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const { name, description, type = "manual", rule, contactIds = [] } = req.body;

    if (!name?.trim()) return res.status(422).json({ success: false, error: "Name is required." });

    const group = await prisma.contactGroup.create({
      data: {
        companyId,
        name:        name.trim(),
        description: description?.trim() || null,
        type,
        rule:        rule?.trim() || null,
        ...(contactIds.length && {
          members: {
            create: contactIds.map((id) => ({ contactId: parseInt(id) })),
          },
        }),
      },
      include: { members: { select: { contactId: true } } },
    });

    res.status(201).json({ success: true, data: formatGroup(group) });
  } catch (e) {
    next(e);
  }
};

export const updateGroup = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const id = parseInt(req.params.id);
    const { name, description, type, rule, contactIds } = req.body;

    const existing = await prisma.contactGroup.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ success: false, error: "Group not found." });

    const data = {};
    if (name        !== undefined) data.name        = name.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (type        !== undefined) data.type        = type;
    if (rule        !== undefined) data.rule        = rule?.trim() || null;

    if (Array.isArray(contactIds)) {
      await prisma.contactGroupMember.deleteMany({ where: { groupId: id } });
      if (contactIds.length) {
        await prisma.contactGroupMember.createMany({
          data: contactIds.map((cId) => ({ groupId: id, contactId: parseInt(cId) })),
          skipDuplicates: true,
        });
      }
    }

    const updated = await prisma.contactGroup.update({
      where: { id },
      data,
      include: { members: { select: { contactId: true } } },
    });

    res.json({ success: true, data: formatGroup(updated) });
  } catch (e) {
    next(e);
  }
};

export const deleteGroup = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const id = parseInt(req.params.id);

    const existing = await prisma.contactGroup.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ success: false, error: "Group not found." });

    await prisma.contactGroup.delete({ where: { id } });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// TEMPLATES
// GET    /api/admin/requests/templates              — liste
// POST   /api/admin/requests/templates              — créer
// PUT    /api/admin/requests/templates/:id          — modifier
// DELETE /api/admin/requests/templates/:id          — supprimer
// POST   /api/admin/requests/templates/:id/duplicate
// POST   /api/admin/requests/templates/:id/archive
// ─────────────────────────────────────────────────────────────

export const listTemplates = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const { category, channel, archived } = req.query;

    const where = { companyId, isArchived: archived === "true" };
    if (category && category !== "All") where.category = category;
    if (channel  && channel  !== "all") where.channel  = channel;

    const templates = await prisma.campaignTemplate.findMany({
      where,
      include: { variants: true },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: templates.map(formatTemplate) });
  } catch (e) {
    next(e);
  }
};

export const createTemplate = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const { name, category = "Custom", channel = "email", variants = [] } = req.body;

    if (!name?.trim()) return res.status(422).json({ success: false, error: "Name is required." });

    const template = await prisma.campaignTemplate.create({
      data: {
        companyId,
        name:     name.trim(),
        category,
        channel,
        variants: {
          create: variants.map((v) => ({
            language: v.language || "en",
            subject:  v.subject?.trim() || null,
            body:     v.body?.trim()    || null,
            sms:      v.sms?.trim()     || null,
          })),
        },
      },
      include: { variants: true },
    });

    res.status(201).json({ success: true, data: formatTemplate(template) });
  } catch (e) {
    next(e);
  }
};

export const updateTemplate = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const id = parseInt(req.params.id);
    const { name, category, channel, variants } = req.body;

    const existing = await prisma.campaignTemplate.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ success: false, error: "Template not found." });

    const data = {};
    if (name     !== undefined) data.name     = name.trim();
    if (category !== undefined) data.category = category;
    if (channel  !== undefined) data.channel  = channel;

    if (Array.isArray(variants)) {
      for (const v of variants) {
        await prisma.campaignTemplateVariant.upsert({
          where:  { templateId_language: { templateId: id, language: v.language || "en" } },
          create: { templateId: id, language: v.language || "en", subject: v.subject?.trim() || null, body: v.body?.trim() || null, sms: v.sms?.trim() || null },
          update: { subject: v.subject?.trim() || null, body: v.body?.trim() || null, sms: v.sms?.trim() || null },
        });
      }
    }

    const updated = await prisma.campaignTemplate.update({
      where: { id },
      data,
      include: { variants: true },
    });

    res.json({ success: true, data: formatTemplate(updated) });
  } catch (e) {
    next(e);
  }
};

export const deleteTemplate = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const id = parseInt(req.params.id);

    const existing = await prisma.campaignTemplate.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ success: false, error: "Template not found." });
    if (existing.isDefault) return res.status(422).json({ success: false, error: "Cannot delete a default template." });

    await prisma.campaignTemplate.delete({ where: { id } });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};

export const duplicateTemplate = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const id = parseInt(req.params.id);

    const original = await prisma.campaignTemplate.findFirst({
      where:   { id, companyId },
      include: { variants: true },
    });
    if (!original) return res.status(404).json({ success: false, error: "Template not found." });

    const copy = await prisma.campaignTemplate.create({
      data: {
        companyId,
        name:      `${original.name} (copy)`,
        category:  original.category,
        channel:   original.channel,
        isDefault: false,
        variants: {
          create: original.variants.map((v) => ({
            language: v.language,
            subject:  v.subject,
            body:     v.body,
            sms:      v.sms,
          })),
        },
      },
      include: { variants: true },
    });

    res.status(201).json({ success: true, data: formatTemplate(copy) });
  } catch (e) {
    next(e);
  }
};

export const archiveTemplate = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const id = parseInt(req.params.id);

    const existing = await prisma.campaignTemplate.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ success: false, error: "Template not found." });

    const updated = await prisma.campaignTemplate.update({
      where: { id },
      data:  { isArchived: !existing.isArchived },
      include: { variants: true },
    });

    res.json({ success: true, data: formatTemplate(updated) });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// CAMPAIGNS — GET /api/admin/requests/campaigns
// Vue principale page.js : stats + liste récente
// ─────────────────────────────────────────────────────────────

export const listCampaigns = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [sentThisMonth, totalOpened, totalConverted, totalDelivered] = await Promise.all([
      prisma.reviewRequest.count({ where: { companyId, sentAt: { gte: startOfMonth } } }),
      prisma.reviewRequest.count({ where: { companyId, status: { in: ["opened", "completed"] } } }),
      prisma.reviewRequest.count({ where: { companyId, conversion: true } }),
      prisma.reviewRequest.count({ where: { companyId, status: { in: ["delivered", "opened", "completed"] } } }),
    ]);

    const openRate  = totalDelivered ? Math.round((totalOpened    / totalDelivered) * 100) : 0;
    const clickRate = totalDelivered ? Math.round((totalConverted / totalDelivered) * 100) : 0;

    const recent = await prisma.reviewRequest.findMany({
      where:   { companyId },
      include: { location: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take:    20,
    });

    const campaigns = recent.map((r) => ({
      id:       r.id,
      name:     r.customerName,
      type:     "Single",
      channel:  r.method === "email" ? "Email" : r.method === "sms" ? "SMS" : "Email & SMS",
      audience: 1,
      status:   r.status.charAt(0).toUpperCase() + r.status.slice(1),
      sent:     r.sentAt,
      open:     r.openedAt ? 100 : 0,
      click:    r.conversion ? 100 : 0,
    }));

    res.json({
      success: true,
      data: {
        campaigns,
        stats: {
          sentThisMonth,
          openRate:  `${openRate}%`,
          clickRate: `${clickRate}%`,
          reviewsCollected: totalConverted,
        },
      },
    });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// ANALYTICS — GET /api/admin/requests/analytics/data
// Vue analytics/page.js : métriques email, SMS, reviews, daily
// ─────────────────────────────────────────────────────────────

export const getAnalytics = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const base = { companyId, createdAt: { gte: thirtyDaysAgo } };

    const [
      emailSent, emailDelivered, emailOpened, emailConverted, emailFailed,
      smsSent, smsDelivered, smsConverted, smsFailed,
      reviewsTotal, reviewsAgg,
      allRequests,
    ] = await Promise.all([
      prisma.reviewRequest.count({ where: { ...base, method: "email" } }),
      prisma.reviewRequest.count({ where: { ...base, method: "email", status: { in: ["delivered", "opened", "completed"] } } }),
      prisma.reviewRequest.count({ where: { ...base, method: "email", status: { in: ["opened", "completed"] } } }),
      prisma.reviewRequest.count({ where: { ...base, method: "email", conversion: true } }),
      prisma.reviewRequest.count({ where: { ...base, method: "email", status: "failed" } }),
      prisma.reviewRequest.count({ where: { ...base, method: "sms" } }),
      prisma.reviewRequest.count({ where: { ...base, method: "sms", status: { in: ["delivered", "opened", "completed"] } } }),
      prisma.reviewRequest.count({ where: { ...base, method: "sms", conversion: true } }),
      prisma.reviewRequest.count({ where: { ...base, method: "sms", status: "failed" } }),
      prisma.review.count({ where: { companyId, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.review.aggregate({ where: { companyId, createdAt: { gte: thirtyDaysAgo } }, _avg: { rating: true } }),
      // All requests (for daily grouping in JS)
      prisma.reviewRequest.findMany({
        where:  { ...base },
        select: { createdAt: true, status: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // Build daily metrics (group by date in JS to avoid raw SQL + table name uncertainty)
    const dailyMap = {};
    for (const r of allRequests) {
      const date = r.createdAt.toISOString().slice(0, 10);
      if (!dailyMap[date]) dailyMap[date] = { sent: 0, opens: 0 };
      dailyMap[date].sent++;
      if (["opened", "completed"].includes(r.status)) dailyMap[date].opens++;
    }
    const daily = Object.entries(dailyMap).map(([date, v]) => ({ date, ...v }));

    const totalRequests = emailSent + smsSent;

    res.json({
      success: true,
      data: {
        email: {
          sent:      emailSent,
          delivered: emailDelivered,
          opens:     emailOpened,
          clicks:    emailConverted,
          bounces:   emailFailed,
        },
        sms: {
          sent:      smsSent,
          delivered: smsDelivered,
          clicks:    smsConverted,
          failed:    smsFailed,
        },
        reviews: {
          total:          reviewsTotal,
          avgRating:      reviewsAgg._avg.rating ? parseFloat(reviewsAgg._avg.rating.toFixed(1)) : 0,
          conversionRate: totalRequests > 0 ? reviewsTotal / totalRequests : 0,
        },
        daily,
      },
    });
  } catch (e) {
    next(e);
  }
};
