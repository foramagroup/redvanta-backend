// src/controllers/nfcCards.controller.js
// ─────────────────────────────────────────────────────────────
// Endpoints CLIENT ADMIN — vue MyDesigns / NFC Cards
//
// Toutes les routes sont sous /api/nfc
// Accès : admin de la company (sa_token ou admin_token)
// Scope : uniquement les cartes de SA company
//
// Endpoints :
//   GET  /api/nfc/stats               → statistiques globales
//   GET  /api/nfc/cards               → liste paginée + filtres
//   GET  /api/nfc/cards/:uid          → détail d'une carte
//   GET  /api/nfc/cards/:uid/export   → télécharger ?format=svg|png|pdf
//   POST /api/nfc/cards/:uid/regenerate → regénérer SVG+PNG+PDF

import path   from "path";
import fs     from "fs";
import prisma from "../config/database.js";
import { generateCardExport, deriveCardUrls, deleteCardExportFiles } from "../services/cardExport.service.js";
import { formatNfcCard } from "../services/nfc.service.js";

// ─── Helpers ──────────────────────────────────────────────────

function getCompanyId(req) {
  const id = req.user?.companyId;
  if (!id) throw Object.assign(new Error("Aucune company active"), { status: 403 });
  return parseInt(id);
}

// Include Prisma pour les cartes avec toutes leurs relations
const CARD_INCLUDE = {
  design:   true,
  location: { select: { id: true, name: true, address: true } },
  tag:      { select: { id: true, tagSerial: true, chipType: true, status: true } },
  company:  { select: { name: true, primaryColor: true, logo: true } },
  orderItem: {
    include: {
      order:   { select: { id: true, orderNumber: true, status: true } },
      product: { include: { translations: { take: 1, orderBy: { langId: "asc" } } } },
    },
  },
};


// Format étendu pour la vue client (inclut les URLs d'export)
function formatCardWithExports(card) {
    const base = formatNfcCard(card);
    return {
        ...base,
        // URLs des 3 formats d'export dérivées depuis qrCodeUrl
        exports: deriveCardUrls(card.qrCodeUrl),
        // Infos commande liée
        order: card.orderItem?.order
        ? { id: card.orderItem.order.id, orderNumber: card.orderItem.order.orderNumber, status: card.orderItem.order.status }
        : null,

        productName: card.orderItem?.product?.translations?.[0]?.title ?? null,
        // Design (résumé — pas tous les champs)
        designSummary: card.design ? {
        id:          card.design.id,
        businessName: card.design.businessName,
        cardModel:   card.design.cardModel,
        orientation: card.design.orientation,
        status:      card.design.status,
        bgColor:     card.design.bgColor,
        accentColor: card.design.accentColor,
        } : null,
    };
}

// ─────────────────────────────────────────────────────────────
// GET /api/nfc/stats
// Statistiques des cartes de la company
// ─────────────────────────────────────────────────────────────
export const getMyNfcStats = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const [total, active, byStatus, agg] = await Promise.all([
      prisma.nFCCard.count({ where: { companyId } }),
      prisma.nFCCard.count({ where: { companyId, active: true } }),
      prisma.nFCCard.groupBy({
        by:    ["status"],
        where: { companyId },
        _count: { id: true },
      }),
      prisma.nFCCard.aggregate({
        where: { companyId },
        _sum:  { scanCount: true, googleRedirectCount: true },
      }),
    ]);

    const statusMap = {};

    byStatus.forEach((s) => { statusMap[s.status] = s._count.id; });


    res.json({
      success: true,
      data: {
        total,
        active,
        inactive:       total - active,
        notProgrammed:  statusMap["NOT_PROGRAMMED"] ?? 0,
        printed:        statusMap["PRINTED"]         ?? 0,
        shipped:        statusMap["SHIPPED"]         ?? 0,
        totalScans:     agg._sum.scanCount            ?? 0,
        totalRedirects: agg._sum.googleRedirectCount  ?? 0,
      },
    });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// GET /api/nfc/cards
// Liste paginée des cartes de la company
// Query : ?status=&active=true|false&locationId=&search=&page=1&limit=20
// ─────────────────────────────────────────────────────────────

export const listMyCards = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const { status, active, locationId, search, page = "1", limit = "20" } = req.query;

    const where = { companyId };
    if (status)              where.status     = status;
    if (active !== undefined) where.active    = active === "true";
    if (locationId)          where.locationId = parseInt(locationId);
    if (search) {
      where.OR = [
        { uid:          { contains: search } },
        { locationName: { contains: search } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page));
    const take    = Math.min(100, parseInt(limit));
    const skip    = (pageNum - 1) * take;

    const [cards, total] = await Promise.all([
      prisma.nFCCard.findMany({ where, include: CARD_INCLUDE, orderBy: { generatedAt: "desc" }, skip, take }),
      prisma.nFCCard.count({ where }),
    ]);

    res.json({
      success: true,
      data:    cards.map(formatCardWithExports),
      meta:    { total, page: pageNum, limit: take, pages: Math.ceil(total / take) },
    });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// GET /api/nfc/cards/:uid
// Détail complet d'une carte (avec design complet)
// ─────────────────────────────────────────────────────────────

export const getMyCard = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const { uid }   = req.params;

    const card = await prisma.nFCCard.findFirst({ where: { uid, companyId }, include: CARD_INCLUDE });
    if (!card) return res.status(404).json({ success: false, error: "Carte introuvable" });

    res.json({ success: true, data: formatCardWithExports(card) });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// GET /api/nfc/cards/:uid/export?format=svg|png|pdf
// Téléchargement du fichier d'impression
//
// Feuille générée : RECTO en haut / VERSO en bas
// Dimensions :
//   SVG : vectoriel, toute résolution
//   PNG : 1011 × 1336 px @ 300 DPI (recto 638px + gap 60px + verso 638px)
//   PDF : A4 (595 × 842 pt), carte centré recto y=80pt / verso y=460pt
//
// Si le fichier n'existe pas → généré à la volée depuis le design
// ─────────────────────────────────────────────────────────────

export const downloadCardExport = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const { uid }   = req.params;
    const format    = (req.query.format ?? "pdf").toLowerCase();

    if (!["svg", "png", "pdf"].includes(format)) {
      return res.status(422).json({ success: false, error: "format doit être svg | png | pdf" });
    }

    // Vérifier que la carte appartient à cette company
    const card = await prisma.nFCCard.findFirst({
      where:   { uid, companyId },
      include: { design: true },
    });
    if (!card) return res.status(404).json({ success: false, error: "Carte introuvable" });
    if (!card.payload) {
      return res.status(422).json({ success: false, error: "Carte sans payload — impossible de générer le QR" });
    }

    const EXPORT_DIR = path.resolve("public/uploads/cards");
    const filePath   = path.join(EXPORT_DIR, `${uid}.${format}`);

    // Générer si le fichier n'existe pas encore
    if (!fs.existsSync(filePath)) {
      console.log(`[nfc] Génération à la volée : ${format.toUpperCase()} pour uid=${uid}`);
      await generateCardExport(card, card.design);
    }

    if (!fs.existsSync(filePath)) {
      return res.status(500).json({ success: false, error: "Échec de génération du fichier d'export" });
    }

    // Content-Type et nom de fichier
    const mimeTypes = { svg: "image/svg+xml", png: "image/png", pdf: "application/pdf" };
    const locationLabel = card.locationName ?? "card";
    const safeName  = locationLabel.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    const filename  = `${safeName}-${uid.slice(0, 8)}.${format}`;

    res.setHeader("Content-Type",        mimeTypes[format]);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control",       "private, max-age=3600");

    fs.createReadStream(filePath).pipe(res);
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// POST /api/nfc/cards/:uid/regenerate
// Regénérer les exports SVG + PNG + PDF
// (utile si le design a changé ou si les fichiers sont perdus)
// ─────────────────────────────────────────────────────────────

export const regenerateCardExport = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const { uid }   = req.params;

    const card = await prisma.nFCCard.findFirst({
      where:   { uid, companyId },
      include: { design: true },
    });
    if (!card)         return res.status(404).json({ success: false, error: "Carte introuvable" });
    if (!card.payload) return res.status(422).json({ success: false, error: "Carte sans payload" });

    // Supprimer les anciens fichiers
    await deleteCardExportFiles(uid);

    // Regénérer avec le design actuel
    const exports = await generateCardExport(card, card.design);

    // Mettre à jour qrCodeUrl si nécessaire
    if (exports.svgUrl !== card.qrCodeUrl) {
      await prisma.nFCCard.update({ where: { uid }, data: { qrCodeUrl: exports.svgUrl } });
    }

    res.json({ success: true, message: "Exports regénérés", data: exports });
  } catch (e) { next(e); }
};