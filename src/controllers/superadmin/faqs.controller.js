// ═══════════════════════════════════════════════════════════
// src/controllers/superadmin/faqs.controller.js
// Gestion FAQ (Questions Fréquentes)
// ═══════════════════════════════════════════════════════════

import prisma from "../../config/database.js";

// ═══════════════════════════════════════════════════════════
// GET /api/superadmin/faqs
// Liste toutes les FAQs avec filtres
// ═══════════════════════════════════════════════════════════
export const listFAQs = async (req, res, next) => {
  try {
    const { 
      status, 
      categoryId, 
      search, 
      page = 1, 
      limit = 50 
    } = req.query;

    const where = {};

    if (status) {
      where.status = status;
    }

    if (categoryId) {
      where.categoryId = parseInt(categoryId);
    }

    if (search) {
      where.translations = {
        some: {
          OR: [
            { question: { contains: search } },
            { answer: { contains: search } },
          ],
        },
      };
    }

    const [faqs, total] = await Promise.all([
      prisma.fAQ.findMany({
        where,
        include: {
          category: {
            include: {
              translations: { include: { language: true } },
            },
          },
          translations: {
            include: { language: true },
          },
        },
        orderBy: { displayOrder: "asc" },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.fAQ.count({ where }),
    ]);

    res.json({
      success: true,
      data: faqs.map(formatFAQ),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// GET /api/superadmin/faqs/:id
// Détails d'une FAQ
// ═══════════════════════════════════════════════════════════
export const getFAQ = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    const faq = await prisma.fAQ.findUnique({
      where: { id },
      include: {
        category: {
          include: {
            translations: { include: { language: true } },
          },
        },
        translations: {
          include: { language: true },
        },
      },
    });

    if (!faq) {
      return res.status(404).json({
        success: false,
        error: req.t("faq.not_found"),
      });
    }

    res.json({
      success: true,
      data: formatFAQ(faq),
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// POST /api/superadmin/faqs
// Créer une FAQ
// Body: {
//   categoryId: 1,
//   status: "draft",
//   displayOrder: 1,
//   translations: [
//     { languageId: 1, question: "...", answer: "..." },
//     { languageId: 2, question: "...", answer: "..." }
//   ]
// }
// ═══════════════════════════════════════════════════════════
export const createFAQ = async (req, res, next) => {
  try {
    const {
      categoryId,
      status = "draft",
      displayOrder,
      translations,
    } = req.body;

    // Validation
    if (!categoryId || !translations || translations.length === 0) {
      return res.status(422).json({
        success: false,
        error: req.t("superadmin.faq.category_id_required"),
      });
    }

    // Vérifier que la catégorie existe
    const category = await prisma.fAQCategory.findUnique({
      where: { id: parseInt(categoryId) },
    });

    if (!category) {
      return res.status(422).json({
        success: false,
        error: req.t("superadmin.faq.invalid_category"),
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
        error: req.t("superadmin.faq.invalid_languages"),
      });
    }

    // Calculer displayOrder si non fourni
    let order = displayOrder;
    if (!order) {
      const maxOrder = await prisma.fAQ.aggregate({
        _max: { displayOrder: true },
      });
      order = (maxOrder._max.displayOrder || 0) + 1;
    }

    // Transaction
    const faq = await prisma.$transaction(async (tx) => {
      const created = await tx.fAQ.create({
        data: {
          categoryId: parseInt(categoryId),
          status,
          displayOrder: order,
          publishedAt: status === "published" ? new Date() : null,
        },
      });

      await tx.fAQTranslation.createMany({
        data: translations.map(t => ({
          faqId: created.id,
          languageId: t.languageId,
          question: t.question,
          answer: t.answer,
          metaTitle: t.metaTitle,
          metaDesc: t.metaDesc,
        })),
      });

      return tx.fAQ.findUnique({
        where: { id: created.id },
        include: {
          category: {
            include: {
              translations: { include: { language: true } },
            },
          },
          translations: { include: { language: true } },
        },
      });
    });

    res.status(201).json({
      success: true,
      message: req.t("superadmin.faq.created"),
      data: formatFAQ(faq),
    });
  } catch (e) {
    next(e);
  }
};


// ═══════════════════════════════════════════════════════════
// GET /api/superadmin/faq-categories/select
// Liste simplifiée pour les selects (formulaires)
// ═══════════════════════════════════════════════════════════
export const getFAQCategoriesForSelect = async (req, res, next) => {
  try {
    const { lang = "en" } = req.query;

    // Récupérer langue
    const language = await prisma.language.findFirst({
      where: {
        OR: [
          { code: lang },
          { isDefault: true },
        ],
      },
    });

    if (!language) {
      return res.status(404).json({
        success: false,
        error: req.t("faq.language_not_found"),
      });
    }

    const categories = await prisma.fAQCategory.findMany({
      include: {
        translations: {
          where: { languageId: language.id },
        },
        _count: {
          select: { faqs: true },
        },
      },
      orderBy: { displayOrder: "asc" },
    });

    // Retourner format simplifié pour select
    res.json({
      success: true,
      data: categories.map(cat => ({
        id: cat.id,
        slug: cat.slug,
        name: cat.translations[0]?.name || cat.slug,
        faqCount: cat._count.faqs,
      })),
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// PUT /api/superadmin/faqs/:id
// Mettre à jour une FAQ
// ═══════════════════════════════════════════════════════════
export const updateFAQ = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const {
      categoryId,
      status,
      displayOrder,
      translations,
    } = req.body;

    const existing = await prisma.fAQ.findUnique({
      where: { id },
      include: { translations: true },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: req.t("faq.not_found"),
      });
    }

    // Vérifier catégorie si fournie
    if (categoryId) {
      const category = await prisma.fAQCategory.findUnique({
        where: { id: parseInt(categoryId) },
      });

      if (!category) {
        return res.status(422).json({
          success: false,
          error: req.t("superadmin.faq.invalid_category"),
        });
      }
    }

    const faq = await prisma.$transaction(async (tx) => {
      // Update FAQ
      const updateData = {};
      
      if (categoryId !== undefined) {
        updateData.categoryId = parseInt(categoryId);
      }
      
      if (displayOrder !== undefined) {
        updateData.displayOrder = displayOrder;
      }

      if (status !== undefined) {
        updateData.status = status;

        if (status === "published" && !existing.publishedAt) {
          updateData.publishedAt = new Date();
        } else if (status === "draft") {
          updateData.publishedAt = null;
        }
      }

      await tx.fAQ.update({
        where: { id },
        data: updateData,
      });

      // Update translations
      if (translations && translations.length > 0) {
        for (const t of translations) {
          await tx.fAQTranslation.upsert({
            where: {
              faqId_languageId: {
                faqId: id,
                languageId: t.languageId,
              },
            },
            update: {
              question: t.question,
              answer: t.answer,
              metaTitle: t.metaTitle,
              metaDesc: t.metaDesc,
            },
            create: {
              faqId: id,
              languageId: t.languageId,
              question: t.question,
              answer: t.answer,
              metaTitle: t.metaTitle,
              metaDesc: t.metaDesc,
            },
          });
        }
      }

      return tx.fAQ.findUnique({
        where: { id },
        include: {
          category: {
            include: {
              translations: { include: { language: true } },
            },
          },
          translations: { include: { language: true } },
        },
      });
    });

    res.json({
      success: true,
      message: req.t("superadmin.faq.updated"),
      data: formatFAQ(faq),
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// DELETE /api/superadmin/faqs/:id
// Supprimer une FAQ
// ═══════════════════════════════════════════════════════════
export const deleteFAQ = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    const faq = await prisma.fAQ.findUnique({
      where: { id },
      include: { translations: true },
    });

    if (!faq) {
      return res.status(404).json({
        success: false,
        error: req.t("faq.not_found"),
      });
    }

    await prisma.fAQ.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: req.t("superadmin.faq.deleted"),
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// POST /api/superadmin/faqs/bulk
// Actions en masse (bulk actions)
// Body: {
//   ids: [1, 2, 3],
//   action: "publish" | "unpublish" | "delete" | "category:1"
// }
// ═══════════════════════════════════════════════════════════
export const bulkActionFAQs = async (req, res, next) => {
  try {
    const { ids, action } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(422).json({
        success: false,
        error: req.t("superadmin.faq.ids_required"),
      });
    }

    if (!action) {
      return res.status(422).json({
        success: false,
        error: req.t("superadmin.faq.action_required"),
      });
    }

    const faqIds = ids.map(Number);

    let result;

    switch (action) {
      case "publish":
        result = await prisma.fAQ.updateMany({
          where: { id: { in: faqIds } },
          data: { 
            status: "published",
            publishedAt: new Date(),
          },
        });
        break;

      case "unpublish":
        result = await prisma.fAQ.updateMany({
          where: { id: { in: faqIds } },
          data: { 
            status: "draft",
            publishedAt: null,
          },
        });
        break;

      case "delete":
        result = await prisma.fAQ.deleteMany({
          where: { id: { in: faqIds } },
        });
        break;

      default:
        // Changement de catégorie (ex: "category:1")
        if (action.startsWith("category:")) {
          const categoryId = parseInt(action.replace("category:", ""));
          
          const category = await prisma.fAQCategory.findUnique({
            where: { id: categoryId },
          });

          if (!category) {
            return res.status(422).json({
              success: false,
              error: req.t("superadmin.faq.invalid_category"),
            });
          }

          result = await prisma.fAQ.updateMany({
            where: { id: { in: faqIds } },
            data: { categoryId },
          });
        } else {
          return res.status(422).json({
            success: false,
            error: req.t("superadmin.faq.invalid_action"),
          });
        }
    }

    res.json({
      success: true,
      message: req.t("superadmin.faq.bulk_updated", { count: result.count }),
      data: { count: result.count },
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// POST /api/superadmin/faqs/reorder
// Réorganiser l'ordre des FAQs (drag & drop)
// Body: {
//   orders: [{ id: 1, order: 3 }, { id: 2, order: 1 }, ...]
// }
// ═══════════════════════════════════════════════════════════
export const reorderFAQs = async (req, res, next) => {
  try {
    const { orders } = req.body;

    if (!orders || !Array.isArray(orders)) {
      return res.status(422).json({
        success: false,
        error: req.t("superadmin.faq.orders_required"),
      });
    }

    await prisma.$transaction(
      orders.map(({ id, order }) =>
        prisma.fAQ.update({
          where: { id: parseInt(id) },
          data: { displayOrder: parseInt(order) },
        })
      )
    );

    res.json({
      success: true,
      message: req.t("superadmin.faq.order_updated"),
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// GET /api/superadmin/faqs/stats
// Statistiques FAQs
// ═══════════════════════════════════════════════════════════
export const getFAQsStats = async (req, res, next) => {
  try {
    const [
      total,
      published,
      draft,
      totalViews,
      byCategory,
      byLanguage,
    ] = await Promise.all([
      prisma.fAQ.count(),
      prisma.fAQ.count({ where: { status: "published" } }),
      prisma.fAQ.count({ where: { status: "draft" } }),
      prisma.fAQ.aggregate({ _sum: { views: true } }),
      prisma.fAQ.groupBy({
        by: ["categoryId"],
        _count: true,
      }),
      prisma.fAQTranslation.groupBy({
        by: ["languageId"],
        _count: true,
      }),
    ]);

    // Récupérer noms des catégories
    const categoryIds = byCategory.map(c => c.categoryId);
    const categories = await prisma.fAQCategory.findMany({
      where: { id: { in: categoryIds } },
      include: {
        translations: {
          where: {
            language: { isDefault: true },
          },
        },
      },
    });

    const categoryMap = Object.fromEntries(
      categories.map(c => [
        c.id, 
        { 
          slug: c.slug, 
          name: c.translations[0]?.name || c.slug 
        }
      ])
    );

    // Récupérer noms des langues
    const languageIds = byLanguage.map(l => l.languageId);
    const languages = await prisma.language.findMany({
      where: { id: { in: languageIds } },
      select: { id: true, code: true, name: true },
    });

    const languageMap = Object.fromEntries(
      languages.map(l => [l.id, { code: l.code, name: l.name }])
    );

    res.json({
      success: true,
      data: {
        total,
        published,
        draft,
        totalViews: totalViews._sum.views || 0,
        byCategory: byCategory.map(c => ({
          categoryId: c.categoryId,
          categorySlug: categoryMap[c.categoryId]?.slug || "unknown",
          categoryName: categoryMap[c.categoryId]?.name || "Unknown",
          count: c._count,
        })),
        byLanguage: byLanguage.map(l => ({
          languageId: l.languageId,
          languageCode: languageMap[l.languageId]?.code || "unknown",
          languageName: languageMap[l.languageId]?.name || "Unknown",
          count: l._count,
        })),
      },
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// Helper: Formater FAQ
// ═══════════════════════════════════════════════════════════
function formatFAQ(faq) {
  return {
    id: faq.id,
    categoryId: faq.categoryId,
    category: faq.category ? {
      id: faq.category.id,
      slug: faq.category.slug,
      translations: faq.category.translations?.map(t => ({
        languageId: t.languageId,
        languageCode: t.language?.code,
        name: t.name,
      })),
    } : null,
    displayOrder: faq.displayOrder,
    status: faq.status,
    views: faq.views,
    helpful: faq.helpful,
    notHelpful: faq.notHelpful,
    createdAt: faq.createdAt,
    updatedAt: faq.updatedAt,
    publishedAt: faq.publishedAt,
    translations: faq.translations?.map(t => ({
      id: t.id,
      languageId: t.languageId,
      languageCode: t.language?.code,
      languageName: t.language?.name,
      question: t.question,
      answer: t.answer,
      metaTitle: t.metaTitle,
      metaDesc: t.metaDesc,
    })) || [],
  };
}