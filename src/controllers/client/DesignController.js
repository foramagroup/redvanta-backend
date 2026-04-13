// src/controllers/design.controller.js — version complète

import prisma from "../../config/database.js";


import path   from "path";
import fs     from "fs";
import crypto from "crypto";
import sharp  from "sharp";
import { getPlaceDetails, findPlaceIdFromUrl } from "../../services/Googleplaces.service.js";

const LOGOS_DIR    = path.resolve(process.env.UPLOAD_DIR || "uploads", "designs", "logos");
const MAX_VERSIONS = 10;
fs.mkdirSync(LOGOS_DIR, { recursive: true });

// ─── Helpers ──────────────────────────────────────────────────


const LINK_INPUT_PLATFORMS = new Set([
  "facebook", "instagram", "tiktok",
  "tripadvisor", "booking", "airbnb", "custom"
]);

function getCompanyId(req) {
  const id = req.user.companyId;
  if (!id) throw Object.assign(new Error("Aucune company active"), { status: 403 });
  return parseInt(id);
}

// Format complet — tous les champs du front
function formatDesign(d) {
  return {
    id: d.id, productId: d.productId, companyId: d.companyId,
    status: d.status, version: d.version,
    lastAutoSave: d.lastAutoSave, validatedAt: d.validatedAt,

    // ── Plateforme ─────────────────────────────────────────
    platform:    d.platform,
    platformUrl: d.platformUrl,

    // Step 1
    businessName:    d.businessName,
    slogan:          d.slogan,
    callToAction:    d.callToAction,
    ctaPaddingTop:   d.ctaPaddingTop,
    googlePlaceId:   d.googlePlaceId,
    googleReviewUrl: d.googleReviewUrl,

    // ... tous les autres champs existants sans modification ...
    orientation:  d.orientation,
    logoUrl:      d.logoUrl,
    logoPosition: d.logoPosition,
    logoSize:     d.logoSize,
    colorMode:   d.colorMode,
    bgColor:     d.bgColor,
    textColor:   d.textColor,
    accentColor: d.accentColor,
    starColor:   d.starColor,
    iconsColor:  d.iconsColor,
    templateName:    d.templateName,
    gradient1:       d.gradient1,
    gradient2:       d.gradient2,
    accentBand1:     d.accentBand1,
    accentBand2:     d.accentBand2,
    bandPosition:    d.bandPosition,
    frontBandHeight: d.frontBandHeight,
    backBandHeight:  d.backBandHeight,
    showNfcIcon:    d.showNfcIcon,
    showGoogleIcon: d.showGoogleIcon,
    nfcIconSize:    d.nfcIconSize,
    googleLogoSize: d.googleLogoSize,
    businessFont:          d.businessFont,
    businessFontSize:      d.businessFontSize,
    businessFontWeight:    d.businessFontWeight,
    businessFontSpacing:   d.businessFontSpacing,
    businessLineHeight:    d.businessLineHeight,
    businessAlign:         d.businessAlign,
    businessTextTransform: d.businessTextTransform,
    sloganFont:          d.sloganFont,
    sloganFontSize:      d.sloganFontSize,
    sloganFontWeight:    d.sloganFontWeight,
    sloganFontSpacing:   d.sloganFontSpacing,
    sloganLineHeight:    d.sloganLineHeight,
    sloganAlign:         d.sloganAlign,
    sloganTextTransform: d.sloganTextTransform,
    textShadow: d.textShadow,
    frontInstruction1:  d.frontInstruction1,
    frontInstruction2:  d.frontInstruction2,
    backInstruction1:   d.backInstruction1,
    backInstruction2:   d.backInstruction2,
    instrFont:          d.instrFont,
    instrFontSize:      d.instrFontSize,
    instrFontWeight:    d.instrFontWeight,
    instrFontSpacing:   d.instrFontSpacing,
    instrLineHeight:    d.instrLineHeight,
    instrAlign:         d.instrAlign,
    instrCheckboxStyle: d.instrCheckboxStyle,
    checkStrokeWidth:   d.checkStrokeWidth ? Number(d.checkStrokeWidth) : 3.5,
    qrCodeStyle: d.qrCodeStyle,
    qrCodeSize:  d.qrCodeSize,
    cardModel: d.cardModel,
    elementOffsets: d.elementOffsets ?? null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}


// ─── Snapshot pour DesignVersion ─────────────────────────────
// Stocke tous les champs visuels importants pour la comparaison
function buildSnapshot(d) {
  return {
    platform:    d.platform,
    platformUrl: d.platformUrl,
    businessName: d.businessName, slogan: d.slogan,
    callToAction: d.callToAction, ctaPaddingTop: d.ctaPaddingTop,
    googlePlaceId: d.googlePlaceId, googleReviewUrl: d.googleReviewUrl,
    orientation:  d.orientation,
    logoUrl:      d.logoUrl, logoPosition: d.logoPosition, logoSize: d.logoSize,
    colorMode:    d.colorMode, bgColor: d.bgColor, textColor: d.textColor,
    accentColor:  d.accentColor, starColor: d.starColor, iconsColor: d.iconsColor,
    templateName: d.templateName,
    gradient1: d.gradient1, gradient2: d.gradient2,
    accentBand1: d.accentBand1, accentBand2: d.accentBand2,
    bandPosition: d.bandPosition,
    frontBandHeight: d.frontBandHeight, backBandHeight: d.backBandHeight,
    showNfcIcon: d.showNfcIcon, showGoogleIcon: d.showGoogleIcon,
    nfcIconSize: d.nfcIconSize, googleLogoSize: d.googleLogoSize,
    businessFont: d.businessFont, businessFontSize: d.businessFontSize,
    businessFontWeight: d.businessFontWeight, businessFontSpacing: d.businessFontSpacing,
    businessLineHeight: d.businessLineHeight, businessAlign: d.businessAlign,
    businessTextTransform: d.businessTextTransform,
    sloganFont: d.sloganFont, sloganFontSize: d.sloganFontSize,
    sloganFontWeight: d.sloganFontWeight, sloganFontSpacing: d.sloganFontSpacing,
    sloganLineHeight: d.sloganLineHeight, sloganAlign: d.sloganAlign,
    sloganTextTransform: d.sloganTextTransform,
    textShadow: d.textShadow,
    frontInstruction1: d.frontInstruction1, frontInstruction2: d.frontInstruction2,
    backInstruction1: d.backInstruction1, backInstruction2: d.backInstruction2,
    instrFont: d.instrFont, instrFontSize: d.instrFontSize,
    instrFontWeight: d.instrFontWeight, instrFontSpacing: d.instrFontSpacing,
    instrLineHeight: d.instrLineHeight, instrAlign: d.instrAlign,
    instrCheckboxStyle: d.instrCheckboxStyle,
    checkStrokeWidth: d.checkStrokeWidth ? Number(d.checkStrokeWidth) : 3.5,
    qrCodeStyle: d.qrCodeStyle, qrCodeSize: d.qrCodeSize,
    cardModel: d.cardModel,
    elementOffsets: d.elementOffsets,
  };
}

// ─── GET /api/designs/cart-item/:cartItemId ───────────────────
export const getDesignByCartItem = async (req, res, next) => {
  try {
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);
    const cartItem  = await prisma.cartItem.findFirst({
      where:   { id: parseInt(req.params.cartItemId), userId, companyId },
      include: { design: true },
    });
    if (!cartItem) return res.status(404).json({ success: false, error: "Item introuvable" });
    res.json({ success: true, data: cartItem.design ? formatDesign(cartItem.design) : null });
  } catch (e) { next(e); }
};

// ─── POST /api/designs ────────────────────────────────────────
export const createDesign = async (req, res, next) => {
  try {
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);
    const { cartItemId, productId } = req.body;

    if (!cartItemId || !productId) {
      return res.status(422).json({ success: false, error: "cartItemId et productId requis" });
    }

    const cartItem = await prisma.cartItem.findFirst({
      where: { id: parseInt(cartItemId), userId, companyId },
    });
    if (!cartItem) return res.status(404).json({ success: false, error: "Item panier introuvable" });

    if (cartItem.designId) {
      const existing = await prisma.design.findUnique({ where: { id: cartItem.designId } });
      if (existing) return res.json({ success: true, data: formatDesign(existing) });
    }

    const design = await prisma.$transaction(async (tx) => {
      const [company, product] = await Promise.all([
        tx.company.findUnique({
          where:  { id: companyId },
          select: { name: true, primaryColor: true },
        }),
        tx.product.findUnique({
          where:  { id: parseInt(productId) },
          select: { cardSettings: true },
        }),
      ]);

      // Résoudre la plateforme depuis Product.cardSettings
      // cardSettings est un Json : { reviewPlatform: "google"|"facebook"|... }
      const platform = (product?.cardSettings)?.reviewPlatform ?? "google";

      const d = await tx.design.create({
        data: {
          userId,
          companyId,
          productId:   parseInt(productId),
          platform,
          businessName: company?.name         ?? null,
          accentColor:  company?.primaryColor ?? "#E10600",
        },
      });

      await tx.cartItem.update({
        where: { id: parseInt(cartItemId) },
        data:  { designId: d.id },
      });

      return d;
    });

    res.status(201).json({ success: true, data: formatDesign(design) });
  } catch (e) { next(e); }
};

// ─── PUT /api/designs/:id/step1 ───────────────────────────────
export const saveStep1 = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);
    const {
      businessName, slogan, callToAction, ctaPaddingTop,
      googlePlaceId, googleReviewUrl,
      platformUrl,   // ← URL libre pour plateformes non-Google
      manualUrl,
    } = req.body;

    const design = await prisma.design.findFirst({ where: { id, userId, companyId } });
    if (!design) return res.status(404).json({ success: false, error: "Design introuvable" });
    if (design.status === "locked") return res.status(409).json({ success: false, error: "Design verrouillé" });

    const isLinkInput = LINK_INPUT_PLATFORMS.has(design.platform ?? "google");

    let updateData = {
      businessName:  businessName  ?? design.businessName,
      slogan:        slogan        ?? design.slogan,
      callToAction:  callToAction  ?? design.callToAction,
      ctaPaddingTop: ctaPaddingTop ?? design.ctaPaddingTop,
      lastAutoSave:  new Date(),
    };

    if (isLinkInput) {
      // Plateformes non-Google : on stocke juste l'URL dans platformUrl
      updateData.platformUrl = platformUrl ?? googleReviewUrl ?? design.platformUrl;
    } else {
      // Google : résolution Place ID + enrichissement company
      let finalPlaceId = googlePlaceId;
      if (!finalPlaceId && manualUrl) {
        finalPlaceId = await findPlaceIdFromUrl(manualUrl).catch(() => null);
      }

      let place = null;
      if (finalPlaceId) {
        place = await getPlaceDetails(finalPlaceId).catch(() => null);
      }

      if (place) {
        await prisma.company.update({
          where: { id: companyId },
          data: {
            googlePlaceId:   finalPlaceId,
            googleReviewUrl: googleReviewUrl || place.reviewUrl,
            ...(place.phone   && { phone: place.phone }),
            ...(place.website && {
              googleLink: `https://www.google.com/maps/search/?api=1&query=google&query_place_id=${finalPlaceId}`,
            }),
          },
        });
      }

      updateData.googlePlaceId   = finalPlaceId   ?? design.googlePlaceId;
      updateData.googleReviewUrl = googleReviewUrl || place?.reviewUrl || design.googleReviewUrl;
    }

    const updated = await saveWithVersion(id, updateData, design);

    res.json({ success: true, message: "Brouillon étape 1 sauvegardé", data: formatDesign(updated) });
  } catch (e) { next(e); }
};

// ─── PUT /api/designs/:id/step2 ───────────────────────────────
export const saveStep2 = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);
    const body      = req.body;

    const design = await prisma.design.findFirst({ where: { id, userId, companyId } });
    if (!design) return res.status(404).json({ success: false, error: "Design introuvable" });
    if (design.status === "locked") return res.status(409).json({ success: false, error: "Design verrouillé" });

    // Upload logo base64 → WebP
    let logoUrl = body.logoUrl;
    if (body.logo?.startsWith("data:image/")) {
      logoUrl = await saveLogo(body.logo, id);
      if (design.logoUrl && design.logoUrl !== logoUrl) deleteFile(design.logoUrl);
    }

    // Le front envoie "qrColor" → on accepte les deux noms
    const accentColor = body.accentColor ?? body.qrColor ?? design.accentColor;

    const updated = await saveWithVersion(id, {
      // Logo
      orientation:   body.orientation  ?? design.orientation,
      logoUrl:       logoUrl           ?? design.logoUrl,
      logoPosition:  body.logoPosition ?? design.logoPosition,
      logoSize:      body.logoSize     ?? design.logoSize,

      // Couleurs
      colorMode:   body.colorMode  ?? design.colorMode,
      bgColor:     body.bgColor    ?? design.bgColor,
      textColor:   body.textColor  ?? design.textColor,
      accentColor,
      starColor:   body.starColor  ?? design.starColor,
      iconsColor:  body.iconsColor ?? design.iconsColor,

      // Template & Bandes
      templateName:    body.templateName    ?? design.templateName,
      gradient1:       body.gradient1       ?? design.gradient1,
      gradient2:       body.gradient2       ?? design.gradient2,
      accentBand1:     body.accentBand1     ?? design.accentBand1,
      accentBand2:     body.accentBand2     ?? design.accentBand2,
      bandPosition:    body.bandPosition    ?? design.bandPosition,
      frontBandHeight: body.frontBandHeight ?? design.frontBandHeight,
      backBandHeight:  body.backBandHeight  ?? design.backBandHeight,

      // Icônes
      showNfcIcon:    body.showNfcIcon    ?? design.showNfcIcon,
      showGoogleIcon: body.showGoogleIcon ?? design.showGoogleIcon,
      nfcIconSize:    body.nfcIconSize    ?? design.nfcIconSize,
      googleLogoSize: body.googleLogoSize ?? design.googleLogoSize,

      // Typo Nom
      businessFont:          body.businessFont          ?? design.businessFont,
      businessFontSize:      body.businessFontSize      ?? design.businessFontSize,
      businessFontWeight:    body.businessFontWeight    ?? design.businessFontWeight,
      businessFontSpacing:   body.businessFontSpacing   ?? design.businessFontSpacing,
      businessLineHeight:    body.businessLineHeight    ?? design.businessLineHeight,
      businessAlign:         body.businessAlign         ?? design.businessAlign,
      businessTextTransform: body.businessTextTransform ?? design.businessTextTransform,

      // Typo Slogan
      sloganFont:          body.sloganFont          ?? design.sloganFont,
      sloganFontSize:      body.sloganFontSize      ?? design.sloganFontSize,
      sloganFontWeight:    body.sloganFontWeight    ?? design.sloganFontWeight,
      sloganFontSpacing:   body.sloganFontSpacing   ?? design.sloganFontSpacing,
      sloganLineHeight:    body.sloganLineHeight    ?? design.sloganLineHeight,
      sloganAlign:         body.sloganAlign         ?? design.sloganAlign,
      sloganTextTransform: body.sloganTextTransform ?? design.sloganTextTransform,

      // Ombre texte
      textShadow: body.textShadow ?? design.textShadow,

      // Instructions
      frontInstruction1:  body.frontInstruction1  ?? design.frontInstruction1,
      frontInstruction2:  body.frontInstruction2  ?? design.frontInstruction2,
      backInstruction1:   body.backInstruction1   ?? design.backInstruction1,
      backInstruction2:   body.backInstruction2   ?? design.backInstruction2,
      instrFont:          body.instrFont          ?? design.instrFont,
      instrFontSize:      body.instrFontSize      ?? design.instrFontSize,
      instrFontWeight:    body.instrFontWeight    ?? design.instrFontWeight,
      instrFontSpacing:   body.instrFontSpacing   ?? design.instrFontSpacing,
      instrLineHeight:    body.instrLineHeight    ?? design.instrLineHeight,
      instrAlign:         body.instrAlign         ?? design.instrAlign,
      instrCheckboxStyle: body.instrCheckboxStyle ?? design.instrCheckboxStyle,
      checkStrokeWidth:   body.checkStrokeWidth   ?? design.checkStrokeWidth,

      // QR Code
      qrCodeStyle: body.qrCodeStyle ?? design.qrCodeStyle,
      qrCodeSize:  body.qrCodeSize  ?? design.qrCodeSize,

      // Modèle
      cardModel: body.cardModel ?? design.cardModel,

      // Positions drag-and-drop (objet JSON complet)
      elementOffsets: body.elementOffsets ?? design.elementOffsets,

      lastAutoSave: new Date(),
    }, design);

    res.json({ success: true, message: "Brouillon étape 2 sauvegardé", data: formatDesign(updated) });
  } catch (e) { next(e); }
};

// ─── PUT /api/designs/:id/validate ───────────────────────────
export const validateDesign = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);

    const design = await prisma.design.findFirst({ where: { id, userId, companyId } });
    if (!design) return res.status(404).json({ success: false, error: "Design introuvable" });
    if (!design.businessName) {
      return res.status(422).json({ success: false, error: "Le nom du business est requis pour valider" });
    }
    if (design.status === "locked") {
      return res.status(409).json({ success: false, error: "Design verrouillé (commande déjà passée)" });
    }

    const updated = await prisma.design.update({
      where: { id },
      data:  { status: "validated", validatedAt: new Date() },
    });

    res.json({ success: true, message: "Design validé !", data: formatDesign(updated) });
  } catch (e) { next(e); }
};

// ─── GET /api/designs/:id/versions ───────────────────────────
export const getVersions = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);

    const design = await prisma.design.findFirst({ where: { id, userId, companyId } });
    if (!design) return res.status(404).json({ success: false, error: "Design introuvable" });

    const versions = await prisma.designVersion.findMany({
      where:   { designId: id },
      orderBy: { version: "desc" },
    });

    res.json({ success: true, data: versions });
  } catch (e) { next(e); }
};

// ─── POST /api/designs/:id/restore/:versionId ────────────────
export const restoreVersion = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const versionId = parseInt(req.params.versionId);
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);

    const design = await prisma.design.findFirst({ where: { id, userId, companyId } });
    if (!design) return res.status(404).json({ success: false, error: "Design introuvable" });

    const version = await prisma.designVersion.findFirst({
      where: { id: versionId, designId: id },
    });
    if (!version) return res.status(404).json({ success: false, error: "Version introuvable" });

    // Restaurer le snapshot complet
    const updated = await prisma.design.update({
      where: { id },
      data:  { ...version.snapshot, status: "draft", lastAutoSave: new Date() },
    });

    res.json({ success: true, message: "Version restaurée", data: formatDesign(updated) });
  } catch (e) { next(e); }
};

// ─── saveWithVersion ──────────────────────────────────────────
async function saveWithVersion(id, data, current) {
  return prisma.$transaction(async (tx) => {
    // Sauvegarder la version courante avant modification
    await tx.designVersion.create({
      data: {
        designId: id,
        version:  current.version,
        snapshot: buildSnapshot(current),
      },
    });

    // Purger les anciennes versions au-delà de MAX_VERSIONS
    const all = await tx.designVersion.findMany({
      where:   { designId: id },
      orderBy: { version: "desc" },
      select:  { id: true },
    });
    if (all.length > MAX_VERSIONS) {
      await tx.designVersion.deleteMany({
        where: { id: { in: all.slice(MAX_VERSIONS).map((v) => v.id) } },
      });
    }

    return tx.design.update({
      where: { id },
      data:  { ...data, version: current.version + 1 },
    });
  });
}

// ─── saveLogo ─────────────────────────────────────────────────
async function saveLogo(base64, designId) {
  const m = base64.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("Format logo invalide");
  const filename = `${designId}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.webp`;
  const destPath = path.join(LOGOS_DIR, filename);
  await sharp(Buffer.from(m[2], "base64"))
    .resize({ width: 400, height: 400, fit: "inside" })
    .webp({ quality: 85 })
    .toFile(destPath);
  return `/uploads/designs/logos/${filename}`;
}

// ─── deleteFile ───────────────────────────────────────────────
function deleteFile(url) {
  try {
    if (!url?.startsWith("/uploads/")) return;
    const abs = path.resolve(
      process.env.UPLOAD_DIR || "uploads",
      url.replace("/uploads/", "")
    );
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch (e) {
    console.error("[design] deleteFile:", e.message);
  }
}