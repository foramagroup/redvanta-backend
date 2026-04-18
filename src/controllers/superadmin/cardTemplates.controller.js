import prisma from "../../config/database.js";


function formatTemplate(template) {
  return {
    id: template.id.toString(),
    name: template.name,
    platform: template.platform,
    
    // Content
    businessName: template.businessName,
    slogan: template.slogan,
    cta: template.cta,
    logoUrl: template.logoUrl,
    
    // Layout
    orientation: template.orientation,
    bandPosition: template.bandPosition,
    frontBandHeight: template.frontBandHeight,
    backBandHeight: template.backBandHeight,
    
    // Logo and QR
    logoPosition: template.logoPosition,
    logoSize: template.logoSize,
    qrPosition: template.qrPosition,
    qrSize: template.qrSize,
    
    // Typography - Name
    nameFont: template.nameFont,
    nameFontSize: template.nameFontSize,
    nameFontWeight: template.nameFontWeight,
    nameLetterSpacing: template.nameLetterSpacing,
    nameTextTransform: template.nameTextTransform,
    nameLineHeight: template.nameLineHeight,
    nameTextAlign: template.nameTextAlign,
    
    // Typography - Slogan
    sloganFont: template.sloganFont,
    sloganFontSize: template.sloganFontSize,
    sloganFontWeight: template.sloganFontWeight,
    sloganLetterSpacing: template.sloganLetterSpacing,
    sloganTextTransform: template.sloganTextTransform,
    sloganLineHeight: template.sloganLineHeight,
    sloganTextAlign: template.sloganTextAlign,
    
    // Typography - Instructions
    instructionFont: template.instructionFont,
    instructionFontSize: template.instructionFontSize,
    instructionFontWeight: template.instructionFontWeight,
    instructionLetterSpacing: template.instructionLetterSpacing,
    instructionLineHeight: template.instructionLineHeight,
    instructionTextAlign: template.instructionTextAlign,
    
    // Instructions text
    frontLine1: template.frontLine1,
    frontLine2: template.frontLine2,
    backLine1: template.backLine1,
    backLine2: template.backLine2,
    
    // Icons
    checkStrokeWidth: template.checkStrokeWidth / 10, // Convertir 35 -> 3.5
    nfcIconSize: template.nfcIconSize,
    googleIconSize: template.googleIconSize,
    showNfcIcon: template.showNfcIcon,
    showGoogleIcon: template.showGoogleIcon,
    
    // Visual
    textShadow: template.textShadow,
    ctaPaddingTop: template.ctaPaddingTop,
    
    // Model and mode
    model: template.model,
    colorMode: template.colorMode,
    
    // Element offsets
    elementOffsets: template.elementOffsets,
    
    // Colors
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
    
    // Pattern and status
    pattern: template.pattern,
    isActive: template.isActive,
    isDefault: template.isDefault,
    isCardSetting: template.isCardSetting,
    
    // Dates
    createdAt: template.createdAt.toISOString().split('T')[0],
    updatedAt: template.updatedAt.toISOString().split('T')[0]
  };
}

/**
 * GET /api/superadmin/card-templates
 * Récupère tous les templates
 */
export const getAllTemplates = async (req, res) => {
  try {
    const { platform, isActive, search } = req.query;
    const where = {};

    if (platform && platform !== 'all') {
      where.platform = platform;
    }

    if (isActive !== undefined && isActive !== 'all') {
      where.isActive = isActive === 'true' || isActive === 'active';
    }

    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search } },
        { platform: { contains: search } }
      ];
    }

    const templates = await prisma.cardTemplate.findMany({
      where,
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    res.json({
      success: true,
      data: templates.map(formatTemplate),
      total: templates.length
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
      data: formatTemplate(template)
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
    const data = req.body;

    // Validation basique
    if (!data.name || !data.name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Template name is required'
      });
    }

    if (!data.platform) {
      return res.status(400).json({
        success: false,
        error: 'Platform is required'
      });
    }

    if (!data.gradient || !Array.isArray(data.gradient) || data.gradient.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Gradient must be an array with at least 2 colors'
      });
    }

    // Si isDefault = true, désactiver les autres templates par défaut
    if (data.isDefault) {
      await prisma.cardTemplate.updateMany({
        where: {
          platform: data.platform,
          isDefault: true
        },
        data: {
          isDefault: false
        }
      });
    }

    const template = await prisma.cardTemplate.create({
      data: {
        // Basic
        name: data.name.trim(),
        platform: data.platform,
        
        // Content
        businessName: data.businessName || data.name,
        slogan: data.slogan || null,
        cta: data.cta || 'Powered by RedVanta',
        logoUrl: data.logoUrl || null,
        
        // Layout
        orientation: data.orientation || 'landscape',
        bandPosition: data.bandPosition || 'bottom',
        frontBandHeight: data.frontBandHeight || 22,
        backBandHeight: data.backBandHeight || 12,
        
        // Logo and QR
        logoPosition: data.logoPosition || 'left',
        logoSize: data.logoSize || 32,
        qrPosition: data.qrPosition || 'right',
        qrSize: data.qrSize || 80,
        
        // Typography - Name
        nameFont: data.nameFont || "'Space Grotesk', sans-serif",
        nameFontSize: data.nameFontSize || 16,
        nameFontWeight: data.nameFontWeight || '700',
        nameLetterSpacing: data.nameLetterSpacing || 'normal',
        nameTextTransform: data.nameTextTransform || 'none',
        nameLineHeight: data.nameLineHeight || '1.2',
        nameTextAlign: data.nameTextAlign || 'left',
        
        // Typography - Slogan
        sloganFont: data.sloganFont || "'Space Grotesk', sans-serif",
        sloganFontSize: data.sloganFontSize || 12,
        sloganFontWeight: data.sloganFontWeight || '400',
        sloganLetterSpacing: data.sloganLetterSpacing || 'normal',
        sloganTextTransform: data.sloganTextTransform || 'none',
        sloganLineHeight: data.sloganLineHeight || '1.4',
        sloganTextAlign: data.sloganTextAlign || 'left',
        
        // Typography - Instructions
        instructionFont: data.instructionFont || "'Space Grotesk', sans-serif",
        instructionFontSize: data.instructionFontSize || 10,
        instructionFontWeight: data.instructionFontWeight || '400',
        instructionLetterSpacing: data.instructionLetterSpacing || 'normal',
        instructionLineHeight: data.instructionLineHeight || '1.4',
        instructionTextAlign: data.instructionTextAlign || 'left',
        
        // Instructions text
        frontLine1: data.frontLine1 || 'Approach your phone to the card',
        frontLine2: data.frontLine2 || 'Tap to leave a review',
        backLine1: data.backLine1 || 'Scan the QR code with your camera',
        backLine2: data.backLine2 || 'Write a review on our profile page',
        
        // Icons
        checkStrokeWidth: Math.round((data.checkStrokeWidth || 3.5) * 10), // 3.5 -> 35
        nfcIconSize: data.nfcIconSize || 24,
        googleIconSize: data.googleIconSize || 20,
        showNfcIcon: data.showNfcIcon !== false,
        showGoogleIcon: data.showGoogleIcon !== false,
        
        // Visual
        textShadow: data.textShadow || 'none',
        ctaPaddingTop: data.ctaPaddingTop || 8,
        
        // Model and mode
        model: data.model || 'classic',
        colorMode: data.colorMode || 'template',
        
        // Element offsets
        elementOffsets: data.elementOffsets || null,
        
        // Colors
        gradient: JSON.stringify(data.gradient),
        accentColor: data.accentColor || '#4285F4',
        textColor: data.textColor || '#1a1a1a',
        bandColor1: data.bandColor1 || data.accentColor || '#4285F4',
        bandColor2: data.bandColor2 || data.accentColor || '#4285F4',
        qrColor: data.qrColor || data.accentColor || '#4285F4',
        starsColor: data.starsColor || '#FBBF24',
        iconsColor: data.iconsColor || data.accentColor || '#4285F4',
        
        // Pattern and status
        pattern: data.pattern || 'none',
        isActive: data.isActive !== undefined ? data.isActive : true,
        isCardSetting: data.isCardSetting !== undefined ? data.isCardSetting : false,
        isDefault: data.isDefault || false
      }
    });

    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      data: formatTemplate(template)
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
    const data = req.body;

    const existing = await prisma.cardTemplate.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Si isDefault = true, désactiver les autres
    if (data.isDefault && data.platform) {
      await prisma.cardTemplate.updateMany({
        where: {
          platform: data.platform,
          isDefault: true,
          id: { not: parseInt(id) }
        },
        data: {
          isDefault: false
        }
      });
    }

    const updateData = {};
    
    // Basic
    if (data.name) updateData.name = data.name.trim();
    if (data.platform) updateData.platform = data.platform;
    
    // Content
    if (data.businessName !== undefined) updateData.businessName = data.businessName;
    if (data.slogan !== undefined) updateData.slogan = data.slogan;
    if (data.cta !== undefined) updateData.cta = data.cta;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    
    // Layout
    if (data.orientation) updateData.orientation = data.orientation;
    if (data.bandPosition) updateData.bandPosition = data.bandPosition;
    if (data.frontBandHeight !== undefined) updateData.frontBandHeight = data.frontBandHeight;
    if (data.backBandHeight !== undefined) updateData.backBandHeight = data.backBandHeight;
    
    // Logo and QR
    if (data.logoPosition) updateData.logoPosition = data.logoPosition;
    if (data.logoSize !== undefined) updateData.logoSize = data.logoSize;
    if (data.qrPosition) updateData.qrPosition = data.qrPosition;
    if (data.qrSize !== undefined) updateData.qrSize = data.qrSize;
    
    // Typography - Name
    if (data.nameFont) updateData.nameFont = data.nameFont;
    if (data.nameFontSize !== undefined) updateData.nameFontSize = data.nameFontSize;
    if (data.nameFontWeight) updateData.nameFontWeight = data.nameFontWeight;
    if (data.nameLetterSpacing) updateData.nameLetterSpacing = data.nameLetterSpacing;
    if (data.nameTextTransform) updateData.nameTextTransform = data.nameTextTransform;
    if (data.nameLineHeight) updateData.nameLineHeight = data.nameLineHeight;
    if (data.nameTextAlign) updateData.nameTextAlign = data.nameTextAlign;
    
    // Typography - Slogan
    if (data.sloganFont) updateData.sloganFont = data.sloganFont;
    if (data.sloganFontSize !== undefined) updateData.sloganFontSize = data.sloganFontSize;
    if (data.sloganFontWeight) updateData.sloganFontWeight = data.sloganFontWeight;
    if (data.sloganLetterSpacing) updateData.sloganLetterSpacing = data.sloganLetterSpacing;
    if (data.sloganTextTransform) updateData.sloganTextTransform = data.sloganTextTransform;
    if (data.sloganLineHeight) updateData.sloganLineHeight = data.sloganLineHeight;
    if (data.sloganTextAlign) updateData.sloganTextAlign = data.sloganTextAlign;
    
    // Typography - Instructions
    if (data.instructionFont) updateData.instructionFont = data.instructionFont;
    if (data.instructionFontSize !== undefined) updateData.instructionFontSize = data.instructionFontSize;
    if (data.instructionFontWeight) updateData.instructionFontWeight = data.instructionFontWeight;
    if (data.instructionLetterSpacing) updateData.instructionLetterSpacing = data.instructionLetterSpacing;
    if (data.instructionLineHeight) updateData.instructionLineHeight = data.instructionLineHeight;
    if (data.instructionTextAlign) updateData.instructionTextAlign = data.instructionTextAlign;
    
    // Instructions text
    if (data.frontLine1 !== undefined) updateData.frontLine1 = data.frontLine1;
    if (data.frontLine2 !== undefined) updateData.frontLine2 = data.frontLine2;
    if (data.backLine1 !== undefined) updateData.backLine1 = data.backLine1;
    if (data.backLine2 !== undefined) updateData.backLine2 = data.backLine2;
    
    // Icons
    if (data.checkStrokeWidth !== undefined) updateData.checkStrokeWidth = Math.round(data.checkStrokeWidth * 10);
    if (data.nfcIconSize !== undefined) updateData.nfcIconSize = data.nfcIconSize;
    if (data.googleIconSize !== undefined) updateData.googleIconSize = data.googleIconSize;
    if (data.showNfcIcon !== undefined) updateData.showNfcIcon = data.showNfcIcon;
    if (data.showGoogleIcon !== undefined) updateData.showGoogleIcon = data.showGoogleIcon;
    
    // Visual
    if (data.textShadow) updateData.textShadow = data.textShadow;
    if (data.ctaPaddingTop !== undefined) updateData.ctaPaddingTop = data.ctaPaddingTop;
    
    // Model and mode
    if (data.model) updateData.model = data.model;
    if (data.colorMode) updateData.colorMode = data.colorMode;
    
    // Element offsets
    if (data.elementOffsets !== undefined) updateData.elementOffsets = data.elementOffsets;
    
    // Colors
    if (data.gradient) updateData.gradient = JSON.stringify(data.gradient);
    if (data.accentColor) updateData.accentColor = data.accentColor;
    if (data.textColor) updateData.textColor = data.textColor;
    if (data.bandColor1) updateData.bandColor1 = data.bandColor1;
    if (data.bandColor2) updateData.bandColor2 = data.bandColor2;
    if (data.qrColor) updateData.qrColor = data.qrColor;
    if (data.starsColor) updateData.starsColor = data.starsColor;
    if (data.iconsColor) updateData.iconsColor = data.iconsColor;
    
    // Pattern and status
    if (data.pattern !== undefined) updateData.pattern = data.pattern;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.isCardSetting !== undefined) updateData.isCardSetting = data.isCardSetting;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;

    const template = await prisma.cardTemplate.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    res.json({
      success: true,
      message: 'Template updated successfully',
      data: formatTemplate(template)
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
        // Basic
        name: original.name.trim(),
        platform: original.platform,
        
        // Content
        businessName: original.businessName || original.name,
        slogan: original.slogan || null,
        cta: original.cta || 'Powered by RedVanta',
        logoUrl: original.logoUrl || null,
        
        // Layout
        orientation: original.orientation || 'landscape',
        bandPosition: original.bandPosition || 'bottom',
        frontBandHeight: original.frontBandHeight || 22,
        backBandHeight: original.backBandHeight || 12,
        
        // Logo and QR
        logoPosition: original.logoPosition || 'left',
        logoSize: original.logoSize || 32,
        qrPosition: original.qrPosition || 'right',
        qrSize: original.qrSize || 80,
        
        // Typography - Name
        nameFont: original.nameFont || "'Space Grotesk', sans-serif",
        nameFontSize: original.nameFontSize || 16,
        nameFontWeight: original.nameFontWeight || '700',
        nameLetterSpacing: original.nameLetterSpacing || 'normal',
        nameTextTransform: original.nameTextTransform || 'none',
        nameLineHeight: original.nameLineHeight || '1.2',
        nameTextAlign: original.nameTextAlign || 'left',
        
        // Typography - Slogan
        sloganFont: original.sloganFont || "'Space Grotesk', sans-serif",
        sloganFontSize: original.sloganFontSize || 12,
        sloganFontWeight: original.sloganFontWeight || '400',
        sloganLetterSpacing: original.sloganLetterSpacing || 'normal',
        sloganTextTransform: original.sloganTextTransform || 'none',
        sloganLineHeight: original.sloganLineHeight || '1.4',
        sloganTextAlign: original.sloganTextAlign || 'left',
        
        // Typography - Instructions
        instructionFont: original.instructionFont || "'Space Grotesk', sans-serif",
        instructionFontSize: original.instructionFontSize || 10,
        instructionFontWeight: original.instructionFontWeight || '400',
        instructionLetterSpacing: original.instructionLetterSpacing || 'normal',
        instructionLineHeight: original.instructionLineHeight || '1.4',
        instructionTextAlign: original.instructionTextAlign || 'left',
        
        // Instructions text
        frontLine1: original.frontLine1 || 'Approach your phone to the card',
        frontLine2: original.frontLine2 || 'Tap to leave a review',
        backLine1: original.backLine1 || 'Scan the QR code with your camera',
        backLine2: original.backLine2 || 'Write a review on our profile page',
        
        // Icons
        checkStrokeWidth: Math.round((original.checkStrokeWidth || 3.5) * 10), // 3.5 -> 35
        nfcIconSize: original.nfcIconSize || 24,
        googleIconSize: original.googleIconSize || 20,
        showNfcIcon: original.showNfcIcon !== false,
        showGoogleIcon: original.showGoogleIcon !== false,
        
        // Visual
        textShadow: original.textShadow || 'none',
        ctaPaddingTop: original.ctaPaddingTop || 8,
        
        // Model and mode
        model: original.model || 'classic',
        colorMode: original.colorMode || 'template',
        
        // Element offsets
        elementOffsets: original.elementOffsets || null,
        
        // Colors
        gradient: JSON.stringify(original.gradient),
        accentColor: original.accentColor || '#4285F4',
        textColor: original.textColor || '#1a1a1a',
        bandColor1: original.bandColor1 || original.accentColor || '#4285F4',
        bandColor2: original.bandColor2 || original.accentColor || '#4285F4',
        qrColor: original.qrColor || original.accentColor || '#4285F4',
        starsColor: original.starsColor || '#FBBF24',
        iconsColor: original.iconsColor || original.accentColor || '#4285F4',
        
        // Pattern and status
        pattern: original.pattern || 'none',
        isActive: original.isActive !== undefined ? original.isActive : true,
        isCardSetting: original.isCardSetting !== undefined ? original.isCardSetting : false,
        
        isDefault: false
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


/**
 * PATCH /api/superadmin/card-templates/:id/toggle-card-setting
 * Active/Désactive la disponibilité du template pour les paramètres de carte
 */
export const toggleCardSetting = async (req, res) => {
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
        isCardSetting: !template.isCardSetting
      }
    });
    res.json({
      success: true,
      message: `Template ${updated.isCardSetting ? 'added to' : 'removed from'} card settings`,
      data: {
        id: updated.id.toString(),
        isCardSetting: updated.isCardSetting
      }
    });
  } catch (error) {
    console.error('❌ Error toggling card setting:', error);
    res.status(500).json({
      success: false,
      error: 'Error toggling card setting',
      details: error.message
    });
  }
};


