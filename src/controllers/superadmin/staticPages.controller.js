// ═══════════════════════════════════════════════════════════
// src/controllers/superadmin/staticPages.controller.js
// ═══════════════════════════════════════════════════════════

import prisma from "../../config/database.js";

// ═══════════════════════════════════════════════════════════
// GET /api/superadmin/pages
// Liste toutes les pages (avec traductions)
// ═══════════════════════════════════════════════════════════
export const listPages = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;

    const where = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.translations = {
        some: {
          OR: [
            { title: { contains: search } },
            { slug: { contains: search } },
            { content: { contains: search } },
          ],
        },
      };
    }

    const [pages, total] = await Promise.all([
      prisma.staticPage.findMany({
        where,
        include: {
          translations: {
            include: { language: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.staticPage.count({ where }),
    ]);

    res.json({
      success: true,
      data: pages.map(formatPage),
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
// GET /api/superadmin/pages/:id
// Détails d'une page avec toutes ses traductions
// ═══════════════════════════════════════════════════════════
export const getPage = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    const page = await prisma.staticPage.findUnique({
      where: { id },
      include: {
        translations: {
          include: { language: true },
        },
      },
    });

    if (!page) {
      return res.status(404).json({
        success: false,
        error: "Page introuvable",
      });
    }

    res.json({
      success: true,
      data: formatPage(page),
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// POST /api/superadmin/pages
// Créer une page avec ses traductions
// Body: {
//   slug: "faq",
//   status: "draft",
//   metaImage: "...",
//   translations: [
//     { languageId: 1, title: "FAQ", slug: "faq", content: "...", metaTitle: "...", metaDesc: "..." },
//     { languageId: 2, title: "Questions", slug: "questions", content: "...", ... }
//   ]
// }
// ═══════════════════════════════════════════════════════════
export const createPage = async (req, res, next) => {
  try {
    const {
      slug,
      status = "draft",
      metaImage,
      isSystem = false,
      translations,
    } = req.body;

    // Validation
    if (!slug || !translations || translations.length === 0) {
      return res.status(422).json({
        success: false,
        error: "slug et au moins une traduction sont requis",
      });
    }

    // Vérifier slug unique
    const existing = await prisma.staticPage.findUnique({
      where: { slug },
    });

    if (existing) {
      return res.status(422).json({
        success: false,
        error: `Le slug "${slug}" existe déjà`,
      });
    }

    // Valider slug (alphanumeric + hyphens only)
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.status(422).json({
        success: false,
        error: "Le slug doit contenir uniquement des lettres minuscules, chiffres et tirets",
      });
    }

    // Vérifier que toutes les langues existent
    const languageIds = translations.map(t => t.languageId);
    const languages = await prisma.language.findMany({
      where: { id: { in: languageIds } },
    });

    if (languages.length !== languageIds.length) {
      return res.status(422).json({
        success: false,
        error: "Une ou plusieurs langues sont invalides",
      });
    }

    // Créer page + traductions en transaction
    const page = await prisma.$transaction(async (tx) => {
      const created = await tx.staticPage.create({
        data: {
          slug,
          status,
          metaImage,
          isSystem,
          publishedAt: status === "published" ? new Date() : null,
        },
      });

      // Créer traductions
      await tx.staticPageTranslation.createMany({
        data: translations.map(t => ({
          pageId: created.id,
          languageId: t.languageId,
          title: t.title,
          slug: t.slug || slug,
          content: t.content,
          metaTitle: t.metaTitle,
          metaDesc: t.metaDesc,
        })),
      });

      return tx.staticPage.findUnique({
        where: { id: created.id },
        include: {
          translations: { include: { language: true } },
        },
      });
    });

    res.status(201).json({
      success: true,
      message: "Page créée avec succès",
      data: formatPage(page),
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// PUT /api/superadmin/pages/:id
// Mettre à jour page + traductions
// ═══════════════════════════════════════════════════════════
export const updatePage = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const {
      slug,
      status,
      metaImage,
      translations,
    } = req.body;

    const existing = await prisma.staticPage.findUnique({
      where: { id },
      include: { translations: true },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Page introuvable",
      });
    }

    // Vérifier slug unique si modifié
    if (slug && slug !== existing.slug) {
      const slugExists = await prisma.staticPage.findUnique({
        where: { slug },
      });

      if (slugExists) {
        return res.status(422).json({
          success: false,
          error: `Le slug "${slug}" existe déjà`,
        });
      }
    }

    const page = await prisma.$transaction(async (tx) => {
      // Update page
      const updateData = {};
      if (slug !== undefined) updateData.slug = slug;
      if (metaImage !== undefined) updateData.metaImage = metaImage;

      if (status !== undefined) {
        updateData.status = status;

        if (status === "published" && !existing.publishedAt) {
          updateData.publishedAt = new Date();
        } else if (status === "draft") {
          updateData.publishedAt = null;
        }
      }

      await tx.staticPage.update({
        where: { id },
        data: updateData,
      });

      // Update translations
      if (translations && translations.length > 0) {
        for (const t of translations) {
          await tx.staticPageTranslation.upsert({
            where: {
              pageId_languageId: {
                pageId: id,
                languageId: t.languageId,
              },
            },
            update: {
              title: t.title,
              slug: t.slug,
              content: t.content,
              metaTitle: t.metaTitle,
              metaDesc: t.metaDesc,
            },
            create: {
              pageId: id,
              languageId: t.languageId,
              title: t.title,
              slug: t.slug,
              content: t.content,
              metaTitle: t.metaTitle,
              metaDesc: t.metaDesc,
            },
          });
        }
      }

      return tx.staticPage.findUnique({
        where: { id },
        include: {
          translations: { include: { language: true } },
        },
      });
    });

    res.json({
      success: true,
      message: "Page mise à jour",
      data: formatPage(page),
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// DELETE /api/superadmin/pages/:id
// ═══════════════════════════════════════════════════════════
export const deletePage = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    const page = await prisma.staticPage.findUnique({
      where: { id },
      include: { translations: true },
    });

    if (!page) {
      return res.status(404).json({
        success: false,
        error: "Page introuvable",
      });
    }

    if (page.isSystem) {
      return res.status(403).json({
        success: false,
        error: "Impossible de supprimer une page système",
      });
    }

    await prisma.staticPage.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Page supprimée",
    });
  } catch (e) {
    next(e);
  }
};


// ═══════════════════════════════════════════════════════════
// PATCH /api/superadmin/pages/:id/status
// Changer le statut d'une page
// ═══════════════════════════════════════════════════════════
export const updatePageStatus = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;

    if (!["draft", "published"].includes(status)) {
      return res.status(422).json({
        success: false,
        error: "Status invalide (draft | published)",
      });
    }

    const existing = await prisma.staticPage.findUnique({
      where: { id },
      include: {
        translations: { include: { language: true } },
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Page introuvable",
      });
    }

    const updateData = { status };

    // Gérer publishedAt
    if (status === "published" && !existing.publishedAt) {
      updateData.publishedAt = new Date();
    } else if (status === "draft") {
      updateData.publishedAt = null;
    }

    const page = await prisma.staticPage.update({
      where: { id },
      data: updateData,
      include: {
        translations: { include: { language: true } },
      },
    });

    res.json({
      success: true,
      message: `Page ${status === "published" ? "publiée" : "mise en brouillon"}`,
      data: formatPage(page),
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// POST /api/superadmin/pages/:id/duplicate
// Dupliquer une page avec toutes ses traductions
// ═══════════════════════════════════════════════════════════
export const duplicatePage = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    const original = await prisma.staticPage.findUnique({
      where: { id },
      include: {
        translations: true,
      },
    });

    if (!original) {
      return res.status(404).json({
        success: false,
        error: "Page introuvable",
      });
    }

    // Générer slug unique
    let newSlug = `${original.slug}-copy`;
    let counter = 1;

    while (await prisma.staticPage.findUnique({ where: { slug: newSlug } })) {
      newSlug = `${original.slug}-copy-${counter}`;
      counter++;
    }

    // Dupliquer page + traductions en transaction
    const duplicate = await prisma.$transaction(async (tx) => {
      // Créer page
      const newPage = await tx.staticPage.create({
        data: {
          slug: newSlug,
          metaImage: original.metaImage,
          status: "draft",
          isSystem: false,
        },
      });

      // Dupliquer toutes les traductions
      if (original.translations.length > 0) {
        const translationsData = original.translations.map(t => {
          // Générer slug traduit unique
          const translatedSlug = t.slug === original.slug 
            ? newSlug 
            : `${t.slug}-copy`;

          return {
            pageId: newPage.id,
            languageId: t.languageId,
            title: `${t.title} (Copy)`,
            slug: translatedSlug,
            content: t.content,
            metaTitle: t.metaTitle,
            metaDesc: t.metaDesc,
          };
        });

        await tx.staticPageTranslation.createMany({
          data: translationsData,
        });
      }

      // Retourner avec relations
      return tx.staticPage.findUnique({
        where: { id: newPage.id },
        include: {
          translations: { include: { language: true } },
        },
      });
    });

    res.status(201).json({
      success: true,
      message: "Page dupliquée",
      data: formatPage(duplicate),
    });
  } catch (e) {
    next(e);
  }
};

// ═══════════════════════════════════════════════════════════
// GET /api/superadmin/pages/stats
// Statistiques des pages
// ═══════════════════════════════════════════════════════════
export const getPagesStats = async (req, res, next) => {
  try {
    const [total, published, draft, totalViews, byLanguage] = await Promise.all([
      prisma.staticPage.count(),
      prisma.staticPage.count({ where: { status: "published" } }),
      prisma.staticPage.count({ where: { status: "draft" } }),
      prisma.staticPage.aggregate({
        _sum: { views: true },
      }),
      // Grouper par langue via les traductions
      prisma.staticPageTranslation.groupBy({
        by: ["languageId"],
        _count: true,
      }),
    ]);

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
// Helper: Formater page
// ═══════════════════════════════════════════════════════════
function formatPage(page) {
  return {
    id: page.id,
    slug: page.slug,
    status: page.status,
    metaImage: page.metaImage,
    isSystem: page.isSystem,
    views: page.views,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
    publishedAt: page.publishedAt,
    translations: page.translations?.map(t => ({
      id: t.id,
      languageId: t.languageId,
      languageCode: t.language?.code,
      languageName: t.language?.name,
      title: t.title,
      slug: t.slug,
      content: t.content,
      metaTitle: t.metaTitle,
      metaDesc: t.metaDesc,
    })) || [],
  };
}