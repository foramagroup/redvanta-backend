import prisma from "../../config/database.js";

function formatTemplate(t) {
  let gradient;
  try {
    gradient = Array.isArray(t.gradient) ? t.gradient : JSON.parse(t.gradient || '["#4285F4"]');
  } catch {
    gradient = ["#4285F4"];
  }

  return {
    id: t.id,
    name: t.name,
    platform: t.platform,
    orientation: t.orientation,
    model: t.model,
    colorMode: t.colorMode,
    gradient,
    accentColor: t.accentColor,
    textColor: t.textColor,
    bandColor1: t.bandColor1,
    bandColor2: t.bandColor2,
    qrColor: t.qrColor,
    starsColor: t.starsColor,
    iconsColor: t.iconsColor,
    pattern: t.pattern,
    bandPosition: t.bandPosition,
    frontBandHeight: t.frontBandHeight,
    backBandHeight: t.backBandHeight,
    businessName: t.businessName,
    slogan: t.slogan,
    cta: t.cta,
    logoUrl: t.logoUrl,
    logoPosition: t.logoPosition,
    logoSize: t.logoSize,
    qrPosition: t.qrPosition,
    qrSize: t.qrSize,
    showNfcIcon: t.showNfcIcon,
    showGoogleIcon: t.showGoogleIcon,
    showSerialNumber: t.showSerialNumber,
    isDefault: t.isDefault,
    isActive: t.isActive,
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
