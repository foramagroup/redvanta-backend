
import prisma  from "../../config/database.js";
import { formatNfcCard, formatNfcTag, assignTagToCard } from "../../services/nfc.service.js";

// GET /api/superadmin/nfc/cards — toutes les cartes
export const listAllCards = async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const search = req.query.search?.trim() || "";
    const where  = {
      ...(req.query.status && { status: req.query.status }),
      ...(search && { OR: [{ uid: { contains: search } }, { locationName: { contains: search } }] }),
    };
    const [cards, total] = await Promise.all([
      prisma.nFCCard.findMany({ where, include: { tag: true, company: { select: { name: true } } }, orderBy: { generatedAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.nFCCard.count({ where }),
    ]);
    res.json({ success: true, data: cards.map(formatNfcCard), meta: { total, page, last_page: Math.ceil(total / limit) } });
  } catch (e) { next(e); }
};

// GET /api/superadmin/nfc/tags — stock de puces hardware
export const listAllTags = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const where = { ...(req.query.status && { status: req.query.status }) };
    const [tags, total] = await Promise.all([
      prisma.nFCTag.findMany({ where, include: { card: { select: { uid: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.nFCTag.count({ where }),
    ]);
    res.json({ success: true, data: tags.map(formatNfcTag), meta: { total, page } });
  } catch (e) { next(e); }
};

// POST /api/superadmin/nfc/tags — ajouter des puces au stock
export const addTag = async (req, res, next) => {
  try {
    const { tagSerial, chipType } = req.body;
    const tag = await prisma.nFCTag.create({ data: { tagSerial: tagSerial?.trim() ?? null, chipType: chipType?.trim() ?? null, status: "NEW" } });
    res.status(201).json({ success: true, data: formatNfcTag(tag) });
  } catch (e) { next(e); }
};

// PATCH /api/superadmin/nfc/tags/:id/assign — assigner une puce à une carte
export const assignTag = async (req, res, next) => {
  try {
    const tagId   = parseInt(req.params.id);
    const { cardUid } = req.body;
    await assignTagToCard(cardUid, tagId);
    res.json({ success: true, message: `NFCTag #${tagId} assigné à NFCCard uid=${cardUid}` });
  } catch (e) { next(e); }
};

// PATCH /api/superadmin/nfc/cards/:uid/toggle — activer/désactiver une carte
export const toggleCard = async (req, res, next) => {
  try {
    const { uid }  = req.params;
    const card     = await prisma.nFCCard.findUnique({ where: { uid } });
    if (!card) return res.status(404).json({ success: false, error: "Carte introuvable" });
    const updated = await prisma.nFCCard.update({ where: { uid }, data: { active: !card.active, status: !card.active ? card.status : "DISABLED" } });
    res.json({ success: true, data: formatNfcCard(updated) });
  } catch (e) { next(e); }
};

