// ═══════════════════════════════════════════════════════════
// src/controllers/client/staticPages.controller.js
// ═══════════════════════════════════════════════════════════

import prisma from "../../config/database.js";

// ═══════════════════════════════════════════════════════════
// GET /api/pages/:slug?lang=fr
// Récupérer page par slug + langue
// ═══════════════════════════════════════════════════════════
export const getPageBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { lang = "en" } = req.query;

    // Trouver langue
    const language = await prisma.language.findFirst({
      where: {
        code: lang,
        status: "Active",
      },
    });

    if (!language) {
      return res.status(404).json({
        success: false,
        error: "Langue non trouvée",
      });
    }

    // Trouver traduction
    const translation = await prisma.staticPageTranslation.findFirst({
      where: {
        slug,
        languageId: language.id,
        page: {
          status: "published",
        },
      },
      include: {
        page: true,
        language: true,
      },
    });

    if (!translation) {
      return res.status(404).json({
        success: false,
        error: "Page introuvable",
      });
    }

    // Incrémenter vues
    await prisma.staticPage.update({
      where: { id: translation.pageId },
      data: { views: { increment: 1 } },
    });

    res.json({
      success: true,
      data: {
        slug: translation.slug,
        title: translation.title,
        content: translation.content,
        metaTitle: translation.metaTitle,
        metaDesc: translation.metaDesc,
        metaImage: translation.page.metaImage,
        language: {
          code: translation.language.code,
          name: translation.language.name,
        },
        publishedAt: translation.page.publishedAt,
        updatedAt: translation.updatedAt,
      },
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// GET /api/pages?lang=fr
// Liste pages publiées dans une langue
// ═══════════════════════════════════════════════════════════
export const listPublicPages = async (req, res, next) => {
  try {
    const { lang = "en" } = req.query;

    const language = await prisma.language.findFirst({
      where: { code: lang, status: "Active" },
    });

    if (!language) {
      return res.status(404).json({
        success: false,
        error: "Langue non trouvée",
      });
    }

    const translations = await prisma.staticPageTranslation.findMany({
      where: {
        languageId: language.id,
        page: { status: "published" },
      },
      select: {
        slug: true,
        title: true,
        page: {
          select: { updatedAt: true },
        },
      },
      orderBy: { title: "asc" },
    });

    res.json({
      success: true,
      data: translations.map(t => ({
        slug: t.slug,
        title: t.title,
        updatedAt: t.page.updatedAt,
      })),
    });
  } catch (e) {
    next(e);
  }
};