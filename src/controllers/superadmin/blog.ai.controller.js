// ═══════════════════════════════════════════════════════════
// src/controllers/superadmin/blog.ai.controller.js
// Génération IA d'articles de blog — superadmin
// ═══════════════════════════════════════════════════════════

import prisma from "../../config/database.js";

const AI_TIMEOUT_MS     = 60_000;
const MAX_OUTPUT_TOKENS = 4096;

// ── Dispatcher fournisseur (même logique que aiGenerate.controller) ──
async function callProvider(provider, systemPrompt, userPrompt) {
  switch (provider.name) {
    case "openai":    return callOpenAI(provider, systemPrompt, userPrompt);
    case "anthropic": return callAnthropic(provider, systemPrompt, userPrompt);
    case "google":    return callGoogle(provider, systemPrompt, userPrompt);
    default:
      return { success: false, error: `Unknown provider: ${provider.name}` };
  }
}

async function callOpenAI(provider, sys, user) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: provider.model,
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      max_tokens: MAX_OUTPUT_TOKENS, temperature: 0.7,
    }),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    return { success: false, error: b?.error?.message ?? `HTTP ${res.status}` };
  }
  const data = await res.json();
  return { success: true, reply: data.choices[0].message.content.trim(), inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens };
}

async function callAnthropic(provider, sys, user) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": provider.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model: provider.model, max_tokens: MAX_OUTPUT_TOKENS, system: sys, messages: [{ role: "user", content: user }] }),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    return { success: false, error: b?.error?.message ?? `HTTP ${res.status}` };
  }
  const data = await res.json();
  return { success: true, reply: data.content[0].text.trim(), inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens };
}

async function callGoogle(provider, sys, user) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${provider.apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: sys }] },
      contents: [{ parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.7 },
    }),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    return { success: false, error: b?.error?.message ?? `HTTP ${res.status}` };
  }
  const data = await res.json();
  const cand = data.candidates?.[0];
  if (!cand || cand.finishReason === "SAFETY") return { success: false, error: "Blocked by safety filters" };
  return { success: true, reply: cand.content.parts[0].text.trim(), inputTokens: data.usageMetadata?.promptTokenCount ?? 0, outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0 };
}

// ── POST /api/superadmin/blog/ai/generate ────────────────────
export const generateBlogContent = async (req, res, next) => {
  try {
    const { keyword, lang = "en", hubType, wordCount = 1500 } = req.body;

    if (!keyword?.trim()) {
      return res.status(422).json({ success: false, error: "keyword is required" });
    }

    const provider =
      await prisma.aiProvider.findFirst({ where: { isDefault: true, active: true } }) ??
      await prisma.aiProvider.findFirst({ where: { active: true } });

    if (!provider) {
      return res.status(503).json({ success: false, error: "NO_PROVIDER", message: "No AI provider configured" });
    }
    if (!provider.apiKey) {
      return res.status(503).json({ success: false, error: "MISSING_API_KEY", message: `Provider ${provider.displayName} has no API key` });
    }

    const systemPrompt = `You are an expert SEO content writer for Opinoor, a SaaS platform that sells NFC review cards and QR code review systems for businesses (restaurants, hotels, salons, clinics).

Your task: write a complete, SEO-optimized blog article.

Rules:
- Target keyword must appear naturally in H1, first paragraph, and 2-3 more times
- Use H2 and H3 subheadings throughout
- Include a FAQ section at the end with 3-5 questions (format: ## FAQ\\n### Q: ... \\n**A:** ...)
- Include 3 CTAs linking to Opinoor products (NFC card, QR stand, demo)
- Word count: approximately ${wordCount} words
- Tone: professional but accessible
- Write in ${lang === "fr" ? "French" : lang === "es" ? "Spanish" : lang === "de" ? "German" : "English"}
- Return JSON with this exact structure:
{
  "title": "SEO-optimized title",
  "metaTitle": "Meta title (max 60 chars)",
  "metaDescription": "Meta description (max 160 chars)",
  "excerpt": "Short excerpt (max 240 chars)",
  "slug": "url-slug-from-title",
  "content": "<full HTML article>",
  "faqs": [{"question": "...", "answer": "..."}],
  "readTime": "X min read"
}`;

    const hubContext = hubType ? `This article belongs to the "${hubType}" content hub.` : "";
    const userPrompt = `Write a complete blog article for the keyword: "${keyword.trim()}".\n${hubContext}\nReturn only valid JSON, no markdown wrapper.`;

    const result = await callProvider(provider, systemPrompt, userPrompt);

    if (!result.success) {
      return res.status(502).json({ success: false, error: "AI_FAILED", message: result.error });
    }

    // Parse JSON from AI response
    let parsed;
    try {
      const raw = result.reply.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      parsed = JSON.parse(raw);
    } catch {
      return res.status(502).json({
        success: false,
        error: "PARSE_FAILED",
        message: "AI returned non-JSON response",
        raw: result.reply.slice(0, 500),
      });
    }

    res.json({
      success: true,
      data: {
        title:           parsed.title           ?? "",
        metaTitle:       parsed.metaTitle        ?? "",
        metaDescription: parsed.metaDescription  ?? "",
        excerpt:         parsed.excerpt          ?? "",
        slug:            parsed.slug             ?? "",
        content:         parsed.content          ?? "",
        faqs:            Array.isArray(parsed.faqs) ? parsed.faqs : [],
        readTime:        parsed.readTime         ?? "5 min read",
        keyword:         keyword.trim(),
        inputTokens:     result.inputTokens,
        outputTokens:    result.outputTokens,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/superadmin/blog/ai/generate-bulk ───────────────
export const generateBlogBulk = async (req, res, next) => {
  try {
    const { keywords = [], lang = "en", hubType } = req.body;
    if (!keywords.length) {
      return res.status(422).json({ success: false, error: "keywords array is required" });
    }
    if (keywords.length > 10) {
      return res.status(422).json({ success: false, error: "Max 10 keywords per bulk request" });
    }

    const provider =
      await prisma.aiProvider.findFirst({ where: { isDefault: true, active: true } }) ??
      await prisma.aiProvider.findFirst({ where: { active: true } });

    if (!provider?.apiKey) {
      return res.status(503).json({ success: false, error: "NO_PROVIDER" });
    }

    const results = [];
    for (const keyword of keywords) {
      try {
        const sysP = `You are an SEO content writer for Opinoor (NFC review cards SaaS). Write a blog article outline with meta for keyword: "${keyword}". Return JSON: {"title":"...","metaTitle":"...","metaDescription":"...","excerpt":"...","slug":"...","readTime":"X min read"}. Only JSON.`;
        const r = await callProvider(provider, sysP, `Keyword: "${keyword}"`);
        if (r.success) {
          const raw = r.reply.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
          const p = JSON.parse(raw);
          results.push({ keyword, ...p, status: "ready" });
        } else {
          results.push({ keyword, status: "failed", error: r.error });
        }
      } catch {
        results.push({ keyword, status: "failed", error: "Parse error" });
      }
    }

    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
};
