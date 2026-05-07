// ═══════════════════════════════════════════════════════════
// src/controllers/client/faqs.controller.js
// FAQs publiques (affichage frontend)
// ═══════════════════════════════════════════════════════════

import prisma from "../../config/database.js";

// ═══════════════════════════════════════════════════════════
// GET /api/faqs?lang=en&categorySlug=general
// Liste FAQs publiées
// ═══════════════════════════════════════════════════════════
export const listPublicFAQs = async (req, res, next) => {
  try {
    const { lang = "en", categorySlug } = req.query;

    const language = await prisma.language.findFirst({
      where: { code: lang, status: "Active" },
    });

    if (!language) {
      return res.status(404).json({
        success: false,
        error: "Langue non trouvée",
      });
    }

    const where = {
      status: "published",
    };

    // Filtrer par slug de catégorie
    if (categorySlug && categorySlug !== "all") {
      const category = await prisma.fAQCategory.findUnique({
        where: { slug: categorySlug },
      });

      if (category) {
        where.categoryId = category.id;
      }
    }

    const faqs = await prisma.fAQ.findMany({
      where,
      include: {
        category: {
          include: {
            translations: {
              where: { languageId: language.id },
            },
          },
        },
        translations: {
          where: { languageId: language.id },
        },
      },
      orderBy: { displayOrder: "asc" },
    });

    res.json({
      success: true,
      data: faqs
        .filter(f => f.translations.length > 0)
        .map(f => ({
          id: f.id,
          categoryId: f.categoryId,
          categorySlug: f.category?.slug,
          categoryName: f.category?.translations[0]?.name || f.category?.slug,
          displayOrder: f.displayOrder,
          views: f.views,
          helpful: f.helpful,
          notHelpful: f.notHelpful,
          question: f.translations[0].question,
          answer: f.translations[0].answer,
        })),
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// GET /api/faqs/:id?lang=en
// Détails FAQ (avec incrémentation vues)
// ═══════════════════════════════════════════════════════════
export const getFAQPublic = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
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

    const faq = await prisma.fAQ.findFirst({
      where: {
        id,
        status: "published",
      },
      include: {
        category: {
          include: {
            translations: {
              where: { languageId: language.id },
            },
          },
        },
        translations: {
          where: { languageId: language.id },
        },
      },
    });

    if (!faq || faq.translations.length === 0) {
      return res.status(404).json({
        success: false,
        error: "FAQ introuvable",
      });
    }

    // Incrémenter vues
    await prisma.fAQ.update({
      where: { id },
      data: { views: { increment: 1 } },
    });

    const translation = faq.translations[0];

    res.json({
      success: true,
      data: {
        id: faq.id,
        categoryId: faq.categoryId,
        categorySlug: faq.category?.slug,
        categoryName: faq.category?.translations[0]?.name || faq.category?.slug,
        question: translation.question,
        answer: translation.answer,
        metaTitle: translation.metaTitle,
        metaDesc: translation.metaDesc,
        helpful: faq.helpful,
        notHelpful: faq.notHelpful,
      },
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// POST /api/faqs/:id/feedback
// Voter "helpful" ou "not helpful"
// Body: { helpful: true | false }
// ═══════════════════════════════════════════════════════════
export const voteFAQ = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { helpful } = req.body;

    if (typeof helpful !== "boolean") {
      return res.status(422).json({
        success: false,
        error: "helpful requis (boolean)",
      });
    }

    const faq = await prisma.fAQ.findUnique({
      where: { id },
    });

    if (!faq) {
      return res.status(404).json({
        success: false,
        error: "FAQ introuvable",
      });
    }

    await prisma.fAQ.update({
      where: { id },
      data: {
        [helpful ? "helpful" : "notHelpful"]: {
          increment: 1,
        },
      },
    });

    res.json({
      success: true,
      message: "Merci pour votre feedback",
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// GET /api/faqs/categories?lang=en
// Liste des catégories disponibles (avec traductions)
// ═══════════════════════════════════════════════════════════
export const getFAQCategories = async (req, res, next) => {
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

    // Récupérer catégories avec FAQs publiées
    const categoriesWithFAQs = await prisma.fAQ.groupBy({
      by: ["categoryId"],
      where: { status: "published" },
      _count: true,
    });

    const categoryIds = categoriesWithFAQs.map(c => c.categoryId);

    // Récupérer détails des catégories
    const categories = await prisma.fAQCategory.findMany({
      where: {
        id: { in: categoryIds },
      },
      include: {
        translations: {
          where: { languageId: language.id },
        },
      },
      orderBy: { displayOrder: "asc" },
    });

    // Map avec compteurs
    const countMap = Object.fromEntries(
      categoriesWithFAQs.map(c => [c.categoryId, c._count])
    );

    res.json({
      success: true,
      data: categories.map(cat => ({
        id: cat.id,
        slug: cat.slug,
        name: cat.translations[0]?.name || cat.slug,
        count: countMap[cat.id] || 0,
      })),
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// GET /api/faqs/search?q=keyword&lang=en
// Recherche dans les FAQs
// ═══════════════════════════════════════════════════════════
export const searchFAQs = async (req, res, next) => {
  try {
    const { q, lang = "en" } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(422).json({
        success: false,
        error: "Recherche trop courte (min 2 caractères)",
      });
    }

    const language = await prisma.language.findFirst({
      where: { code: lang, status: "Active" },
    });

    if (!language) {
      return res.status(404).json({
        success: false,
        error: "Langue non trouvée",
      });
    }

    const faqs = await prisma.fAQ.findMany({
      where: {
        status: "published",
        translations: {
          some: {
            languageId: language.id,
            OR: [
              { question: { contains: q } },
              { answer: { contains: q } },
            ],
          },
        },
      },
      include: {
        category: {
          include: {
            translations: {
              where: { languageId: language.id },
            },
          },
        },
        translations: {
          where: { languageId: language.id },
        },
      },
      orderBy: { views: "desc" },
      take: 20,
    });

    res.json({
      success: true,
      data: faqs
        .filter(f => f.translations.length > 0)
        .map(f => ({
          id: f.id,
          categoryId: f.categoryId,
          categorySlug: f.category?.slug,
          categoryName: f.category?.translations[0]?.name || f.category?.slug,
          question: f.translations[0].question,
          answer: f.translations[0].answer,
          views: f.views,
          helpful: f.helpful,
        })),
    });
  } catch (e) {
    next(e);
  }
};