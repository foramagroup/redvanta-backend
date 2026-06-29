// ═══════════════════════════════════════════════════════════
// src/controllers/superadmin/blog.prompt-templates.controller.js
// CRUD ContentPromptTemplate — superadmin
// ═══════════════════════════════════════════════════════════

import prisma from "../../config/database.js";

// ── GET /api/superadmin/blog/prompt-templates ────────────────
export const listPromptTemplates = async (req, res, next) => {
  try {
    const templates = await prisma.contentPromptTemplate.findMany({
      orderBy: { createdAt: "asc" },
    });
    res.json({ success: true, data: templates });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/superadmin/blog/prompt-templates/:id ────────────
export const getPromptTemplate = async (req, res, next) => {
  try {
    const t = await prisma.contentPromptTemplate.findUnique({ where: { id: req.params.id } });
    if (!t) return res.status(404).json({ success: false, error: "Template not found" });
    res.json({ success: true, data: t });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/superadmin/blog/prompt-templates ───────────────
export const createPromptTemplate = async (req, res, next) => {
  try {
    const { name, prompt, active = true } = req.body;
    if (!name?.trim()) return res.status(422).json({ success: false, error: "Template name is required" });
    if (!prompt?.trim()) return res.status(422).json({ success: false, error: "Prompt content is required" });

    const t = await prisma.contentPromptTemplate.create({
      data: { name: name.trim(), prompt: prompt.trim(), active: Boolean(active) },
    });
    res.status(201).json({ success: true, data: t });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/superadmin/blog/prompt-templates/:id ────────────
export const updatePromptTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, prompt, active } = req.body;

    const existing = await prisma.contentPromptTemplate.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: "Template not found" });

    const t = await prisma.contentPromptTemplate.update({
      where: { id },
      data: {
        name:   name?.trim()   ?? existing.name,
        prompt: prompt?.trim() ?? existing.prompt,
        active: active !== undefined ? Boolean(active) : existing.active,
      },
    });
    res.json({ success: true, data: t });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/superadmin/blog/prompt-templates/:id/toggle ───
export const togglePromptTemplate = async (req, res, next) => {
  try {
    const existing = await prisma.contentPromptTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, error: "Template not found" });

    const t = await prisma.contentPromptTemplate.update({
      where: { id: req.params.id },
      data:  { active: !existing.active },
    });
    res.json({ success: true, data: t });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/superadmin/blog/prompt-templates/:id ─────────
export const deletePromptTemplate = async (req, res, next) => {
  try {
    await prisma.contentPromptTemplate.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Template deleted" });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ success: false, error: "Template not found" });
    }
    next(err);
  }
};
