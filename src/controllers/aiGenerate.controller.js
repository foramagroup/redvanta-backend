// ═══════════════════════════════════════════════════════════
// src/controllers/admin/aiGenerate.controller.js
// POST /api/admin/ai/generate  — cœur du module IA
//
// Flow :
//   1. Valide le body
//   2. Vérifie les crédits disponibles
//   3. Charge les paramètres IA de la company
//   4. Résout le fournisseur actif par défaut
//   5. Construit le prompt
//   6. Appelle l'IA (OpenAI / Anthropic / Google)
//   7. Transaction DB : log + usage mensuel + déduction crédit
//   8. Retourne la réponse + méta
// ═══════════════════════════════════════════════════════════

import prisma from "../config/database.js";

// ── Constantes ────────────────────────────────────────────────

const MAX_OUTPUT_TOKENS = 350;
const AI_TIMEOUT_MS     = 30_000;

// ── Entry point ───────────────────────────────────────────────

export async function generateReply(req, res) {
  const start = Date.now();
  const cid   = Number(req.user.companyId);

  const { reviewId, reviewText, reviewRating, reviewerName, action = "generate" } = req.body;

  if (!reviewText?.trim()) {
    return res.status(400).json({ success: false, error: "reviewText est requis" });
  }
  if (reviewRating !== undefined && (reviewRating < 1 || reviewRating > 5)) {
    return res.status(400).json({ success: false, error: "reviewRating doit être entre 1 et 5" });
  }

  // ── 1. Vérification crédits ────────────────────────────────
  const balance = await prisma.aiCreditBalance.findUnique({ where: { companyId: cid } });
  const totalCredits = (balance?.planIncluded ?? 0) + (balance?.purchased ?? 0);
  const usedCredits  = balance?.used ?? 0;
  const remaining    = Math.max(totalCredits - usedCredits, 0);

  if (remaining === 0) {
    return res.status(402).json({
      success: false,
      error:   "INSUFFICIENT_CREDITS",
      message: "Vous n'avez plus de crédits AI. Achetez un pack pour continuer.",
    });
  }

  // ── 2. Paramètres IA de la company ────────────────────────
  const settings = await prisma.aiSetting.findUnique({ where: { companyId: cid } }) ?? {
    language: "auto", tone: "professional", businessContext: null, signature: null,
  };

  // ── 3. Fournisseur actif ──────────────────────────────────
  const provider =
    await prisma.aiProvider.findFirst({ where: { isDefault: true, active: true } }) ??
    await prisma.aiProvider.findFirst({ where: { active: true } });

  if (!provider) {
    return res.status(503).json({
      success: false,
      error:   "NO_PROVIDER",
      message: "Aucun fournisseur IA n'est configuré. Contactez l'administrateur.",
    });
  }
  if (!provider.apiKey) {
    return res.status(503).json({
      success: false,
      error:   "MISSING_API_KEY",
      message: `Le fournisseur ${provider.displayName} n'a pas de clé API configurée.`,
    });
  }

  // Tarif actif pour ce fournisseur
  const costRow = await prisma.aiProviderCost.findFirst({
    where:   { providerId: provider.id, active: true },
    orderBy: { effectiveAt: "desc" },
  });

  // ── 4. Prompt ─────────────────────────────────────────────
  const { systemPrompt, userPrompt } = buildPrompt(settings, {
    reviewText,
    reviewRating: reviewRating ?? null,
    reviewerName: reviewerName ?? null,
  });

  // ── 5. Appel IA ───────────────────────────────────────────
  let aiResult;
  try {
    aiResult = await callProvider(provider, systemPrompt, userPrompt);
  } catch (callErr) {
    aiResult = { success: false, error: callErr.message };
  }

  const durationMs = Date.now() - start;

  if (!aiResult.success) {
    // Log l'échec sans débiter de crédit
    await prisma.aiRequestLog.create({
      data: {
        companyId:    cid,
        reviewId:     reviewId ?? null,
        providerId:   provider.id,
        model:        provider.model,
        status:       "failed",
        errorMessage: aiResult.error,
        durationMs,
      },
    }).catch(() => {}); // ne pas casser la réponse si le log échoue

    return res.status(502).json({
      success: false,
      error:   "AI_CALL_FAILED",
      message: `Le fournisseur IA a retourné une erreur : ${aiResult.error}`,
    });
  }

  const { reply: rawReply, inputTokens, outputTokens } = aiResult;
  const costUsd = costRow
    ? (inputTokens  / 1_000_000) * costRow.inputPer1M
    + (outputTokens / 1_000_000) * costRow.outputPer1M
    : 0;

  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  // ── 6. Transaction DB ─────────────────────────────────────
  await prisma.$transaction([
    // Log d'audit
    prisma.aiRequestLog.create({
      data: {
        companyId:    cid,
        reviewId:     reviewId ?? null,
        providerId:   provider.id,
        model:        provider.model,
        inputTokens,
        outputTokens,
        costUsd,
        status:       "success",
        durationMs,
      },
    }),

    // Compteur mensuel (upsert)
    prisma.aiUsageMonth.upsert({
      where:  { companyId_year_month: { companyId: cid, year, month } },
      create: {
        companyId: cid, year, month,
        generatedCount: 1,
        totalTokens:    inputTokens + outputTokens,
        totalCostUsd:   costUsd,
      },
      update: {
        generatedCount: { increment: 1 },
        totalTokens:    { increment: inputTokens + outputTokens },
        totalCostUsd:   { increment: costUsd },
      },
    }),

    // Déduction crédit
    prisma.aiCreditBalance.upsert({
      where:  { companyId: cid },
      create: { companyId: cid, used: 1 },
      update: { used: { increment: 1 } },
    }),

    // Ledger
    prisma.aiCreditTransaction.create({
      data: {
        companyId: cid,
        kind:      "spend",
        amount:    -1,
        costUsd,
        reviewId:  reviewId ?? null,
        meta:      { action, provider: provider.name, model: provider.model },
      },
    }),

    // Compteurs globaux du fournisseur
    prisma.aiProvider.update({
      where: { id: provider.id },
      data:  {
        totalRequests: { increment: 1 },
        totalTokens:   { increment: inputTokens + outputTokens },
      },
    }),
  ]);

  // Ajouter la signature si définie
  const finalReply = settings.signature?.trim()
    ? `${rawReply}\n\n${settings.signature.trim()}`
    : rawReply;

  return res.json({
    success: true,
    data: {
      reply:            finalReply,
      inputTokens,
      outputTokens,
      costUsd,
      creditsRemaining: remaining - 1,
      provider:         provider.name,
      model:            provider.model,
      durationMs,
    },
  });
}

// ── Prompt builder ────────────────────────────────────────────

function buildPrompt(settings, { reviewText, reviewRating, reviewerName }) {
  const businessCtx = settings.businessContext?.trim()
    ? `You represent: ${settings.businessContext.trim()}.`
    : "You represent a business.";

  const langInstruction = !settings.language || settings.language === "auto"
    ? "Detect the language of the review and reply in that same language."
    : `Reply in ${settings.language}.`;

  const systemPrompt = [
    "You are a professional customer relations manager writing responses to online reviews.",
    businessCtx,
    `Tone: ${settings.tone ?? "professional"}.`,
    langInstruction,
    "Keep your reply to 2–4 sentences.",
    "Be specific to what the customer mentioned — avoid generic filler.",
    "Do not mention the star rating explicitly.",
    "Do not wrap the reply in quotes.",
    "Return ONLY the reply text, nothing else.",
  ].join(" ");

  const ratingLine   = reviewRating ? `${reviewRating}-star review` : "review";
  const reviewerLine = reviewerName?.trim() ? ` from ${reviewerName}` : "";
  const userPrompt   = `Write a reply to this ${ratingLine}${reviewerLine}:\n\n"${reviewText.trim()}"`;

  return { systemPrompt, userPrompt };
}

// ── Dispatcher fournisseur ────────────────────────────────────

async function callProvider(provider, systemPrompt, userPrompt) {
  switch (provider.name) {
    case "openai":    return callOpenAI(provider, systemPrompt, userPrompt);
    case "anthropic": return callAnthropic(provider, systemPrompt, userPrompt);
    case "google":    return callGoogle(provider, systemPrompt, userPrompt);
    default:
      return { success: false, error: `Fournisseur inconnu : ${provider.name}` };
  }
}

// ── OpenAI ────────────────────────────────────────────────────

async function callOpenAI(provider, systemPrompt, userPrompt) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model:       provider.model,
      messages:    [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
      max_tokens:  MAX_OUTPUT_TOKENS,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { success: false, error: body?.error?.message ?? `HTTP ${res.status}` };
  }

  const data = await res.json();
  return {
    success:      true,
    reply:        data.choices[0].message.content.trim(),
    inputTokens:  data.usage.prompt_tokens,
    outputTokens: data.usage.completion_tokens,
  };
}

// ── Anthropic ─────────────────────────────────────────────────

async function callAnthropic(provider, systemPrompt, userPrompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers: {
      "x-api-key":        provider.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type":     "application/json",
    },
    body: JSON.stringify({
      model:      provider.model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system:     systemPrompt,
      messages:   [{ role: "user", content: userPrompt }],
    }),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { success: false, error: body?.error?.message ?? `HTTP ${res.status}` };
  }

  const data = await res.json();
  return {
    success:      true,
    reply:        data.content[0].text.trim(),
    inputTokens:  data.usage.input_tokens,
    outputTokens: data.usage.output_tokens,
  };
}

// ── Google Gemini ─────────────────────────────────────────────

async function callGoogle(provider, systemPrompt, userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${provider.apiKey}`;

  const res = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: {
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature:     0.7,
      },
    }),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { success: false, error: body?.error?.message ?? `HTTP ${res.status}` };
  }

  const data = await res.json();

  // Vérifier les safety blocks
  const candidate = data.candidates?.[0];
  if (!candidate || candidate.finishReason === "SAFETY") {
    return { success: false, error: "Réponse bloquée par les filtres de sécurité Google." };
  }

  return {
    success:      true,
    reply:        candidate.content.parts[0].text.trim(),
    inputTokens:  data.usageMetadata?.promptTokenCount      ?? 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount  ?? 0,
  };
}
