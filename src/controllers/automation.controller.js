// backend/src/controllers/automation.controller.js
// Automation Workflows — CRUD + toggle + test send
// Mounted at /api/admin/automation

import prisma from "../config/database.js";
import { sendEmail } from "../config/mailer.js";
import { sendSms } from "../config/sms.js";

function getCompanyId(req) {
  const id = req.user?.companyId;
  if (!id) throw Object.assign(new Error("No active company"), { status: 403 });
  return parseInt(id);
}

function formatWorkflow(w) {
  return {
    id:           w.id,
    name:         w.name,
    trigger:      w.trigger,
    action:       w.action,
    delay:        w.delay,
    template:     w.template,
    enabled:      w.enabled,
    stats: {
      sent:       w.statSent,
      converted:  w.statConverted,
    },
    createdAt:    w.createdAt,
    updatedAt:    w.updatedAt,
  };
}

// GET /api/admin/automation
export async function listWorkflows(req, res) {
  try {
    const companyId = getCompanyId(req);
    const workflows = await prisma.automationWorkflow.findMany({
      where:   { companyId },
      orderBy: { createdAt: "asc" },
    });
    res.json({ success: true, data: workflows.map(formatWorkflow) });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
}

// POST /api/admin/automation
export async function createWorkflow(req, res) {
  try {
    const companyId = getCompanyId(req);
    const { name, trigger, action, delay, template } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Name is required." });

    const workflow = await prisma.automationWorkflow.create({
      data: {
        companyId,
        name:     name.trim(),
        trigger:  trigger  ?? "After payment",
        action:   action   ?? "Send SMS",
        delay:    delay    ?? "2 hours",
        template: template ?? "Hi {customer_name}, share your experience: {review_link}",
        enabled:  false,
      },
    });
    res.status(201).json({ success: true, data: formatWorkflow(workflow) });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
}

// PUT /api/admin/automation/:id
export async function updateWorkflow(req, res) {
  try {
    const companyId = getCompanyId(req);
    const id = parseInt(req.params.id);
    const { name, trigger, action, delay, template, enabled } = req.body;

    const existing = await prisma.automationWorkflow.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ error: "Workflow not found." });

    const updated = await prisma.automationWorkflow.update({
      where: { id },
      data: {
        ...(name     !== undefined && { name: name.trim() }),
        ...(trigger  !== undefined && { trigger }),
        ...(action   !== undefined && { action }),
        ...(delay    !== undefined && { delay }),
        ...(template !== undefined && { template }),
        ...(enabled  !== undefined && { enabled: Boolean(enabled) }),
      },
    });
    res.json({ success: true, data: formatWorkflow(updated) });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
}

// PATCH /api/admin/automation/:id/toggle
export async function toggleWorkflow(req, res) {
  try {
    const companyId = getCompanyId(req);
    const id = parseInt(req.params.id);

    const existing = await prisma.automationWorkflow.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ error: "Workflow not found." });

    const updated = await prisma.automationWorkflow.update({
      where: { id },
      data:  { enabled: !existing.enabled },
    });
    res.json({ success: true, data: formatWorkflow(updated) });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
}

// DELETE /api/admin/automation/:id
export async function deleteWorkflow(req, res) {
  try {
    const companyId = getCompanyId(req);
    const id = parseInt(req.params.id);

    const existing = await prisma.automationWorkflow.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ error: "Workflow not found." });

    await prisma.automationWorkflow.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
}

// POST /api/admin/automation/:id/test
export async function testWorkflow(req, res) {
  try {
    const companyId = getCompanyId(req);
    const id = parseInt(req.params.id);
    const { recipient, customerName } = req.body;

    if (!recipient?.trim()) return res.status(400).json({ error: "Recipient is required." });

    const workflow = await prisma.automationWorkflow.findFirst({ where: { id, companyId } });
    if (!workflow) return res.status(404).json({ error: "Workflow not found." });

    const company = await prisma.company.findUnique({
      where:  { id: companyId },
      select: { name: true, googleReviewUrl: true },
    });

    const message = workflow.template
      .replace(/\{customer_name\}/g, customerName?.trim() || "Customer")
      .replace(/\{business_name\}/g, company?.name || "Our business")
      .replace(/\{review_link\}/g,   company?.googleReviewUrl || "https://g.page/r/...");

    if (workflow.action === "Send Email") {
      await sendEmail({
        to:      recipient.trim(),
        subject: `[Test] ${workflow.name}`,
        html:    `<p>${message.replace(/\n/g, "<br>")}</p>`,
        text:    message,
      });
    } else {
      await sendSms(recipient.trim(), message);
    }

    res.json({ success: true, message: "Test sent successfully." });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
}
