import prisma from "../../config/database.js";

import { processFile, deleteLocalFile, DIRS } from "../../services/uploadeService.js";

function format(ct) {
  return {
    id:    ct.id,
    name:  ct.name,
    color: ct.color,
    image: ct.image ?? "/placeholder.svg",
    active: ct.active,
    createdAt: ct.createdAt,
    updatedAt: ct.updatedAt,
  };
}

export const listCardTypes = async (req, res, next) => {
  try {
    const data = await prisma.cardType.findMany({ orderBy: { createdAt: "asc" } });
    res.json({ success: true, data: data.map(format) });
  } catch (e) { next(e); }
};


export const getCardType = async (req, res, next) => {
  try {
    const ct = await prisma.cardType.findUnique({ where: { id: req.params.id } });
    if (!ct) return res.status(404).json({ success: false, message: "Type de carte introuvable" });
    res.json({ success: true, data: format(ct) });
  } catch (e) { next(e); }
};

export const createCardType = async (req, res, next) => {
  try {
    const { name, color, image, active } = req.validatedBody;
 
    const id = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || `type-${Date.now()}`;
    const exists = await prisma.cardType.findUnique({ where: { id } });
    if (exists) return res.status(409).json({ success: false, message: `L'id "${id}" existe déjà` });
 
    // Sauvegarder l'image sur disque
    const uploaded = await processFile(image, DIRS.card_type, "image");
 
    const ct = await prisma.cardType.create({
      data: { id, name, color, image: uploaded?.url ?? null, active },
    });
 
    res.status(201).json({ success: true, data: format(ct) });
  } catch (e) { next(e); }
};


export const updateCardType = async (req, res, next) => {
  try {
    const existing = await prisma.cardType.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, message: "Type de carte introuvable" });
 
    const { name, color, image, active } = req.validatedBody;
 
    // Traiter la nouvelle image si fournie
    let newImageUrl = undefined;
    if (image !== undefined) {
      const uploaded = await processFile(image, DIRS.card_type, "image");
      newImageUrl = uploaded?.url ?? null;
      // Supprimer l'ancienne image si elle a changé
      if (newImageUrl && newImageUrl !== existing.image) {
        deleteLocalFile(existing.image);
      }
    }
 
    const ct = await prisma.cardType.update({
      where: { id: req.params.id },
      data: {
        ...(name         !== undefined && { name }),
        ...(color        !== undefined && { color }),
        ...(active       !== undefined && { active }),
        ...(newImageUrl  !== undefined && { image: newImageUrl }),
      },
    });
 
    res.json({ success: true, data: format(ct) });
  } catch (e) { next(e); }
};


export const deleteCardType = async (req, res, next) => {
  try {
    const existing = await prisma.cardType.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, message: "Type de carte introuvable" });
 
    deleteLocalFile(existing.image);   // supprimer le fichier disque
      await prisma.$transaction([
        prisma.cardTypePrice.deleteMany({ where: { cardTypeId: req.params.id } }),
        prisma.cardType.delete({ where: { id: req.params.id } }),
      ]);
    res.json({ success: true, message: "Type de carte supprimé" });
  } catch (e) { next(e); }
};

export const toggleCardType = async (req, res, next) => {
  try {
    const ct = await prisma.cardType.findUnique({ where: { id: req.params.id } });
    if (!ct) return res.status(404).json({ success: false, message: "Type de carte introuvable" });
    const updated = await prisma.cardType.update({
      where: { id: req.params.id }, data: { active: !ct.active },
    });
    res.json({ success: true, data: format(updated) });
  } catch (e) { next(e); }
};

