// ═══════════════════════════════════════════════════════════
// src/controllers/superadmin/aiProviders.controller.js
// Gestion des fournisseurs IA (superadmin)
// ═══════════════════════════════════════════════════════════

import prisma from "../../config/database.js";

// Fournisseurs par défaut insérés à la première consultation
const DEFAULT_PROVIDERS = [
  {
    name: "openai",
    displayName: "OpenAI",
    model: "gpt-4o-mini",
    active: false,
    isDefault: false,
  },
  {
    name: "anthropic",
    displayName: "Anthropic Claude",
    model: "claude-sonnet-4-5",
    active: false,
    isDefault: false,
  },
  {
    name: "google",
    displayName: "Google Gemini",
    model: "gemini-2.5-flash",
    active: false,
    isDefault: false,
  },
];

// ── Helpers ──────────────────────────────────────────────────

async function ensureProvidersExist() {
  for (const def of DEFAULT_PROVIDERS) {
    await prisma.aiProvider.upsert({
      where: { name: def.name },
      create: def,
      update: {},
    });
  }
}

async function buildProviderStats(provider) {
  // Agrégations depuis AiRequestLog
  const [totalCostAgg, lastSuccess, lastFailure] = await Promise.all([
    prisma.aiRequestLog.aggregate({
      where: { providerId: provider.id },
      _sum: { costUsd: true },
    }),
    prisma.aiRequestLog.findFirst({
      where: { providerId: provider.id, status: "success" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.aiRequestLog.findFirst({
      where: { providerId: provider.id, status: "failed" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, errorMessage: true },
    }),
  ]);

  const connected = provider.active && !!provider.apiKey;

  return {
    id: provider.id,
    name: provider.name,
    displayName: provider.displayName,
    model: provider.model,
    apiKey: provider.apiKey ? maskApiKey(provider.apiKey) : "",
    active: provider.active,
    isDefault: provider.isDefault,
    status: connected ? "connected" : "disconnected",
    requests: provider.totalRequests,
    tokens: provider.totalTokens,
    cost: totalCostAgg._sum.costUsd ?? 0,
    lastSuccessAt: lastSuccess?.createdAt ?? null,
    lastError: lastFailure?.errorMessage ?? null,
    lastErrorAt: lastFailure?.createdAt ?? null,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  };
}

function maskApiKey(key) {
  if (!key || key.length < 8) return "••••••••";
  return key.slice(0, 4) + "••••••••" + key.slice(-4);
}

// ── GET /api/superadmin/ai/providers ─────────────────────────
export async function listProviders(req, res) {
  try {
    await ensureProvidersExist();

    const providers = await prisma.aiProvider.findMany({
      orderBy: { id: "asc" },
    });

    const data = await Promise.all(providers.map(buildProviderStats));

    const defaultId = providers.find((p) => p.isDefault)?.id ?? null;

    res.json({ providers: data, defaultProviderId: defaultId });
  } catch (err) {
    console.error("[aiProviders] listProviders:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

// ── GET /api/superadmin/ai/providers/:id ─────────────────────
export async function getProvider(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const provider = await prisma.aiProvider.findUnique({ where: { id } });
    if (!provider) return res.status(404).json({ error: "Fournisseur introuvable" });

    res.json(await buildProviderStats(provider));
  } catch (err) {
    console.error("[aiProviders] getProvider:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

// ── PUT /api/superadmin/ai/providers/:id ─────────────────────
// Body: { model?, apiKey?, active? }
export async function updateProvider(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { model, apiKey, active } = req.body;

    const existing = await prisma.aiProvider.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Fournisseur introuvable" });

    const data = {};
    if (model !== undefined) data.model = model;
    if (active !== undefined) data.active = Boolean(active);

    // N'écraser la clé que si une nouvelle est fournie (non vide et non masquée)
    if (apiKey !== undefined && apiKey !== "" && !apiKey.includes("••••")) {
      data.apiKey = apiKey;
    }

    const updated = await prisma.aiProvider.update({ where: { id }, data });

    res.json(await buildProviderStats(updated));
  } catch (err) {
    console.error("[aiProviders] updateProvider:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

// ── PATCH /api/superadmin/ai/providers/:id/set-default ───────
// Marque ce fournisseur comme actif par défaut (un seul à la fois)
export async function setDefaultProvider(req, res) {
  try {
    const id = parseInt(req.params.id, 10);

    const provider = await prisma.aiProvider.findUnique({ where: { id } });
    if (!provider) return res.status(404).json({ error: "Fournisseur introuvable" });

    // Transaction : retirer isDefault de tous, puis le mettre sur celui-ci
    await prisma.$transaction([
      prisma.aiProvider.updateMany({ data: { isDefault: false } }),
      prisma.aiProvider.update({ where: { id }, data: { isDefault: true, active: true } }),
    ]);

    const updated = await prisma.aiProvider.findUnique({ where: { id } });

    res.json({
      message: `${updated.displayName} est maintenant le fournisseur par défaut`,
      provider: await buildProviderStats(updated),
    });
  } catch (err) {
    console.error("[aiProviders] setDefaultProvider:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

// ── POST /api/superadmin/ai/providers/:id/test ───────────────
// Teste la connexion à l'API du fournisseur
export async function testProvider(req, res) {
  try {
    const id = parseInt(req.params.id, 10);

    const provider = await prisma.aiProvider.findUnique({ where: { id } });
    if (!provider) return res.status(404).json({ error: "Fournisseur introuvable" });

    if (!provider.apiKey) {
      return res.status(400).json({
        success: false,
        error: "Clé API manquante",
      });
    }

    const { success, error: testError, latencyMs } = await pingProvider(provider);

    // Loguer le résultat dans AiRequestLog (companyId null = test superadmin)
    await prisma.aiRequestLog.create({
      data: {
        companyId: null,
        providerId: provider.id,
        model: provider.model,
        status: success ? "success" : "failed",
        errorMessage: testError ?? null,
        durationMs: latencyMs,
      },
    });

    if (success) {
      res.json({ success: true, latencyMs, provider: provider.displayName });
    } else {
      res.status(422).json({ success: false, error: testError, latencyMs });
    }
  } catch (err) {
    console.error("[aiProviders] testProvider:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

// ── Ping réel vers les providers ─────────────────────────────

async function pingProvider(provider) {
  const start = Date.now();
  try {
    switch (provider.name) {
      case "openai":    return await pingOpenAI(provider.apiKey, provider.model, start);
      case "anthropic": return await pingAnthropic(provider.apiKey, provider.model, start);
      case "google":    return await pingGoogle(provider.apiKey, provider.model, start);
      default:          return { success: false, error: "Fournisseur inconnu", latencyMs: 0 };
    }
  } catch (err) {
    return { success: false, error: err.message, latencyMs: Date.now() - start };
  }
}

async function pingOpenAI(apiKey, model, start) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
    }),
  });
  const latencyMs = Date.now() - start;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { success: false, error: body?.error?.message ?? `HTTP ${res.status}`, latencyMs };
  }
  return { success: true, latencyMs };
}

async function pingAnthropic(apiKey, model, start) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    }),
  });
  const latencyMs = Date.now() - start;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { success: false, error: body?.error?.message ?? `HTTP ${res.status}`, latencyMs };
  }
  return { success: true, latencyMs };
}

async function pingGoogle(apiKey, model, start) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: "ping" }] }],
      generationConfig: { maxOutputTokens: 1 },
    }),
  });
  const latencyMs = Date.now() - start;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return {
      success: false,
      error: body?.error?.message ?? `HTTP ${res.status}`,
      latencyMs,
    };
  }
  return { success: true, latencyMs };
}
