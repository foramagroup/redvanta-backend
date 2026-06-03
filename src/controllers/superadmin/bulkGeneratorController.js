import prisma from "../../config/database.js";

function formatTemplate(t) {
  let gradient;
  try {
    gradient = Array.isArray(t.gradient) ? t.gradient : JSON.parse(t.gradient || '["#4285F4"]');
  } catch {
    gradient = ["#4285F4"];
  }

  let orientations = [];
  if (t.orientations) {
    try { orientations = JSON.parse(t.orientations); } catch { orientations = [t.orientations]; }
  } else if (t.orientation) {
    orientations = [t.orientation];
  }

  return {
    id: t.id,
    name: t.name,
    platform: t.platform,

    // Content
    businessName: t.businessName,
    slogan: t.slogan,
    cta: t.cta,
    logoUrl: t.logoUrl,

    // Layout
    orientation: t.orientation,
    orientations,
    bandPosition: t.bandPosition,
    frontBandHeight: t.frontBandHeight,
    backBandHeight: t.backBandHeight,

    // Logo and QR
    logoPosition: t.logoPosition,
    logoSize: t.logoSize,
    qrPosition: t.qrPosition,
    qrSize: t.qrSize,

    // Typography - Name
    nameFont: t.nameFont,
    nameFontSize: t.nameFontSize,
    nameFontWeight: t.nameFontWeight,
    nameLetterSpacing: t.nameLetterSpacing,
    nameTextTransform: t.nameTextTransform,
    nameLineHeight: t.nameLineHeight,
    nameTextAlign: t.nameTextAlign,

    // Typography - Slogan
    sloganFont: t.sloganFont,
    sloganFontSize: t.sloganFontSize,
    sloganFontWeight: t.sloganFontWeight,
    sloganLetterSpacing: t.sloganLetterSpacing,
    sloganTextTransform: t.sloganTextTransform,
    sloganLineHeight: t.sloganLineHeight,
    sloganTextAlign: t.sloganTextAlign,

    // Typography - Instructions
    instructionFont: t.instructionFont,
    instructionFontSize: t.instructionFontSize,
    instructionFontWeight: t.instructionFontWeight,
    instructionLetterSpacing: t.instructionLetterSpacing,
    instructionLineHeight: t.instructionLineHeight,
    instructionTextAlign: t.instructionTextAlign,

    // Instructions text
    frontLine1: t.frontLine1,
    frontLine2: t.frontLine2,
    backLine1: t.backLine1,
    backLine2: t.backLine2,

    // Icons
    checkStrokeWidth: t.checkStrokeWidth / 10, // 35 → 3.5
    nfcIconSize: t.nfcIconSize,
    googleIconSize: t.googleIconSize,
    showNfcIcon: t.showNfcIcon,
    showGoogleIcon: t.showGoogleIcon,

    // Visual
    textShadow: t.textShadow,
    ctaPaddingTop: t.ctaPaddingTop,

    // Model and mode
    model: t.model,
    colorMode: t.colorMode,

    // Element offsets
    elementOffsets: t.elementOffsets,

    // Serial Number Tag
    showSerialNumber:      t.showSerialNumber ?? true,
    serialNumber:          t.serialNumber ?? 'NFC-123456',
    serialNumberTextColor: t.serialNumberTextColor ?? '#FFFFFF',
    serialNumberBgColor:   t.serialNumberBgColor ?? 'transparent',
    serialNumberFontSize:  t.serialNumberFontSize ?? 10,
    serialNumberPaddingX:  t.serialNumberPaddingX ?? 8,
    serialNumberPaddingY:  t.serialNumberPaddingY ?? 3,
    serialNumberRadius:    t.serialNumberRadius ?? 999,

    // Platform icon background — FRONT
    platformIconBgEnabled: t.platformIconBgEnabled ?? false,
    platformIconBgColor:   t.platformIconBgColor ?? '#FFFFFF',
    platformIconBgPadding: t.platformIconBgPadding ?? 4,
    platformIconBgRadius:  t.platformIconBgRadius ?? 999,
    platformIconBgShadow:  t.platformIconBgShadow ?? false,

    // Back-specific icon & instruction settings
    backShowGoogleIcon:        t.backShowGoogleIcon        ?? true,
    backGoogleIconSize:        t.backGoogleIconSize        ?? 20,
    backPlatformIconBgEnabled: t.backPlatformIconBgEnabled ?? false,
    backPlatformIconBgColor:   t.backPlatformIconBgColor   ?? '#FFFFFF',
    backPlatformIconBgPadding: t.backPlatformIconBgPadding ?? 4,
    backPlatformIconBgRadius:  t.backPlatformIconBgRadius  ?? 999,
    backPlatformIconBgShadow:  t.backPlatformIconBgShadow  ?? false,
    backInstructionTextAlign:  t.backInstructionTextAlign  ?? 'left',

    // Back-specific Serial Number (null = inherit from front)
    backShowSerialNumber:      t.backShowSerialNumber      ?? null,
    backSerialNumberTextColor: t.backSerialNumberTextColor ?? null,
    backSerialNumberBgColor:   t.backSerialNumberBgColor   ?? null,
    backSerialNumberFontSize:  t.backSerialNumberFontSize  ?? null,
    backSerialNumberPaddingX:  t.backSerialNumberPaddingX  ?? null,
    backSerialNumberPaddingY:  t.backSerialNumberPaddingY  ?? null,
    backSerialNumberRadius:    t.backSerialNumberRadius    ?? null,

    // Back-specific Typography (null = inherit from front)
    backNameFont:          t.backNameFont          ?? null,
    backNameFontSize:      t.backNameFontSize      ?? null,
    backNameFontWeight:    t.backNameFontWeight    ?? null,
    backNameLetterSpacing: t.backNameLetterSpacing ?? null,
    backNameTextTransform: t.backNameTextTransform ?? null,
    backNameLineHeight:    t.backNameLineHeight    ?? null,
    backSloganFont:          t.backSloganFont          ?? null,
    backSloganFontSize:      t.backSloganFontSize      ?? null,
    backSloganFontWeight:    t.backSloganFontWeight    ?? null,
    backSloganLetterSpacing: t.backSloganLetterSpacing ?? null,
    backSloganTextTransform: t.backSloganTextTransform ?? null,
    backSloganLineHeight:    t.backSloganLineHeight    ?? null,
    backTextShadow:          t.backTextShadow          ?? null,

    // Back-specific Instructions (null = inherit from front)
    backInstructionFont:          t.backInstructionFont          ?? null,
    backInstructionFontSize:      t.backInstructionFontSize      ?? null,
    backInstructionFontWeight:    t.backInstructionFontWeight    ?? null,
    backInstructionLetterSpacing: t.backInstructionLetterSpacing ?? null,
    backInstructionLineHeight:    t.backInstructionLineHeight    ?? null,
    backCheckStrokeWidth:         t.backCheckStrokeWidth != null ? t.backCheckStrokeWidth / 10 : null,
    backCtaPaddingTop:            t.backCtaPaddingTop            ?? null,

    // Back-specific Platform Icon type (null = inherit from front)
    backUseLogo:        t.backUseLogo        ?? null,
    backSelectedIconId: t.backSelectedIconId ?? null,
    backIconColor:      t.backIconColor      ?? null,

    // Platform logo / icon
    useLogo: t.useLogo ?? true,
    selectedIconId: t.selectedIconId,
    iconColor: t.iconColor,

    // Colors
    gradient,
    accentColor: t.accentColor,
    textColor: t.textColor,
    bandColor1: t.bandColor1,
    bandColor2: t.bandColor2,
    qrColor: t.qrColor,
    starsColor: t.starsColor,
    iconsColor: t.iconsColor,

    // Pattern & status
    pattern: t.pattern,
    isActive: t.isActive,
    isDefault: t.isDefault,
    isCardSetting: t.isCardSetting,

    createdAt: t.createdAt.toISOString().split('T')[0],
  };
}

/**
 * GET /api/superadmin/bulk-generator/templates
 * Returns all active card templates with isCardSetting=true.
 * Query: ?platform=google (optional)
 */
export const getBulkTemplates = async (req, res) => {
  try {
    const { platform } = req.query;
    const where = { isActive: true, isCardSetting: true };
    if (platform && platform !== 'all') where.platform = platform;

    const templates = await prisma.cardTemplate.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { platform: 'asc' }, { name: 'asc' }],
    });

    const formatted = templates.map(formatTemplate);
    const grouped = formatted.reduce((acc, t) => {
      if (!acc[t.platform]) acc[t.platform] = [];
      acc[t.platform].push(t);
      return acc;
    }, {});

    res.json({ success: true, data: formatted, grouped, total: formatted.length });
  } catch (err) {
    console.error('❌ Error fetching bulk templates:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch templates', details: err.message });
  }
};

/**
 * GET /api/superadmin/bulk-generator/platforms
 * Returns distinct platform values from active templates with isCardSetting=true.
 */
export const getBulkPlatforms = async (req, res) => {
  try {
    const rows = await prisma.cardTemplate.findMany({
      where: { isActive: true, isCardSetting: true },
      select: { platform: true },
      distinct: ['platform'],
      orderBy: { platform: 'asc' },
    });
    res.json({ success: true, data: rows.map(r => r.platform) });
  } catch (err) {
    console.error('❌ Error fetching bulk platforms:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch platforms', details: err.message });
  }
};

// ── Batch CRUD ─────────────────────────────────────────────────

function formatBatch(b) {
  return {
    id: b.id,
    designId: b.designId,
    designName: b.designName,
    quantity: b.quantity,
    status: b.status,
    jobStatus: b.jobStatus,
    progress: b.progress,
    lastDone: b.lastDone,
    settings: b.settings,
    error: b.error,
    completedAt: b.completedAt?.toISOString() ?? null,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

/**
 * GET /api/superadmin/bulk-generator/batches
 * Returns all batches, newest first. Optional ?status=Generated|Archived
 */
export const getBulkBatches = async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;

    const batches = await prisma.bulkBatch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: batches.map(formatBatch), total: batches.length });
  } catch (err) {
    console.error('❌ Error fetching bulk batches:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch batches', details: err.message });
  }
};

/**
 * POST /api/superadmin/bulk-generator/batches
 * Create a new batch record.
 * Body: { id, designId, designName, quantity, settings, jobStatus?, status? }
 */
export const createBulkBatch = async (req, res) => {
  try {
    const { id, designId, designName, quantity, settings, jobStatus = 'running', status = 'Generated' } = req.body;

    if (!id || !designName || !quantity || !settings) {
      return res.status(400).json({ success: false, error: 'Missing required fields: id, designName, quantity, settings' });
    }

    const batch = await prisma.bulkBatch.create({
      data: {
        id,
        designId: designId ? Number(designId) : null,
        designName: String(designName),
        quantity: Number(quantity),
        status,
        jobStatus,
        progress: 0,
        lastDone: 0,
        settings,
      },
    });

    res.status(201).json({ success: true, data: formatBatch(batch) });
  } catch (err) {
    console.error('❌ Error creating bulk batch:', err);
    res.status(500).json({ success: false, error: 'Failed to create batch', details: err.message });
  }
};

/**
 * PATCH /api/superadmin/bulk-generator/batches/:id
 * Update progress, jobStatus, status, error, completedAt, lastDone.
 */
export const updateBulkBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { jobStatus, status, progress, lastDone, error, completedAt } = req.body;

    const data = {};
    if (jobStatus !== undefined) data.jobStatus = jobStatus;
    if (status !== undefined) data.status = status;
    if (progress !== undefined) data.progress = Number(progress);
    if (lastDone !== undefined) data.lastDone = Number(lastDone);
    if (error !== undefined) data.error = error;
    if (completedAt !== undefined) data.completedAt = completedAt ? new Date(completedAt) : null;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const batch = await prisma.bulkBatch.update({
      where: { id },
      data,
    });

    res.json({ success: true, data: formatBatch(batch) });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }
    console.error('❌ Error updating bulk batch:', err);
    res.status(500).json({ success: false, error: 'Failed to update batch', details: err.message });
  }
};

/**
 * DELETE /api/superadmin/bulk-generator/batches/:id
 * Hard delete a batch record.
 */
export const deleteBulkBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { deleteCards } = req.query;

    if (deleteCards === 'true') {
      const { count } = await prisma.nFCCard.deleteMany({ where: { batchId: id } });
      console.log(`[deleteBulkBatch] Deleted ${count} NFC cards for batch ${id}`);
    }

    await prisma.bulkBatch.delete({ where: { id } });
    res.json({ success: true, message: 'Batch deleted' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }
    console.error('❌ Error deleting bulk batch:', err);
    res.status(500).json({ success: false, error: 'Failed to delete batch', details: err.message });
  }
};
