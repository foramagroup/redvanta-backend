import prisma from "../../config/database.js";
import {
  processProductFiles,
  deleteProductFiles,
  deleteLocalFile,
} from "../../services/uploadeService.js";

const INCLUDE = {
  translations:   { include: { language: true } },
  galleryItems:   { orderBy: { position: "asc" } },
  packageTiers:   { orderBy: { qty: "asc" } },
  cardTypePrices: { include: { cardType: true } },
};

// Valeurs par défaut pour cardSettings
const DEFAULT_CARD_SETTINGS = {
  width: 85,
  height: 54,
  cornerRadiusEnabled: true,
  cornerRadius: 8,
  layouts: ["landscape"],
  reviewPlatform: "google",
  defaultTemplateId: "google-classic",
  availableTemplates: [],
};

function format(p) {
  const title = {}, slug = {}, seoTitle = {}, metaDesc = {}, metaImage = {};
  for (const t of p.translations) {
    const code      = t.language.code;
    title[code]     = t.title;
    slug[code]      = t.slug;
    seoTitle[code]  = t.seoTitle        ?? "";
    metaDesc[code]  = t.metaDescription ?? "";
    metaImage[code] = t.metaImage       ?? "/placeholder.svg";
  }
  
  return {
    id: p.id,
    price: Number(p.price),
    active: p.active,
    image: p.image ?? "/placeholder.svg",
    cardSettings:    p.cardSettings ?? {},
    title,
    slug,
    seoTitle,
    metaDescription: metaDesc,
    metaImage,
    gallery: p.galleryItems.map((g) => ({
      url: g.url,
      type: g.type,
      poster: g.poster ?? undefined
    })),
    packageTiers: p.packageTiers.map((t) => ({
      qty: t.qty,
      price: Number(t.price)
    })),
    cardTypePrices: p.cardTypePrices.map((c) => ({
      typeId: c.cardTypeId,
      price: Number(c.price)
    })),
    // Ajouter cardSettings au format
    cardSettings: p.cardSettings 
      ? (typeof p.cardSettings === 'string' ? JSON.parse(p.cardSettings) : p.cardSettings)
      : DEFAULT_CARD_SETTINGS,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

async function validateLangIds(langIds) {
  const langs = await prisma.language.findMany({
    where: { id: { in: langIds } },
    select: { id: true, code: true, status: true },
  });
  const found = new Map(langs.map((l) => [l.id, l]));
  for (const id of langIds) {
    if (!found.has(id))
      return { ok: false, message: `Langue introuvable (langId: ${id})` };
    if (found.get(id).status !== "Active")
      return { ok: false, message: `La langue "${found.get(id).code}" n'est pas active` };
  }
  return { ok: true };
}

async function enrichWithLangCode(body) {
  const langIds = (body.translations || []).map((t) => t.langId);
  if (!langIds.length) return body;
  const langs = await prisma.language.findMany({
    where: { id: { in: langIds } },
    select: { id: true, code: true },
  });
  const map = new Map(langs.map((l) => [l.id, l.code]));
  return {
    ...body,
    translations: (body.translations || []).map((t) => ({
      ...t,
      lang: map.get(t.langId) ?? String(t.langId),
    })),
  };
}





/**
 * GET /api/superadmin/products/available-templates
 * Récupérer UNIQUEMENT les templates marqués pour les produits (isCardSetting = true)
 */
export const getAvailableTemplatesForProducts = async (req, res) => {
  try {
    const { platform } = req.query; 

    const where = {
      isActive: true,
      isCardSetting: true 
    };

    // Filtrage optionnel par plateforme
    if (platform && platform !== 'all') {
      where.platform = platform;
    }
    const templates = await prisma.cardTemplate.findMany({
      where,
      orderBy: [
        { isDefault: 'desc' },
        { platform: 'asc' },
        { name: 'asc' }
      ],
      select: {
        id: true,
        name: true,
        platform: true,
        gradient: true,
        pattern: true,
        accentColor: true,
        textColor: true,
        model: true,
        orientation: true,
        isDefault: true,
        isCardSetting: true,
        createdAt: true
      }
    });

    const groupedByPlatform = templates.reduce((acc, template) => {
      if (!acc[template.platform]) {
        acc[template.platform] = [];
      }
      acc[template.platform].push(template);
      return acc;
    }, {});

    res.json({
      success: true,
      data: templates,
      grouped: groupedByPlatform,
      total: templates.length
    });
  } catch (error) {
    console.error('❌ Error fetching available templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available templates',
      details: error.message
    });
  }
};



export const listProducts = async (req, res, next) => {
  try {
    const data = await prisma.product.findMany({
      include: INCLUDE,
      orderBy: { id: "asc" }
    });
    res.json({ success: true, data: data.map(format) });
  } catch (e) {
    next(e);
  }
};

/**
 * GET /api/superadmin/products/:id
 * Récupérer un produit avec ses templates
 */
export const getProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: {
        defaultTemplate: true,
        translations: {
          include: { language: true }
        },
        galleryItems: {
          orderBy: { position: 'asc' }
        },
        packageTiers: {
          orderBy: { qty: 'asc' }
        },
        cardTypePrices: {
          include: { cardType: true }
        }
      }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // ✅ Récupérer les templates disponibles (seulement ceux avec isCardSetting = true)
    const availableTemplateIds = product.availableTemplateIds 
      ? JSON.parse(JSON.stringify(product.availableTemplateIds))
      : [];

    let availableTemplates = [];
    if (availableTemplateIds.length > 0) {
      availableTemplates = await prisma.cardTemplate.findMany({
        where: {
          id: { in: availableTemplateIds.map(id => parseInt(id)) },
          isActive: true,
          isCardSetting: true // ✅ FILTRE
        },
        select: {
          id: true,
          name: true,
          platform: true,
          gradient: true,
          pattern: true,
          accentColor: true,
          textColor: true,
          model: true,
          isDefault: true
        }
      });
    }

    // ✅ Si aucun template sélectionné, prendre les templates par défaut de la plateforme
    if (availableTemplates.length === 0 && product.reviewPlatform) {
      availableTemplates = await prisma.cardTemplate.findMany({
        where: {
          platform: product.reviewPlatform,
          isActive: true,
          isCardSetting: true, // ✅ FILTRE
          isDefault: true
        },
        select: {
          id: true,
          name: true,
          platform: true,
          gradient: true,
          pattern: true,
          accentColor: true,
          textColor: true,
          model: true,
          isDefault: true
        }
      });
    }

    res.json({
      success: true,
      data: {
        ...product,
        availableTemplates,
        cardSettings: product.cardSettings || {
          width: 85.6,
          height: 53.98,
          cornerRadius: 3,
          cornerRadiusEnabled: true
        }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product',
      details: error.message
    });
  }
};

/**
 * POST /api/superadmin/products
 * Créer un produit
 */
export const createProduct = async (req, res) => {
  try {
    const {
      price,
      active,
      image,
      defaultTemplateId,
      availableTemplateIds,
      reviewPlatform,
      cardSettings,
      translations,
      galleryItems,
      packageTiers,
      cardTypePrices
    } = req.body;

    // Validation
    if (!price || price <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid price is required'
      });
    }

    if (!translations || translations.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one translation is required'
      });
    }

    // ✅ Vérifier que le template par défaut a isCardSetting = true
    if (defaultTemplateId) {
      const template = await prisma.cardTemplate.findUnique({
        where: { id: parseInt(defaultTemplateId) }
      });

      if (!template) {
        return res.status(400).json({
          success: false,
          error: 'Default template not found'
        });
      }

      if (!template.isCardSetting) {
        return res.status(400).json({
          success: false,
          error: 'Selected template is not available for products'
        });
      }
    }

    // ✅ Vérifier que tous les templates disponibles ont isCardSetting = true
    if (availableTemplateIds && availableTemplateIds.length > 0) {
      const templates = await prisma.cardTemplate.findMany({
        where: {
          id: { in: availableTemplateIds.map(id => parseInt(id)) }
        }
      });

      const invalidTemplates = templates.filter(t => !t.isCardSetting);
      if (invalidTemplates.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Some selected templates are not available for products',
          invalidTemplateIds: invalidTemplates.map(t => t.id)
        });
      }
    }

    const product = await prisma.product.create({
      data: {
        price: parseFloat(price),
        active: active !== false,
        image: image || null,
        defaultTemplateId: defaultTemplateId ? parseInt(defaultTemplateId) : null,
        availableTemplateIds: availableTemplateIds || [],
        reviewPlatform: reviewPlatform || 'google',
        cardSettings: cardSettings || {
          width: 85.6,
          height: 53.98,
          cornerRadius: 3,
          cornerRadiusEnabled: true
        },
        translations: {
          create: translations.map(t => ({
            langId: parseInt(t.langId),
            title: t.title,
            slug: t.slug,
            seoTitle: t.seoTitle || null,
            metaDescription: t.metaDescription || null,
            metaImage: t.metaImage || null
          }))
        },
        galleryItems: galleryItems ? {
          create: galleryItems.map((item, index) => ({
            url: item.url,
            type: item.type,
            poster: item.poster || null,
            position: item.position !== undefined ? item.position : index
          }))
        } : undefined,
        packageTiers: packageTiers ? {
          create: packageTiers.map(tier => ({
            qty: parseInt(tier.qty),
            price: parseFloat(tier.price)
          }))
        } : undefined,
        cardTypePrices: cardTypePrices ? {
          create: cardTypePrices.map(ctp => ({
            cardTypeId: parseInt(ctp.cardTypeId),
            price: parseFloat(ctp.price)
          }))
        } : undefined
      },
      include: {
        defaultTemplate: true,
        translations: true,
        galleryItems: true,
        packageTiers: true,
        cardTypePrices: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  } catch (error) {
    console.error('❌ Error creating product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create product',
      details: error.message
    });
  }
};



/**
 * PUT /api/superadmin/products/:id
 * Mettre à jour un produit
 */
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      price,
      active,
      image,
      defaultTemplateId,
      availableTemplateIds,
      reviewPlatform,
      cardSettings
    } = req.body;

    const existing = await prisma.product.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Vérifier le template si fourni
    if (defaultTemplateId) {
      const template = await prisma.cardTemplate.findUnique({
        where: { id: parseInt(defaultTemplateId) }
      });

      if (!template) {
        return res.status(400).json({
          success: false,
          error: 'Default template not found'
        });
      }
    }

    const updateData = {};
    if (price !== undefined) updateData.price = parseFloat(price);
    if (active !== undefined) updateData.active = active;
    if (image !== undefined) updateData.image = image;
    if (defaultTemplateId !== undefined) {
      updateData.defaultTemplateId = defaultTemplateId ? parseInt(defaultTemplateId) : null;
    }
    if (availableTemplateIds !== undefined) updateData.availableTemplateIds = availableTemplateIds;
    if (reviewPlatform !== undefined) updateData.reviewPlatform = reviewPlatform;
    if (cardSettings !== undefined) updateData.cardSettings = cardSettings;

    const product = await prisma.product.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        defaultTemplate: true,
        translations: true,
        galleryItems: true,
        packageTiers: true,
        cardTypePrices: true
      }
    });

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    console.error('❌ Error updating product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update product',
      details: error.message
    });
  }
};



export const deleteProduct = async (req, res, next) => {
  try {
    const id = +req.params.id;
    const existing = await prisma.product.findUnique({
      where: { id },
      include: INCLUDE
    });
    if (!existing) return res.status(404).json({
      success: false,
      message: "Produit introuvable"
    });
    
    deleteProductFiles(existing);
    await prisma.product.delete({ where: { id } });
    
    res.json({ success: true, message: "Produit supprimé" });
  } catch (e) {
    next(e);
  }
};

export const toggleProduct = async (req, res, next) => {
  try {
    const id = +req.params.id;
    const p = await prisma.product.findUnique({ where: { id } });
    if (!p) return res.status(404).json({
      success: false,
      message: "Produit introuvable"
    });
    
    const updated = await prisma.product.update({
      where: { id },
      data: { active: !p.active },
      include: INCLUDE
    });
    
    res.json({ success: true, data: format(updated) });
  } catch (e) {
    next(e);
  }
};