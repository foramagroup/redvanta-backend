// src/controllers/nfcCards.superadmin.controller.js
// ─────────────────────────────────────────────────────────────
// Endpoints SUPERADMIN — vue AllDesigns / All NFC Cards
//
// Toutes les routes sont sous /api/superadmin/nfc
// Accès : superadmin uniquement
// Scope : TOUTES les companies, toutes les cartes
//
// Endpoints :
//   GET   /api/superadmin/nfc/stats                      → stats globales plateforme
//   GET   /api/superadmin/nfc/cards                      → liste toutes les cartes (filtres avancés)
//   GET   /api/superadmin/nfc/cards/:uid                 → détail complet
//   GET   /api/superadmin/nfc/cards/:uid/export          → télécharger ?format=svg|png|pdf
//   PATCH /api/superadmin/nfc/cards/:uid/status          → changer statut (production flow)
//   POST  /api/superadmin/nfc/cards/:uid/regenerate      → regénérer exports
//   POST  /api/superadmin/nfc/cards/:uid/activate        → activer manuellement
//   DELETE /api/superadmin/nfc/cards/:uid                → supprimer une carte
//
//   GET   /api/superadmin/nfc/tags                       → liste toutes les puces hardware
//   POST  /api/superadmin/nfc/tags                       → créer une puce
//   PATCH /api/superadmin/nfc/tags/:id/assign            → assigner puce → carte

import path   from "path";
import fs     from "fs";
import prisma from "../../config/database.js";
import { generateCardExport, deriveCardUrls, deleteCardExportFiles } from "../../services/cardExport.service.js";
import { formatNfcCard, formatNfcTag, assignTagToCard } from "../../services/nfc.service.js";

// ─── Include Prisma complet (superadmin voit tout) ────────────

const CARD_INCLUDE = {
  design:   true,
  location: { select: { id: true, name: true, address: true } },
  tag:      { select: { id: true, tagSerial: true, chipType: true, status: true } },
  company:  { select: { id: true, name: true, primaryColor: true, logo: true, email: true } },
  user:     { select: { id: true, name: true, email: true } },
  orderItem: {
    include: {
      order:   { select: { id: true, orderNumber: true, status: true, createdAt: true } },
      product: { include: { translations: { take: 1, orderBy: { langId: "asc" } } } },
    },
  },
};

function formatCardFull(card) {
  const base = formatNfcCard(card);
  return {
    ...base,
    exports: deriveCardUrls(card.qrCodeUrl),
    company: card.company
      ? { id: card.company.id, name: card.company.name, email: card.company.email, logo: card.company.logo }
      : null,
    user: card.user
      ? { id: card.user.id, name: card.user.name, email: card.user.email }
      : null,
    order: card.orderItem?.order
      ? { id: card.orderItem.order.id, orderNumber: card.orderItem.order.orderNumber, status: card.orderItem.order.status }
      : null,
    productName:   card.orderItem?.product?.translations?.[0]?.title ?? null,
    designSummary: card.design ? {
      id:           card.design.id,
      businessName: card.design.businessName,
      cardModel:    card.design.cardModel,
      orientation:  card.design.orientation,
      status:       card.design.status,
      bgColor:      card.design.bgColor,
      accentColor:  card.design.accentColor,
    } : null,
  };
}

// Statuts valides pour la progression production
// Accepte les valeurs en MAJUSCULES (DB) et en minuscules (frontend AllDesigns.js)
const STATUS_NORMALIZE = {
  not_programmed: "NOT_PROGRAMMED",
  printed:        "PRINTED",
  shipped:        "SHIPPED",
  delivered:      "ACTIVE",   // "delivered" côté front = "ACTIVE" côté DB
  active:         "ACTIVE",
  disabled:       "DISABLED",
};

const VALID_STATUS_TRANSITIONS = {
  NOT_PROGRAMMED: ["PRINTED"],
  PRINTED:        ["SHIPPED"],
  SHIPPED:        ["ACTIVE"],
  ACTIVE:         ["DISABLED"],
  DISABLED:       ["ACTIVE"],
};

// ─────────────────────────────────────────────────────────────
// GET /api/superadmin/nfc/stats
// Statistiques globales toutes companies
// ─────────────────────────────────────────────────────────────

export const getSuperNfcStats = async (req, res, next) => {
  try {
    const [total, active, byStatus, agg, companies] = await Promise.all([
      prisma.nFCCard.count(),
      prisma.nFCCard.count({ where: { active: true } }),
      prisma.nFCCard.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.nFCCard.aggregate({ _sum: { scanCount: true, googleRedirectCount: true } }),
      prisma.nFCCard.groupBy({ by: ["companyId"], _count: { id: true } }),
    ]);

    const statusMap = {};
    byStatus.forEach((s) => { statusMap[s.status] = s._count.id; });

    res.json({
      success: true,
      data: {
        total,
        active,
        inactive:         total - active,
        notProgrammed:    statusMap["NOT_PROGRAMMED"] ?? 0,
        printed:          statusMap["PRINTED"]         ?? 0,
        shipped:          statusMap["SHIPPED"]         ?? 0,
        totalScans:       agg._sum.scanCount            ?? 0,
        totalRedirects:   agg._sum.googleRedirectCount  ?? 0,
        companiesWithCards: companies.length,
      },
    });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// GET /api/superadmin/nfc/cards
// Liste toutes les cartes — filtres avancés
// Query : ?companyId=&status=&active=&search=&page=1&limit=20
// ─────────────────────────────────────────────────────────────

export const listAllCards = async (req, res, next) => {
  try {
    const {
      companyId, status, active, search,
      page = "1", limit = "20",
    } = req.query;

    const where = {};
    if (companyId)           where.companyId = parseInt(companyId);
    if (status)              where.status    = status;
    if (active !== undefined) where.active   = active === "true";
    if (search) {
      where.OR = [
        { uid:          { contains: search } },
        { locationName: { contains: search } },
        { company:      { name: { contains: search } } },
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
      data:    cards.map(formatCardFull),
      meta:    { total, page: pageNum, limit: take, pages: Math.ceil(total / take) },
    });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// GET /api/superadmin/nfc/cards/:uid
// Détail complet d'une carte (toutes companies)
// ─────────────────────────────────────────────────────────────

export const getSuperCard = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const card    = await prisma.nFCCard.findUnique({ where: { uid }, include: CARD_INCLUDE });
    if (!card) return res.status(404).json({ success: false, error: "Carte introuvable" });
    res.json({ success: true, data: formatCardFull(card) });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// GET /api/superadmin/nfc/cards/:uid/export?format=svg|png|pdf
// Téléchargement — même logique que client admin
// ─────────────────────────────────────────────────────────────

export const downloadSuperCardExport = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const format  = (req.query.format ?? "pdf").toLowerCase();

    if (!["svg", "png", "pdf"].includes(format)) {
      return res.status(422).json({ success: false, error: "format doit être svg | png | pdf" });
    }

    const card = await prisma.nFCCard.findUnique({ where: { uid }, include: { design: true } });
    if (!card)         return res.status(404).json({ success: false, error: "Carte introuvable" });
    if (!card.payload) return res.status(422).json({ success: false, error: "Carte sans payload" });

    // process.cwd() = racine du backend (compatible Windows/XAMPP)
    const EXPORT_DIR = path.join(process.cwd(), "public", "uploads", "cards");
    const filePath   = path.join(EXPORT_DIR, `${uid}.${format}`);

    if (!fs.existsSync(filePath)) {
      console.log(`[export] Fichier absent, génération : ${filePath}`);
      try {
        await generateCardExport(card, card.design);
      } catch (genErr) {
        console.error("[export] ❌ generateCardExport a échoué :", genErr);
        return res.status(500).json({
          success: false,
          error:   "Échec de génération",
          detail:  genErr.message,
        });
      }
    }
    console.log(`[export] Vérification fichier : ${filePath}`);

    if (!fs.existsSync(filePath)) {
      return res.status(500).json({ success: false, error: "Échec de génération" });
    }

    const mimeTypes   = { svg: "image/svg+xml", png: "image/png", pdf: "application/pdf" };
    const safeName    = (card.locationName ?? "card").replace(/[^a-z0-9]/gi, "-").toLowerCase();
    const filename    = `${safeName}-${uid.slice(0, 8)}.${format}`;

    res.setHeader("Content-Type",        mimeTypes[format]);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control",       "private, max-age=3600");

    fs.createReadStream(filePath).pipe(res);
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/superadmin/nfc/cards/:uid/status
// Body : { status: "PRINTED" | "SHIPPED" | "ACTIVE" }
//
// Progression production :
//   NOT_PROGRAMMED → PRINTED   (puce programmée, carte imprimée)
//   PRINTED        → SHIPPED   (envoyée au client)
//   SHIPPED        → ACTIVE    (livrée → active = true, activatedAt = now)
//
// "ACTIVE" = seul moment où la carte est activée
// ─────────────────────────────────────────────────────────────

export const updateCardStatus = async (req, res, next) => {
  try {
    const { uid }    = req.params;
    const { status } = req.body;

    if (!status) return res.status(422).json({ success: false, error: "status requis" });

    const card = await prisma.nFCCard.findUnique({ where: { uid } });
    if (!card) return res.status(404).json({ success: false, error: "Carte introuvable" });

    // Normaliser le statut reçu (minuscules → majuscules DB)
    // ex: "delivered" → "ACTIVE", "printed" → "PRINTED"
    const normalizedStatus = STATUS_NORMALIZE[status?.toLowerCase()] ?? status?.toUpperCase();

    // Vérifier la transition valide
    const allowed = VALID_STATUS_TRANSITIONS[card.status] ?? [];
    if (!allowed.includes(normalizedStatus)) {
      return res.status(422).json({
        success: false,
        error:   `Transition invalide : ${card.status} → ${normalizedStatus}`,
        allowed,
      });
    }

    // Données à mettre à jour
    const updateData = { status: normalizedStatus };

    if (normalizedStatus === "ACTIVE") {
      // Livraison → activer la carte
      updateData.active      = true;
      updateData.activatedAt = new Date();
    }
    if (normalizedStatus === "DISABLED") {
      updateData.active = false;
    }

    if (normalizedStatus === "PRINTED" && card.tagId) {
      // Marquer la puce hardware comme PROGRAMMED
      await prisma.nFCTag.update({
        where: { id: card.tagId },
        data:  { status: "PROGRAMMED" },
      }).catch(() => {});
    }

    const updated = await prisma.nFCCard.update({
      where:   { uid },
      data:    updateData,
      include: CARD_INCLUDE,
    });

    res.json({ success: true, message: `Carte → ${normalizedStatus}`, data: formatCardFull(updated) });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// POST /api/superadmin/nfc/cards/:uid/activate
// Activation manuelle (override — sans passer par SHIPPED)
// Utile pour les tests ou corrections
// ─────────────────────────────────────────────────────────────

export const activateCard = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const card    = await prisma.nFCCard.findUnique({ where: { uid } });
    if (!card) return res.status(404).json({ success: false, error: "Carte introuvable" });

    await prisma.nFCCard.update({
      where: { uid },
      data:  { status: "ACTIVE", active: true, activatedAt: new Date() },
    });

    res.json({ success: true, message: "Carte activée manuellement" });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// POST /api/superadmin/nfc/cards/:uid/regenerate
// Regénérer SVG + PNG + PDF
// ─────────────────────────────────────────────────────────────

export const regenerateSuperCardExport = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const card    = await prisma.nFCCard.findUnique({ where: { uid }, include: { design: true } });
    if (!card)         return res.status(404).json({ success: false, error: "Carte introuvable" });
    if (!card.payload) return res.status(422).json({ success: false, error: "Carte sans payload" });

    await deleteCardExportFiles(uid);
    const exports = await generateCardExport(card, card.design);

    if (exports.svgUrl !== card.qrCodeUrl) {
      await prisma.nFCCard.update({ where: { uid }, data: { qrCodeUrl: exports.svgUrl } });
    }

    res.json({ success: true, message: "Exports regénérés", data: exports });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/superadmin/nfc/cards/:uid
// Supprimer une carte (et ses fichiers d'export)
// ─────────────────────────────────────────────────────────────

export const deleteSuperCard = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const card    = await prisma.nFCCard.findUnique({ where: { uid } });
    if (!card) return res.status(404).json({ success: false, error: "Carte introuvable" });

    // Supprimer les fichiers d'export en premier
    await deleteCardExportFiles(uid);

    await prisma.nFCCard.delete({ where: { uid } });
    res.json({ success: true, message: "Carte supprimée" });
  } catch (e) { next(e); }
};


// ─────────────────────────────────────────────────────────────
// GET /api/superadmin/nfc/cards/:uid/qr?format=svg|png|pdf
// Téléchargement du QR Code seul (sans le design de la carte PVC)
// Utile pour les affichages digitaux, menus, réseaux sociaux
// ─────────────────────────────────────────────────────────────

export const downloadQrOnly = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const format  = (req.query.format ?? "svg").toLowerCase();

    if (!["svg", "png", "pdf"].includes(format)) {
      return res.status(422).json({ success: false, error: "format doit être svg | png | pdf" });
    }

    const card = await prisma.nFCCard.findUnique({ where: { uid } });
    if (!card) return res.status(404).json({ success: false, error: "Carte introuvable" });

    // Les QR Codes seuls sont dans /uploads/qrcodes/ (générés par qrcode.service.js)
    // Les fiches d'impression (recto+verso) sont dans /uploads/cards/
    const QR_DIR  = path.resolve("public/uploads/qrcodes");
    const filePath = path.join(QR_DIR, `${uid}.${format}`);

    // Si le fichier QR n'existe pas, essayer de le regénérer depuis qrcode.service.js
    if (!fs.existsSync(filePath)) {
      if (!card.payload) {
        return res.status(422).json({ success: false, error: "Carte sans payload — impossible de générer le QR" });
      }
      try {
        const { generateAllQrCodes } = await import("../services/qrcode.service.js");
        await generateAllQrCodes(uid, card.payload);
      } catch (genErr) {
        // Si le QR complet (recto+verso) existe, servir depuis là
        const cardFilePath = path.join(path.resolve("public/uploads/cards"), `${uid}.${format}`);
        if (fs.existsSync(cardFilePath)) {
          const mimeTypes = { svg: "image/svg+xml", png: "image/png", pdf: "application/pdf" };
          res.setHeader("Content-Type", mimeTypes[format]);
          res.setHeader("Content-Disposition", `attachment; filename="qr-${uid.slice(0, 8)}.${format}"`);
          return fs.createReadStream(cardFilePath).pipe(res);
        }
        return res.status(500).json({ success: false, error: "Fichier QR introuvable" });
      }
    }

    if (!fs.existsSync(filePath)) {
      return res.status(500).json({ success: false, error: "Échec de génération du QR Code" });
    }

    const mimeTypes = { svg: "image/svg+xml", png: "image/png", pdf: "application/pdf" };
    res.setHeader("Content-Type",        mimeTypes[format]);
    res.setHeader("Content-Disposition", `attachment; filename="qr-${uid.slice(0, 8)}.${format}"`);
    res.setHeader("Cache-Control",       "private, max-age=3600");

    fs.createReadStream(filePath).pipe(res);
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/superadmin/nfc/cards/:uid/regenerate-qr
// Regénérer uniquement le QR Code (SVG + PNG + PDF) sans toucher le design
// Ne modifie pas le payload encodé dans la puce physique
// ─────────────────────────────────────────────────────────────

export const regenerateQrOnly = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const card    = await prisma.nFCCard.findUnique({ where: { uid } });
    if (!card)         return res.status(404).json({ success: false, error: "Carte introuvable" });
    if (!card.payload) return res.status(422).json({ success: false, error: "Carte sans payload" });

    const { generateAllQrCodes } = await import("../services/qrcode.service.js");
    const { svgUrl } = await generateAllQrCodes(uid, card.payload);

    if (!svgUrl) {
      return res.status(500).json({ success: false, error: "Échec de génération du QR Code" });
    }

    // Mettre à jour l'URL en DB si elle a changé
    if (svgUrl !== card.qrCodeUrl) {
      await prisma.nFCCard.update({ where: { uid }, data: { qrCodeUrl: svgUrl } });
    }

    res.json({
      success: true,
      message: `QR Code regénéré pour uid=${uid}`,
      qrCodeUrl: svgUrl,
    });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// ── PUCES HARDWARE (NFCTag) ───────────────────────────────────
// ─────────────────────────────────────────────────────────────

// GET /api/superadmin/nfc/tags
// Liste toutes les puces (avec filtres)

export const listTags = async (req, res, next) => {
  try {
    const { status, assigned, search, page = "1", limit = "20" } = req.query;

    const where = {};
    if (status) where.status = status;
    if (assigned === "true")  where.card = { isNot: null };
    if (assigned === "false") where.card = null;
    if (search)  where.tagSerial = { contains: search };

    const pageNum = Math.max(1, parseInt(page));
    const take    = Math.min(100, parseInt(limit));
    const skip    = (pageNum - 1) * take;

    const [tags, total] = await Promise.all([
      prisma.nFCTag.findMany({
        where, include: { card: { select: { uid: true, locationName: true, companyId: true } } },
        orderBy: { id: "desc" }, skip, take,
      }),
      prisma.nFCTag.count({ where }),
    ]);

    res.json({
      success: true,
      data:    tags.map(formatNfcTag),
      meta:    { total, page: pageNum, limit: take, pages: Math.ceil(total / take) },
    });
  } catch (e) { next(e); }
};

// POST /api/superadmin/nfc/tags
// Créer une ou plusieurs puces (batch)
// Body : { tags: [{ tagSerial, chipType }] } ou { tagSerial, chipType }

export const createTags = async (req, res, next) => {
  try {
    const { tags, tagSerial, chipType } = req.body;

    // Support création batch ou unitaire
    const items = tags ?? [{ tagSerial, chipType }];
    if (!items.length) {
      return res.status(422).json({ success: false, error: "Au moins une puce requise" });
    }

    const created = await prisma.nFCTag.createMany({
      data:           items.map((t) => ({ tagSerial: t.tagSerial ?? null, chipType: t.chipType ?? null, status: "NEW" })),
      skipDuplicates: true,
    });

    res.status(201).json({ success: true, count: created.count, message: `${created.count} puce(s) créée(s)` });
  } catch (e) { next(e); }
};

// PATCH /api/superadmin/nfc/tags/:id/assign
// Assigner une puce à une carte
// Body : { cardUid }

export const assignTag = async (req, res, next) => {
  try {
    const tagId   = parseInt(req.params.id);
    const { cardUid } = req.body;

    if (!cardUid) return res.status(422).json({ success: false, error: "cardUid requis" });

    await assignTagToCard(cardUid, tagId);
    res.json({ success: true, message: `Puce #${tagId} assignée à la carte uid=${cardUid}` });
  } catch (e) {
    if (e.message?.includes("déjà")) return res.status(409).json({ success: false, error: e.message });
    if (e.message?.includes("introuvable")) return res.status(404).json({ success: false, error: e.message });
    next(e);
  }
};