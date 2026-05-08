// ═══════════════════════════════════════════════════════════
// src/controllers/superadmin/faqCategories.controller.js
// Gestion des catégories FAQ
// ═══════════════════════════════════════════════════════════

import prisma from "../../config/database.js";

// ═══════════════════════════════════════════════════════════
// GET /api/superadmin/faq-categories
// Liste toutes les catégories
// ═══════════════════════════════════════════════════════════
export const listFAQCategories = async (req, res, next) => {
  try {
    const categories = await prisma.fAQCategory.findMany({
      include: {
        translations: {
          include: { language: true },
        },
        _count: {
          select: { faqs: true },
        },
      },
      orderBy: { displayOrder: "asc" },
    });

    res.json({
      success: true,
      data: categories.map(formatCategory),
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// GET /api/superadmin/faq-categories/:id
// Détails d'une catégorie
// ═══════════════════════════════════════════════════════════
export const getFAQCategory = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    const category = await prisma.fAQCategory.findUnique({
      where: { id },
      include: {
        translations: {
          include: { language: true },
        },
        _count: {
          select: { faqs: true },
        },
      },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: req.t("superadmin.faq_category.not_found"),
      });
    }

    res.json({
      success: true,
      data: formatCategory(category),
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// POST /api/superadmin/faq-categories
// Créer une catégorie
// Body: {
//   slug: "custom-category",
//   displayOrder: 10,
//   translations: [
//     { languageId: 1, name: "Custom Category" },
//     { languageId: 2, name: "Catégorie Personnalisée" }
//   ]
// }
// ═══════════════════════════════════════════════════════════
export const createFAQCategory = async (req, res, next) => {
  try {
    const { slug, displayOrder, translations } = req.body;

    // Validation
    if (!slug || !translations || translations.length === 0) {
      return res.status(422).json({
        success: false,
        error: req.t("superadmin.faq_category.fields_required"),
      });
    }

    // Vérifier slug unique
    const existing = await prisma.fAQCategory.findUnique({
      where: { slug },
    });

    if (existing) {
      return res.status(422).json({
        success: false,
        error: `Le slug "${slug}" existe déjà`,
      });
    }

    // Valider slug
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.status(422).json({
        success: false,
        error: req.t("superadmin.faq_category.invalid_slug"),
      });
    }

    // Vérifier langues
    const languageIds = translations.map(t => t.languageId);
    const languages = await prisma.language.findMany({
      where: { id: { in: languageIds } },
    });

    if (languages.length !== languageIds.length) {
      return res.status(422).json({
        success: false,
        error: req.t("superadmin.faq_category.invalid_languages"),
      });
    }

    // Calculer displayOrder si non fourni
    let order = displayOrder;
    if (!order) {
      const maxOrder = await prisma.fAQCategory.aggregate({
        _max: { displayOrder: true },
      });
      order = (maxOrder._max.displayOrder || 0) + 1;
    }

    // Transaction
    const category = await prisma.$transaction(async (tx) => {
      const created = await tx.fAQCategory.create({
        data: {
          slug,
          displayOrder: order,
        },
      });

      await tx.fAQCategoryTranslation.createMany({
        data: translations.map(t => ({
          categoryId: created.id,
          languageId: t.languageId,
          name: t.name,
        })),
      });

      return tx.fAQCategory.findUnique({
        where: { id: created.id },
        include: {
          translations: { include: { language: true } },
          _count: { select: { faqs: true } },
        },
      });
    });

    res.status(201).json({
      success: true,
      message: req.t("superadmin.faq_category.created"),
      data: formatCategory(category),
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// PUT /api/superadmin/faq-categories/:id
// Mettre à jour une catégorie
// ═══════════════════════════════════════════════════════════
export const updateFAQCategory = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { slug, displayOrder, translations } = req.body;

    const existing = await prisma.fAQCategory.findUnique({
      where: { id },
      include: { translations: true },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: req.t("superadmin.faq_category.not_found"),
      });
    }

    // Vérifier slug unique si modifié
    if (slug && slug !== existing.slug) {
      const slugExists = await prisma.fAQCategory.findUnique({
        where: { slug },
      });

      if (slugExists) {
        return res.status(422).json({
          success: false,
          error: `Le slug "${slug}" existe déjà`,
        });
      }
    }

    const category = await prisma.$transaction(async (tx) => {
      // Update category
      const updateData = {};
      if (slug !== undefined) updateData.slug = slug;
      if (displayOrder !== undefined) updateData.displayOrder = displayOrder;

      await tx.fAQCategory.update({
        where: { id },
        data: updateData,
      });

      // Update translations
      if (translations && translations.length > 0) {
        for (const t of translations) {
          await tx.fAQCategoryTranslation.upsert({
            where: {
              categoryId_languageId: {
                categoryId: id,
                languageId: t.languageId,
              },
            },
            update: {
              name: t.name,
            },
            create: {
              categoryId: id,
              languageId: t.languageId,
              name: t.name,
            },
          });
        }
      }

      return tx.fAQCategory.findUnique({
        where: { id },
        include: {
          translations: { include: { language: true } },
          _count: { select: { faqs: true } },
        },
      });
    });

    res.json({
      success: true,
      message: req.t("superadmin.faq_category.updated"),
      data: formatCategory(category),
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// DELETE /api/superadmin/faq-categories/:id
// Supprimer une catégorie
// ═══════════════════════════════════════════════════════════
export const deleteFAQCategory = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    const category = await prisma.fAQCategory.findUnique({
      where: { id },
      include: {
        _count: { select: { faqs: true } },
      },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: req.t("superadmin.faq_category.not_found"),
      });
    }

    // Empêcher suppression si des FAQs existent
    if (category._count.faqs > 0) {
      return res.status(422).json({
        success: false,
        error: req.t("superadmin.faq_category.cannot_delete_has_faqs", { count: category._count.faqs }),
      });
    }

    await prisma.fAQCategory.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: req.t("superadmin.faq_category.deleted"),
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// POST /api/superadmin/faq-categories/reorder
// Réorganiser ordre
// Body: {
//   orders: [{ id: 1, order: 3 }, { id: 2, order: 1 }]
// }
// ═══════════════════════════════════════════════════════════
export const reorderFAQCategories = async (req, res, next) => {
  try {
    const { orders } = req.body;

    if (!orders || !Array.isArray(orders)) {
      return res.status(422).json({
        success: false,
        error: req.t("superadmin.faq_category.orders_required"),
      });
    }

    await prisma.$transaction(
      orders.map(({ id, order }) =>
        prisma.fAQCategory.update({
          where: { id: parseInt(id) },
          data: { displayOrder: parseInt(order) },
        })
      )
    );

    res.json({
      success: true,
      message: req.t("superadmin.faq_category.order_updated"),
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// Helper
// ═══════════════════════════════════════════════════════════
function formatCategory(category) {
  return {
    id: category.id,
    slug: category.slug,
    displayOrder: category.displayOrder,
    faqCount: category._count?.faqs || 0,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
    translations: category.translations?.map(t => ({
      id: t.id,
      languageId: t.languageId,
      languageCode: t.language?.code,
      languageName: t.language?.name,
      name: t.name,
    })) || [],
  };
}