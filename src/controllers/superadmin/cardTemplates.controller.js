import prisma from "../../config/database.js";

/**
 * GET /api/superadmin/card-templates
 * Récupère tous les templates
 */
export const getAllTemplates = async (req, res) => {
  try {
    const { platform, isActive, search } = req.query;
    const where = {};
    // Filtre par plateforme
    if (platform && platform !== 'all') {
      where.platform = platform;
    }

    // Filtre par statut
    if (isActive !== undefined && isActive !== 'all') {
      where.isActive = isActive === 'true' || isActive === 'active';
    }

    // Recherche
    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { platform: { contains: search, mode: 'insensitive' } }
      ];
    }

    const templates = await prisma.cardTemplate.findMany({
      where,
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    // Formater les templates pour le frontend
    const formattedTemplates = templates.map(template => ({
      id: template.id.toString(),
      name: template.name,
      platform: template.platform,
      gradient: Array.isArray(template.gradient) 
        ? template.gradient 
        : JSON.parse(template.gradient),
      accentColor: template.accentColor,
      textColor: template.textColor,
      bandColor1: template.bandColor1,
      bandColor2: template.bandColor2,
      qrColor: template.qrColor,
      starsColor: template.starsColor,
      iconsColor: template.iconsColor,
      pattern: template.pattern,
      isActive: template.isActive,
      isDefault: template.isDefault,
      createdAt: template.createdAt.toISOString().split('T')[0],
      updatedAt: template.updatedAt.toISOString().split('T')[0]
    }));

    res.json({
      success: true,
      data: formattedTemplates,
      total: formattedTemplates.length
    });
  } catch (error) {
    console.error('❌ Error fetching templates:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching templates',
      details: error.message
    });
  }
};

/**
 * GET /api/superadmin/card-templates/:id
 * Récupère un template spécifique
 */
export const getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;

    const template = await prisma.cardTemplate.findUnique({
      where: { id: parseInt(id) }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: template.id.toString(),
        name: template.name,
        platform: template.platform,
        gradient: Array.isArray(template.gradient) 
          ? template.gradient 
          : JSON.parse(template.gradient),
        accentColor: template.accentColor,
        textColor: template.textColor,
        bandColor1: template.bandColor1,
        bandColor2: template.bandColor2,
        qrColor: template.qrColor,
        starsColor: template.starsColor,
        iconsColor: template.iconsColor,
        pattern: template.pattern,
        isActive: template.isActive,
        isDefault: template.isDefault,
        createdAt: template.createdAt.toISOString().split('T')[0],
        updatedAt: template.updatedAt.toISOString().split('T')[0]
      }
    });
  } catch (error) {
    console.error('❌ Error fetching template:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching template',
      details: error.message
    });
  }
};

/**
 * POST /api/superadmin/card-templates
 * Crée un nouveau template
 */
export const createTemplate = async (req, res) => {
  try {
    const {
      name,
      platform,
      gradient,
      accentColor,
      textColor,
      bandColor1,
      bandColor2,
      qrColor,
      starsColor,
      iconsColor,
      pattern,
      isActive,
      isDefault
    } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Template name is required'
      });
    }

    if (!platform) {
      return res.status(400).json({
        success: false,
        error: 'Platform is required'
      });
    }

    if (!gradient || !Array.isArray(gradient) || gradient.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Gradient must be an array with at least 2 colors'
      });
    }

    // Si isDefault = true, désactiver tous les autres templates par défaut pour cette plateforme
    if (isDefault) {
      await prisma.cardTemplate.updateMany({
        where: {
          platform,
          isDefault: true
        },
        data: {
          isDefault: false
        }
      });
    }

    const template = await prisma.cardTemplate.create({
      data: {
        name: name.trim(),
        platform,
        gradient: JSON.stringify(gradient),
        accentColor: accentColor || '#4285F4',
        textColor: textColor || '#1a1a1a',
        bandColor1: bandColor1 || accentColor || '#4285F4',
        bandColor2: bandColor2 || accentColor || '#4285F4',
        qrColor: qrColor || accentColor || '#4285F4',
        starsColor: starsColor || '#FBBF24',
        iconsColor: iconsColor || accentColor || '#4285F4',
        pattern: pattern || 'none',
        isActive: isActive !== undefined ? isActive : true,
        isDefault: isDefault || false
      }
    });

    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      data: {
        id: template.id.toString(),
        name: template.name,
        platform: template.platform
      }
    });
  } catch (error) {
    console.error('❌ Error creating template:', error);
    res.status(500).json({
      success: false,
      error: 'Error creating template',
      details: error.message
    });
  }
};

/**
 * PUT /api/superadmin/card-templates/:id
 * Met à jour un template
 */
export const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      platform,
      gradient,
      accentColor,
      textColor,
      bandColor1,
      bandColor2,
      qrColor,
      starsColor,
      iconsColor,
      pattern,
      isActive,
      isDefault
    } = req.body;

    // Vérifier que le template existe
    const existing = await prisma.cardTemplate.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Si isDefault = true, désactiver tous les autres templates par défaut pour cette plateforme
    if (isDefault && platform) {
      await prisma.cardTemplate.updateMany({
        where: {
          platform,
          isDefault: true,
          id: { not: parseInt(id) }
        },
        data: {
          isDefault: false
        }
      });
    }

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (platform) updateData.platform = platform;
    if (gradient) updateData.gradient = JSON.stringify(gradient);
    if (accentColor) updateData.accentColor = accentColor;
    if (textColor) updateData.textColor = textColor;
    if (bandColor1) updateData.bandColor1 = bandColor1;
    if (bandColor2) updateData.bandColor2 = bandColor2;
    if (qrColor) updateData.qrColor = qrColor;
    if (starsColor) updateData.starsColor = starsColor;
    if (iconsColor) updateData.iconsColor = iconsColor;
    if (pattern !== undefined) updateData.pattern = pattern;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isDefault !== undefined) updateData.isDefault = isDefault;

    const template = await prisma.cardTemplate.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    res.json({
      success: true,
      message: 'Template updated successfully',
      data: {
        id: template.id.toString(),
        name: template.name
      }
    });
  } catch (error) {
    console.error('❌ Error updating template:', error);
    res.status(500).json({
      success: false,
      error: 'Error updating template',
      details: error.message
    });
  }
};

/**
 * DELETE /api/superadmin/card-templates/:id
 * Supprime un template
 */
export const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const template = await prisma.cardTemplate.findUnique({
      where: { id: parseInt(id) }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Empêcher la suppression des templates par défaut
    if (template.isDefault) {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete default template'
      });
    }

    await prisma.cardTemplate.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting template:', error);
    res.status(500).json({
      success: false,
      error: 'Error deleting template',
      details: error.message
    });
  }
};

/**
 * POST /api/superadmin/card-templates/:id/duplicate
 * Duplique un template
 */
export const duplicateTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const original = await prisma.cardTemplate.findUnique({
      where: { id: parseInt(id) }
    });

    if (!original) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    const duplicate = await prisma.cardTemplate.create({
      data: {
        name: `${original.name} (Copy)`,
        platform: original.platform,
        gradient: original.gradient,
        accentColor: original.accentColor,
        textColor: original.textColor,
        bandColor1: original.bandColor1,
        bandColor2: original.bandColor2,
        qrColor: original.qrColor,
        starsColor: original.starsColor,
        iconsColor: original.iconsColor,
        pattern: original.pattern,
        isActive: original.isActive,
        isDefault: false // Les copies ne sont jamais par défaut
      }
    });

    res.status(201).json({
      success: true,
      message: 'Template duplicated successfully',
      data: {
        id: duplicate.id.toString(),
        name: duplicate.name
      }
    });
  } catch (error) {
    console.error('❌ Error duplicating template:', error);
    res.status(500).json({
      success: false,
      error: 'Error duplicating template',
      details: error.message
    });
  }
};

/**
 * PATCH /api/superadmin/card-templates/:id/toggle
 * Active/Désactive un template
 */
export const toggleTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const template = await prisma.cardTemplate.findUnique({
      where: { id: parseInt(id) }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    const updated = await prisma.cardTemplate.update({
      where: { id: parseInt(id) },
      data: {
        isActive: !template.isActive
      }
    });

    res.json({
      success: true,
      message: `Template ${updated.isActive ? 'activated' : 'deactivated'}`,
      data: {
        id: updated.id.toString(),
        isActive: updated.isActive
      }
    });
  } catch (error) {
    console.error('❌ Error toggling template:', error);
    res.status(500).json({
      success: false,
      error: 'Error toggling template',
      details: error.message
    });
  }
};

/**
 * GET /api/superadmin/card-templates/stats
 * Récupère les statistiques des templates
 */
export const getTemplateStats = async (req, res) => {
  try {
    const [
      total,
      active,
      inactive,
      platforms
    ] = await Promise.all([
      prisma.cardTemplate.count(),
      prisma.cardTemplate.count({ where: { isActive: true } }),
      prisma.cardTemplate.count({ where: { isActive: false } }),
      prisma.cardTemplate.groupBy({
        by: ['platform'],
        _count: true
      })
    ]);

    res.json({
      success: true,
      data: {
        total,
        active,
        inactive,
        platforms: platforms.length,
        platformBreakdown: platforms.map(p => ({
          platform: p.platform,
          count: p._count
        }))
      }
    });
  } catch (error) {
    console.error('❌ Error fetching template stats:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching template stats',
      details: error.message
    });
  }
};