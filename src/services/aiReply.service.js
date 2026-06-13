import prisma from "../config/database.js";

const MAX_OUTPUT_TOKENS = 350;
const AI_TIMEOUT_MS = 30_000;

export async function generateAiReply({ review, tone = "professional", language = "auto" }) {
  const provider =
    await prisma.aiProvider.findFirst({ where: { isDefault: true, active: true } }) ??
    await prisma.aiProvider.findFirst({ where: { active: true } });

  if (!provider?.apiKey) throw new Error("No active AI provider configured");

  const langInstruction = !language || language === "auto"
    ? "Detect the language of the review and reply in that same language."
    : `Reply in ${language}.`;

  const systemPrompt = [
    "You are a professional customer relations manager writing responses to online reviews.",
    `Tone: ${tone}.`,
    langInstruction,
    "Keep your reply to 2–4 sentences.",
    "Be specific to what the customer mentioned — avoid generic filler.",
    "Do not mention the star rating explicitly.",
    "Do not wrap the reply in quotes.",
    "Return ONLY the reply text, nothing else.",
  ].join(" ");

  const ratingLine = review.rating ? `${review.rating}-star review` : "review";
  const reviewerLine = review.authorName?.trim() ? ` from ${review.authorName}` : "";
  const userPrompt = `Write a reply to this ${ratingLine}${reviewerLine}:\n\n"${(review.comment ?? "").trim()}"`;

  const result = await callProvider(provider, systemPrompt, userPrompt);
  if (!result.success) throw new Error(result.error);
  return result.reply;
}

async function callProvider(provider, systemPrompt, userPrompt) {
  switch (provider.name) {
    case "openai":    return callOpenAI(provider, systemPrompt, userPrompt);
    case "anthropic": return callAnthropic(provider, systemPrompt, userPrompt);
    case "google":    return callGoogle(provider, systemPrompt, userPrompt);
    default:          return { success: false, error: `Unknown provider: ${provider.name}` };
  }
}

async function callOpenAI(provider, systemPrompt, userPrompt) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: provider.model,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { success: false, error: body?.error?.message ?? `HTTP ${res.status}` };
  }
  const data = await res.json();
  return { success: true, reply: data.choices[0].message.content.trim() };
}

async function callAnthropic(provider, systemPrompt, userPrompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": provider.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { success: false, error: body?.error?.message ?? `HTTP ${res.status}` };
  }
  const data = await res.json();
  return { success: true, reply: data.content[0].text.trim() };
}

async function callGoogle(provider, systemPrompt, userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${provider.apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.7 },
    }),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { success: false, error: body?.error?.message ?? `HTTP ${res.status}` };
  }
  const data = await res.json();
  const candidate = data.candidates?.[0];
  if (!candidate || candidate.finishReason === "SAFETY") {
    return { success: false, error: "Blocked by Google safety filters" };
  }
  return { success: true, reply: candidate.content.parts[0].text.trim() };
}
