import prisma from "../../config/database.js";
import { formatNfcTag } from "../../services/nfc.service.js";

// GET /api/superadmin/nfc/stats
export const getTagsStats = async (req, res, next) => {
  try {
    const stats = await prisma.nFCTag.groupBy({
      by: ['status'],
      _count: { _all: true }
    });
    const result = {
      total: stats.reduce((acc, curr) => acc + curr._count._all, 0),
      NEW: 0,
      ASSIGNED: 0,
      PROGRAMMED: 0,
      DEFECTIVE: 0
    };
    stats.forEach(s => {
      result[s.status] = s._count._all;
    });
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
};

// GET /api/superadmin/nfc/tags
export const listTags = async (req, res, next) => {
  try {
    const { status, search, page = "1", limit = "20" } = req.query;
    const where = {};
    
    if (status && status !== "all") where.status = status;
    if (search) where.tagSerial = { contains: search };

    const pageNum = Math.max(1, parseInt(page));
    const take = Math.min(100, parseInt(limit));
    const skip = (pageNum - 1) * take;

    const [tags, total] = await Promise.all([
      prisma.nFCTag.findMany({
        where,
        include: { 
            card: { select: { id: true, uid: true, locationName: true } } 
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.nFCTag.count({ where }),
    ]);

    res.json({
      success: true,
      data: tags.map(t => ({
        ...formatNfcTag(t),
        assignedCardId: t.card?.id || null // Pour correspondre au champ 'assignedCardId' du front
      })),
      meta: { total, page: pageNum, limit: take, pages: Math.ceil(total / take) },
    });
  } catch (e) { next(e); }
};

// POST /api/superadmin/nfc/tags
export const createTags = async (req, res, next) => {
  try {
    const { tags, tagSerial, count } = req.body;
    let dataToInsert = [];

    // Cas 1: Bulk generation automatique (quantité)
    if (count && count > 1) {
      for (let i = 0; i < count; i++) {
        const serial = `NFC-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
        dataToInsert.push({ tagSerial: serial, status: "NEW" });
      }
    } 
    // Cas 2: Liste précise de tags
    else if (tags && Array.isArray(tags)) {
      dataToInsert = tags.map(t => ({ tagSerial: t.tagSerial, status: "NEW" }));
    }
    // Cas 3: Un seul tag manuel
    else if (tagSerial) {
      dataToInsert = [{ tagSerial, status: "NEW" }];
    }

    const created = await prisma.nFCTag.createMany({
      data: dataToInsert,
      skipDuplicates: true,
    });

    res.status(201).json({ 
        success: true, 
        count: created.count, 
        message: `${created.count} tags ajoutés à l'inventaire` 
    });
  } catch (e) { next(e); }
};

// PATCH /api/superadmin/nfc/tags/:id/status
export const updateTagStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // "PROGRAMMED" ou "DEFECTIVE"

    const currentTag = await prisma.nFCTag.findUnique({ where: { id: parseInt(id) } });
    if (!currentTag) return res.status(404).json({ success: false, error: "Tag non trouvé" });

    const updateData = { status };

    if (status === "DEFECTIVE") {
      await prisma.nFCCard.updateMany({
        where: { tagId: parseInt(id) },
        data: { tagId: null, status: "DISABLED" }
      });
    }
    const updated = await prisma.nFCTag.update({
      where: { id: parseInt(id) },
      data: updateData,
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
};