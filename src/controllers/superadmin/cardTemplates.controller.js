import prisma from "../../config/database.js";

function formatTemplate(template) {
  let orientations = [];
  if (template.orientations) {
    try {
      orientations = JSON.parse(template.orientations);
    } catch {
      orientations = [template.orientations];
    }
  } else if (template.orientation) {
    orientations = [template.orientation];
  }
  return {
    id: template.id.toString(),
    name: template.name,
    platform: template.platform,
    
    // Content
    businessName: template.businessName,
    slogan: template.slogan,
    cta: template.cta,
    logoUrl: template.logoUrl,
    
    // ✅ Layout - NOUVEAU : Support orientations multiples
    orientation: template.orientation,
    orientations: orientations,
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

    // Serial Number Tag
    showSerialNumber:      template.showSerialNumber ?? true,
    serialNumber:          template.serialNumber ?? "NFC-123456",
    serialNumberTextColor: template.serialNumberTextColor ?? "#FFFFFF",
    serialNumberBgColor:   template.serialNumberBgColor ?? "transparent",
    serialNumberFontSize:  template.serialNumberFontSize ?? 10,
    serialNumberPaddingX:  template.serialNumberPaddingX ?? 8,
    serialNumberPaddingY:  template.serialNumberPaddingY ?? 3,
    serialNumberRadius:    template.serialNumberRadius ?? 999,

    // Platform Icon Background — FRONT
    platformIconBgEnabled: template.platformIconBgEnabled ?? false,
    platformIconBgColor:   template.platformIconBgColor   ?? "#FFFFFF",
    platformIconBgPadding: template.platformIconBgPadding ?? 4,
    platformIconBgRadius:  template.platformIconBgRadius  ?? 999,
    platformIconBgShadow:  template.platformIconBgShadow  ?? false,

    // Back-specific icon & instruction settings
    backShowGoogleIcon:        template.backShowGoogleIcon        ?? true,
    backGoogleIconSize:        template.backGoogleIconSize        ?? 20,
    backPlatformIconBgEnabled: template.backPlatformIconBgEnabled ?? false,
    backPlatformIconBgColor:   template.backPlatformIconBgColor   ?? "#FFFFFF",
    backPlatformIconBgPadding: template.backPlatformIconBgPadding ?? 4,
    backPlatformIconBgRadius:  template.backPlatformIconBgRadius  ?? 999,
    backPlatformIconBgShadow:  template.backPlatformIconBgShadow  ?? false,
    backInstructionTextAlign:  template.backInstructionTextAlign  ?? "left",

    // Back-specific Serial Number (null = inherit from front)
    backShowSerialNumber:      template.backShowSerialNumber      ?? null,
    backSerialNumberTextColor: template.backSerialNumberTextColor ?? null,
    backSerialNumberBgColor:   template.backSerialNumberBgColor   ?? null,
    backSerialNumberFontSize:  template.backSerialNumberFontSize  ?? null,
    backSerialNumberPaddingX:  template.backSerialNumberPaddingX  ?? null,
    backSerialNumberPaddingY:  template.backSerialNumberPaddingY  ?? null,
    backSerialNumberRadius:    template.backSerialNumberRadius    ?? null,

    // Back-specific Typography — Business (null = inherit from front)
    backNameFont:          template.backNameFont          ?? null,
    backNameFontSize:      template.backNameFontSize      ?? null,
    backNameFontWeight:    template.backNameFontWeight    ?? null,
    backNameLetterSpacing: template.backNameLetterSpacing ?? null,
    backNameTextTransform: template.backNameTextTransform ?? null,
    backNameLineHeight:    template.backNameLineHeight    ?? null,

    // Back-specific Typography — Slogan (null = inherit from front)
    backSloganFont:          template.backSloganFont          ?? null,
    backSloganFontSize:      template.backSloganFontSize      ?? null,
    backSloganFontWeight:    template.backSloganFontWeight    ?? null,
    backSloganLetterSpacing: template.backSloganLetterSpacing ?? null,
    backSloganTextTransform: template.backSloganTextTransform ?? null,
    backSloganLineHeight:    template.backSloganLineHeight    ?? null,

    // Back-specific Typography — Visual (null = inherit from front)
    backTextShadow: template.backTextShadow ?? null,

    // Back-specific Instructions (null = inherit from front)
    backInstructionFont:          template.backInstructionFont          ?? null,
    backInstructionFontSize:      template.backInstructionFontSize      ?? null,
    backInstructionFontWeight:    template.backInstructionFontWeight    ?? null,
    backInstructionLetterSpacing: template.backInstructionLetterSpacing ?? null,
    backInstructionLineHeight:    template.backInstructionLineHeight    ?? null,
    backCheckStrokeWidth:         template.backCheckStrokeWidth != null ? template.backCheckStrokeWidth / 10 : null,
    backCtaPaddingTop:            template.backCtaPaddingTop            ?? null,

    // Back-specific Platform Icon type (null = inherit from front)
    backUseLogo:        template.backUseLogo        ?? null,
    backSelectedIconId: template.backSelectedIconId ?? null,
    backIconColor:      template.backIconColor      ?? null,

    // ✅ Platform logo/icon settings - NOUVEAU
    useLogo: template.useLogo ?? true,
    selectedIconId: template.selectedIconId,
    iconColor: template.iconColor,
    
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

     let orientationsValue = null;
    if (data.orientations) {
      if (Array.isArray(data.orientations)) {
        orientationsValue = JSON.stringify(data.orientations.map(o => o.toLowerCase()));
      } else if (typeof data.orientations === 'string') {
        try {
          const parsed = JSON.parse(data.orientations);
          orientationsValue = Array.isArray(parsed) ? JSON.stringify(parsed.map(o => o.toLowerCase())) : data.orientations.toLowerCase();
        } catch { orientationsValue = data.orientations.toLowerCase(); }
      }
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
        orientation: (data.orientation || 'landscape').toLowerCase(),
        orientations: orientationsValue,
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

        // Serial Number Tag
        showSerialNumber:      data.showSerialNumber !== undefined ? data.showSerialNumber : true,
        serialNumber:          data.serialNumber || 'NFC-123456',
        serialNumberTextColor: data.serialNumberTextColor || '#FFFFFF',
        serialNumberBgColor:   data.serialNumberBgColor || 'transparent',
        serialNumberFontSize:  data.serialNumberFontSize ?? 10,
        serialNumberPaddingX:  data.serialNumberPaddingX ?? 8,
        serialNumberPaddingY:  data.serialNumberPaddingY ?? 3,
        serialNumberRadius:    data.serialNumberRadius ?? 999,

        // Platform Icon Background — FRONT
        platformIconBgEnabled: data.platformIconBgEnabled ?? false,
        platformIconBgColor:   data.platformIconBgColor   ?? "#FFFFFF",
        platformIconBgPadding: data.platformIconBgPadding ?? 4,
        platformIconBgRadius:  data.platformIconBgRadius  ?? 999,
        platformIconBgShadow:  data.platformIconBgShadow  ?? false,

        // Back-specific icon & instruction settings
        backShowGoogleIcon:        data.backShowGoogleIcon        ?? true,
        backGoogleIconSize:        data.backGoogleIconSize        ?? 20,
        backPlatformIconBgEnabled: data.backPlatformIconBgEnabled ?? false,
        backPlatformIconBgColor:   data.backPlatformIconBgColor   ?? "#FFFFFF",
        backPlatformIconBgPadding: data.backPlatformIconBgPadding ?? 4,
        backPlatformIconBgRadius:  data.backPlatformIconBgRadius  ?? 999,
        backPlatformIconBgShadow:  data.backPlatformIconBgShadow  ?? false,
        backInstructionTextAlign:  data.backInstructionTextAlign  ?? 'left',

        // Back-specific Serial Number (null = inherit from front)
        backShowSerialNumber:      data.backShowSerialNumber      ?? null,
        backSerialNumberTextColor: data.backSerialNumberTextColor ?? null,
        backSerialNumberBgColor:   data.backSerialNumberBgColor   ?? null,
        backSerialNumberFontSize:  data.backSerialNumberFontSize  ?? null,
        backSerialNumberPaddingX:  data.backSerialNumberPaddingX  ?? null,
        backSerialNumberPaddingY:  data.backSerialNumberPaddingY  ?? null,
        backSerialNumberRadius:    data.backSerialNumberRadius    ?? null,

        // Back-specific Typography — Business
        backNameFont:          data.backNameFont          ?? null,
        backNameFontSize:      data.backNameFontSize      ?? null,
        backNameFontWeight:    data.backNameFontWeight    ?? null,
        backNameLetterSpacing: data.backNameLetterSpacing ?? null,
        backNameTextTransform: data.backNameTextTransform ?? null,
        backNameLineHeight:    data.backNameLineHeight    ?? null,

        // Back-specific Typography — Slogan
        backSloganFont:          data.backSloganFont          ?? null,
        backSloganFontSize:      data.backSloganFontSize      ?? null,
        backSloganFontWeight:    data.backSloganFontWeight    ?? null,
        backSloganLetterSpacing: data.backSloganLetterSpacing ?? null,
        backSloganTextTransform: data.backSloganTextTransform ?? null,
        backSloganLineHeight:    data.backSloganLineHeight    ?? null,

        // Back-specific Typography — Visual
        backTextShadow: data.backTextShadow ?? null,

        // Back-specific Instructions
        backInstructionFont:          data.backInstructionFont          ?? null,
        backInstructionFontSize:      data.backInstructionFontSize      ?? null,
        backInstructionFontWeight:    data.backInstructionFontWeight    ?? null,
        backInstructionLetterSpacing: data.backInstructionLetterSpacing ?? null,
        backInstructionLineHeight:    data.backInstructionLineHeight    ?? null,
        backCheckStrokeWidth:         data.backCheckStrokeWidth != null ? Math.round(data.backCheckStrokeWidth * 10) : null,
        backCtaPaddingTop:            data.backCtaPaddingTop            ?? null,

        // Back-specific Platform Icon type
        backUseLogo:        data.backUseLogo        ?? null,
        backSelectedIconId: data.backSelectedIconId ?? null,
        backIconColor:      data.backIconColor      ?? null,

        // ✅ Platform logo/icon settings - NOUVEAU
        useLogo: data.useLogo ?? true,
        selectedIconId: data.selectedIconId || null,
        iconColor: data.iconColor || data.accentColor || '#4285F4',

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
    if (data.orientation) updateData.orientation = data.orientation.toLowerCase();
    if (data.orientations !== undefined) {
      if (Array.isArray(data.orientations)) {
        updateData.orientations = JSON.stringify(data.orientations.map(o => o.toLowerCase()));
      }
    }
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

    // Serial Number Tag
    if (data.showSerialNumber !== undefined)      updateData.showSerialNumber      = data.showSerialNumber;
    if (data.serialNumber !== undefined)          updateData.serialNumber          = data.serialNumber;
    if (data.serialNumberTextColor !== undefined) updateData.serialNumberTextColor = data.serialNumberTextColor;
    if (data.serialNumberBgColor !== undefined)   updateData.serialNumberBgColor   = data.serialNumberBgColor;
    if (data.serialNumberFontSize !== undefined)  updateData.serialNumberFontSize  = data.serialNumberFontSize;
    if (data.serialNumberPaddingX !== undefined)  updateData.serialNumberPaddingX  = data.serialNumberPaddingX;
    if (data.serialNumberPaddingY !== undefined)  updateData.serialNumberPaddingY  = data.serialNumberPaddingY;
    if (data.serialNumberRadius !== undefined)    updateData.serialNumberRadius    = data.serialNumberRadius;

    // Platform Icon Background — FRONT
    if (data.platformIconBgEnabled !== undefined) updateData.platformIconBgEnabled = data.platformIconBgEnabled;
    if (data.platformIconBgColor !== undefined)   updateData.platformIconBgColor   = data.platformIconBgColor;
    if (data.platformIconBgPadding !== undefined) updateData.platformIconBgPadding = data.platformIconBgPadding;
    if (data.platformIconBgRadius !== undefined)  updateData.platformIconBgRadius  = data.platformIconBgRadius;
    if (data.platformIconBgShadow !== undefined)  updateData.platformIconBgShadow  = data.platformIconBgShadow;

    // Back-specific icon & instruction settings
    if (data.backShowGoogleIcon        !== undefined) updateData.backShowGoogleIcon        = data.backShowGoogleIcon;
    if (data.backGoogleIconSize        !== undefined) updateData.backGoogleIconSize        = data.backGoogleIconSize;
    if (data.backPlatformIconBgEnabled !== undefined) updateData.backPlatformIconBgEnabled = data.backPlatformIconBgEnabled;
    if (data.backPlatformIconBgColor   !== undefined) updateData.backPlatformIconBgColor   = data.backPlatformIconBgColor;
    if (data.backPlatformIconBgPadding !== undefined) updateData.backPlatformIconBgPadding = data.backPlatformIconBgPadding;
    if (data.backPlatformIconBgRadius  !== undefined) updateData.backPlatformIconBgRadius  = data.backPlatformIconBgRadius;
    if (data.backPlatformIconBgShadow  !== undefined) updateData.backPlatformIconBgShadow  = data.backPlatformIconBgShadow;
    if (data.backInstructionTextAlign  !== undefined) updateData.backInstructionTextAlign  = data.backInstructionTextAlign;

    // Back-specific Serial Number
    if (data.backShowSerialNumber      !== undefined) updateData.backShowSerialNumber      = data.backShowSerialNumber;
    if (data.backSerialNumberTextColor !== undefined) updateData.backSerialNumberTextColor = data.backSerialNumberTextColor;
    if (data.backSerialNumberBgColor   !== undefined) updateData.backSerialNumberBgColor   = data.backSerialNumberBgColor;
    if (data.backSerialNumberFontSize  !== undefined) updateData.backSerialNumberFontSize  = data.backSerialNumberFontSize;
    if (data.backSerialNumberPaddingX  !== undefined) updateData.backSerialNumberPaddingX  = data.backSerialNumberPaddingX;
    if (data.backSerialNumberPaddingY  !== undefined) updateData.backSerialNumberPaddingY  = data.backSerialNumberPaddingY;
    if (data.backSerialNumberRadius    !== undefined) updateData.backSerialNumberRadius    = data.backSerialNumberRadius;

    // Back-specific Typography — Business
    if (data.backNameFont          !== undefined) updateData.backNameFont          = data.backNameFont;
    if (data.backNameFontSize      !== undefined) updateData.backNameFontSize      = data.backNameFontSize;
    if (data.backNameFontWeight    !== undefined) updateData.backNameFontWeight    = data.backNameFontWeight;
    if (data.backNameLetterSpacing !== undefined) updateData.backNameLetterSpacing = data.backNameLetterSpacing;
    if (data.backNameTextTransform !== undefined) updateData.backNameTextTransform = data.backNameTextTransform;
    if (data.backNameLineHeight    !== undefined) updateData.backNameLineHeight    = data.backNameLineHeight;

    // Back-specific Typography — Slogan
    if (data.backSloganFont          !== undefined) updateData.backSloganFont          = data.backSloganFont;
    if (data.backSloganFontSize      !== undefined) updateData.backSloganFontSize      = data.backSloganFontSize;
    if (data.backSloganFontWeight    !== undefined) updateData.backSloganFontWeight    = data.backSloganFontWeight;
    if (data.backSloganLetterSpacing !== undefined) updateData.backSloganLetterSpacing = data.backSloganLetterSpacing;
    if (data.backSloganTextTransform !== undefined) updateData.backSloganTextTransform = data.backSloganTextTransform;
    if (data.backSloganLineHeight    !== undefined) updateData.backSloganLineHeight    = data.backSloganLineHeight;

    // Back-specific Typography — Visual
    if (data.backTextShadow !== undefined) updateData.backTextShadow = data.backTextShadow;

    // Back-specific Instructions
    if (data.backInstructionFont          !== undefined) updateData.backInstructionFont          = data.backInstructionFont;
    if (data.backInstructionFontSize      !== undefined) updateData.backInstructionFontSize      = data.backInstructionFontSize;
    if (data.backInstructionFontWeight    !== undefined) updateData.backInstructionFontWeight    = data.backInstructionFontWeight;
    if (data.backInstructionLetterSpacing !== undefined) updateData.backInstructionLetterSpacing = data.backInstructionLetterSpacing;
    if (data.backInstructionLineHeight    !== undefined) updateData.backInstructionLineHeight    = data.backInstructionLineHeight;
    if (data.backCheckStrokeWidth         !== undefined) updateData.backCheckStrokeWidth         = data.backCheckStrokeWidth != null ? Math.round(data.backCheckStrokeWidth * 10) : null;
    if (data.backCtaPaddingTop            !== undefined) updateData.backCtaPaddingTop            = data.backCtaPaddingTop;

    // Back-specific Platform Icon type
    if (data.backUseLogo        !== undefined) updateData.backUseLogo        = data.backUseLogo;
    if (data.backSelectedIconId !== undefined) updateData.backSelectedIconId = data.backSelectedIconId;
    if (data.backIconColor      !== undefined) updateData.backIconColor      = data.backIconColor;

    // ✅ Platform logo/icon settings - NOUVEAU
    if (data.useLogo !== undefined) updateData.useLogo = data.useLogo;
    if (data.selectedIconId !== undefined) updateData.selectedIconId = data.selectedIconId;
    if (data.iconColor !== undefined) updateData.iconColor = data.iconColor;
    
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

     let orientationsValue = null;
    if (original.orientations) {
      if (typeof original.orientations === 'string') {
        try {
          const parsed = JSON.parse(original.orientations);
          orientationsValue = JSON.stringify(parsed);  // Re-stringify pour la nouvelle entrée
        } catch {
          orientationsValue = original.orientations;  // Garder tel quel si parsing échoue
        }
      } else {
        orientationsValue = original.orientations;
      }
    } else if (original.orientation) {
      orientationsValue = JSON.stringify([original.orientation]);
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
        orientations: orientationsValue,

        
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

        // Serial Number Tag
        showSerialNumber:      original.showSerialNumber ?? true,
        serialNumber:          original.serialNumber || 'NFC-123456',
        serialNumberTextColor: original.serialNumberTextColor || '#FFFFFF',
        serialNumberBgColor:   original.serialNumberBgColor || 'transparent',
        serialNumberFontSize:  original.serialNumberFontSize ?? 10,
        serialNumberPaddingX:  original.serialNumberPaddingX ?? 8,
        serialNumberPaddingY:  original.serialNumberPaddingY ?? 3,
        serialNumberRadius:    original.serialNumberRadius ?? 999,

        // Platform Icon Background
        platformIconBgEnabled: original.platformIconBgEnabled ?? false,
        platformIconBgColor:   original.platformIconBgColor   ?? "#FFFFFF",
        platformIconBgPadding: original.platformIconBgPadding ?? 4,
        platformIconBgRadius:  original.platformIconBgRadius  ?? 999,
        platformIconBgShadow:  original.platformIconBgShadow  ?? false,

        useLogo: original.useLogo ?? true,
        selectedIconId: original.selectedIconId || null,
        iconColor: original.iconColor || original.accentColor || '#4285F4',
        
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


