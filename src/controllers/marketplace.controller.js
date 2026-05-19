// backend/src/controllers/marketplace.controller.js
// Marketplace — catalogue d'intégrations + connexions par company + webhook custom
// Mounted at /api/admin/marketplace

import prisma  from "../config/database.js";
import crypto  from "crypto";

function getCompanyId(req) {
  const id = req.user?.companyId;
  if (!id) throw Object.assign(new Error("No active company"), { status: 403 });
  return parseInt(id);
}

function maskSecret(s) {
  if (!s) return null;
  return s.slice(0, 4) + "•".repeat(Math.max(0, s.length - 4));
}

function formatConnection(c) {
  return {
    integrationId: c.integrationId,
    status:        c.status,
    apiKey:        maskSecret(c.apiKey),
    connectedAt:   c.connectedAt,
  };
}

// GET /api/admin/marketplace/integrations
// Retourne le catalogue complet + statut de connexion pour la company
export async function listIntegrations(req, res) {
  try {
    const companyId = getCompanyId(req);
    const [integrations, connections] = await Promise.all([
      prisma.marketplaceIntegration.findMany({
        where:   { active: true },
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.companyIntegration.findMany({ where: { companyId } }),
    ]);

    const connMap = new Map(connections.map((c) => [c.integrationId, c]));

    const data = integrations.map((intg) => {
      const conn = connMap.get(intg.id);
      return {
        id:          intg.id,
        name:        intg.name,
        description: intg.description,
        category:    intg.category,
        logoUrl:     intg.logoUrl,
        connected:   !!conn,
        connection:  conn ? formatConnection(conn) : null,
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
}

// POST /api/admin/marketplace/integrations/:id/connect
export async function connectIntegration(req, res) {
  try {
    const companyId     = getCompanyId(req);
    const integrationId = parseInt(req.params.id);
    const { apiKey, apiSecret } = req.body;

    const intg = await prisma.marketplaceIntegration.findUnique({ where: { id: integrationId } });
    if (!intg) return res.status(404).json({ error: "Integration not found." });

    const conn = await prisma.companyIntegration.upsert({
      where:  { companyId_integrationId: { companyId, integrationId } },
      create: { companyId, integrationId, status: "connected", apiKey: apiKey ?? null, apiSecret: apiSecret ?? null },
      update: { status: "connected", apiKey: apiKey ?? null, apiSecret: apiSecret ?? null, connectedAt: new Date() },
    });

    res.json({ success: true, data: formatConnection(conn) });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
}

// DELETE /api/admin/marketplace/integrations/:id/disconnect
export async function disconnectIntegration(req, res) {
  try {
    const companyId     = getCompanyId(req);
    const integrationId = parseInt(req.params.id);

    await prisma.companyIntegration.deleteMany({
      where: { companyId, integrationId },
    });

    res.json({ success: true });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
}

// GET /api/admin/marketplace/webhook
export async function getWebhook(req, res) {
  try {
    const companyId = getCompanyId(req);
    const webhook   = await prisma.companyWebhook.findUnique({ where: { companyId } });
    if (!webhook) return res.json({ success: true, data: null });

    const baseUrl = process.env.URL_PROD_FRONTEND?.replace("3000", "4000")
      ?? process.env.FRONT_URL?.replace("3000", "4000")
      ?? "http://localhost:4000";

    res.json({
      success: true,
      data: {
        token:     webhook.token,
        url:       `${baseUrl}/api/webhooks/inbound/${webhook.token}`,
        active:    webhook.active,
        createdAt: webhook.createdAt,
      },
    });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
}

// POST /api/admin/marketplace/webhook  (génère ou régénère)
export async function generateWebhook(req, res) {
  try {
    const companyId = getCompanyId(req);
    const token     = crypto.randomBytes(24).toString("hex"); // 48 hex chars

    const webhook = await prisma.companyWebhook.upsert({
      where:  { companyId },
      create: { companyId, token, active: true },
      update: { token, active: true, updatedAt: new Date() },
    });

    const baseUrl = process.env.URL_PROD_FRONTEND?.replace("3000", "4000")
      ?? process.env.FRONT_URL?.replace("3000", "4000")
      ?? "http://localhost:4000";

    res.json({
      success: true,
      data: {
        token:     webhook.token,
        url:       `${baseUrl}/api/webhooks/inbound/${webhook.token}`,
        active:    webhook.active,
        createdAt: webhook.createdAt,
      },
    });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
}

// DELETE /api/admin/marketplace/webhook
export async function deleteWebhook(req, res) {
  try {
    const companyId = getCompanyId(req);
    await prisma.companyWebhook.deleteMany({ where: { companyId } });
    res.json({ success: true });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
}
