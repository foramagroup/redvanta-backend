// src/controllers/design.controller.js — version complète

import prisma from "../../config/database.js";


import path   from "path";
import fs     from "fs";
import crypto from "crypto";
import sharp  from "sharp";
import { getPlaceDetails, findPlaceIdFromUrl } from "../../services/Googleplaces.service.js";
import { regenerateCardExportsForDesign } from "../../services/nfc.service.js";

const LOGOS_DIR    = path.resolve(process.env.UPLOAD_DIR || "uploads", "designs", "logos");
const MAX_VERSIONS = 10;
const PAYMENT_LOCK_MESSAGE = "Please pay the invoice first.";
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

async function getBlockingStatusMap(designIds = []) {
  const ids = [...new Set(designIds.map((id) => parseInt(id)).filter(Boolean))];
  const map = new Map();
  if (!ids.length) return map;

  const items = await prisma.orderItem.findMany({
    where: {
      designId: { in: ids },
      OR: [
        { order: { status: { not: "paid" } } },
        { order: { invoice: { is: { status: { not: "paid" } } } } },
      ],
    },
    select: {
      designId: true,
      order: {
        select: {
          status: true,
          invoice: { select: { status: true } },
        },
      },
    },
  });

  for (const item of items) {
    if (!item.designId || map.has(item.designId)) continue;
    map.set(item.designId, item.order?.invoice?.status ?? item.order?.status ?? "unpaid");
  }

  return map;
}

function resolveInvoiceStatus(d) {
  const invoiceStatuses = [
    ...(d.nfcCards ?? []).map((card) => card?.orderItem?.order?.invoice?.status).filter(Boolean),
    ...(d.orderItem ?? []).map((item) => item?.order?.invoice?.status).filter(Boolean),
  ];
  const orderStatuses = [
    ...(d.nfcCards ?? []).map((card) => card?.orderItem?.order?.status).filter(Boolean),
    ...(d.orderItem ?? []).map((item) => item?.order?.status).filter(Boolean),
  ];

  const blockingInvoiceStatus = invoiceStatuses.find((status) => status !== "paid");
  if (blockingInvoiceStatus) return blockingInvoiceStatus;

  const blockingOrderStatus = orderStatuses.find((status) => status !== "paid");
  if (blockingOrderStatus) return blockingOrderStatus;

  return invoiceStatuses[0] ?? orderStatuses[0] ?? null;
}

// Format complet — tous les champs du front
function formatDesign(d) {
  const invoiceStatus = d.__blockingStatus ?? resolveInvoiceStatus(d);
  const paymentLockActive = Boolean(invoiceStatus && invoiceStatus !== "paid");

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
    useLogo:        d.useLogo        ?? true,
    selectedIconId: d.selectedIconId ?? null,
    iconColor:      d.iconColor      ?? null,
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

    // Serial Number Tag
    showSerialNumber:      d.showSerialNumber      ?? false,
    serialNumber:          d.nfcCards?.[0]?.tag?.tagSerial ?? d.serialNumber  ?? null,
    serialNumberTextColor: d.serialNumberTextColor ?? null,
    serialNumberBgColor:   d.serialNumberBgColor   ?? null,
    serialNumberFontSize:  d.serialNumberFontSize  ?? null,
    serialNumberPaddingX:  d.serialNumberPaddingX  ?? null,
    serialNumberPaddingY:  d.serialNumberPaddingY  ?? null,
    serialNumberRadius:    d.serialNumberRadius    ?? null,

    // Platform Icon Background
    platformIconBgEnabled: d.platformIconBgEnabled ?? false,
    platformIconBgColor:   d.platformIconBgColor   ?? "#FFFFFF",
    platformIconBgPadding: d.platformIconBgPadding ?? 4,
    platformIconBgRadius:  d.platformIconBgRadius  ?? 999,
    platformIconBgShadow:  d.platformIconBgShadow  ?? false,

    primaryCardUid: d.nfcCards?.[0]?.uid ?? null,
    primaryCardPayload: paymentLockActive
      ? PAYMENT_LOCK_MESSAGE
      : d.nfcCards?.[0]?.payload ?? null,
    primaryCardQrCodeUrl: paymentLockActive
      ? null
      : d.nfcCards?.[0]?.qrCodeUrl ?? null,
    paymentLockActive,
    paymentLockMessage: paymentLockActive ? PAYMENT_LOCK_MESSAGE : null,
    invoiceStatus,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

async function formatDesignWithPayment(d) {
  const blockingStatus = (await getBlockingStatusMap([d.id])).get(d.id) ?? null;
  return formatDesign({ ...d, __blockingStatus: blockingStatus });
}

const DESIGN_PAYMENT_INCLUDE = {
  nfcCards: {
    select: {
      uid: true,
      payload: true,
      qrCodeUrl: true,
      tag: { select: { tagSerial: true } },
      orderItem: {
        select: {
          order: { select: { status: true, invoice: { select: { status: true } } } },
        },
      },
    },
  },
  orderItem: {
    select: {
      order: { select: { status: true, invoice: { select: { status: true } } } },
    },
  },
};


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

// ─── GET /api/designs/:id ─────────────────────────────────────
export const getDesignById = async (req, res, next) => {
  try {
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);
    const design    = await prisma.design.findFirst({
      where: { id: parseInt(req.params.id), userId, companyId },
      include: DESIGN_PAYMENT_INCLUDE,
    });
    if (!design) return res.status(404).json({ success: false, error: req.t("design.not_found") });
    res.json({ success: true, data: await formatDesignWithPayment(design) });
  } catch (e) { next(e); }
};

// ─── GET /api/designs/cart-item/:cartItemId ───────────────────
export const getDesignByCartItem = async (req, res, next) => {
  try {
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);
    const locationId = req.query?.locationId ? parseInt(req.query.locationId) : null;
    const cartItem  = await prisma.cartItem.findFirst({
      where:   { id: parseInt(req.params.cartItemId), userId, companyId },
      include: {
        design: { include: DESIGN_PAYMENT_INCLUDE },
        locations: {
          include: { design: { include: DESIGN_PAYMENT_INCLUDE } },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (!cartItem) return res.status(404).json({ success: false, error: req.t("cart.item_not_found") });
    const locationDesign = locationId
      ? cartItem.locations?.find((location) => location.id === locationId && location.design)?.design || null
      : cartItem.locations?.find((location) => location.design)?.design || null;
    const design = cartItem.design || locationDesign || null;
    res.json({ success: true, data: design ? await formatDesignWithPayment(design) : null });
  } catch (e) { next(e); }
};

// ─── POST /api/designs ────────────────────────────────────────
export const createDesign = async (req, res, next) => {
  try {
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);
    const { cartItemId, productId, locationId } = req.body;

    if (!cartItemId || !productId) {
      return res.status(422).json({ success: false, error: req.t("design.cart_item_required") });
    }

    const cartItem = await prisma.cartItem.findFirst({
      where: { id: parseInt(cartItemId), userId, companyId },
      include: {
        design: { include: DESIGN_PAYMENT_INCLUDE },
        locations: {
          include: { design: { include: DESIGN_PAYMENT_INCLUDE } },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (!cartItem) return res.status(404).json({ success: false, error: req.t("cart.item_not_found") });

    if (cartItem.designId) {
      const existing = await prisma.design.findUnique({
        where: { id: cartItem.designId },
        include: DESIGN_PAYMENT_INCLUDE,
      });
      if (existing) return res.json({ success: true, data: await formatDesignWithPayment(existing) });
    }

    const existingLocationDesign = locationId
      ? cartItem.locations?.find((location) => location.id === parseInt(locationId) && location.design)?.design || null
      : cartItem.locations?.find((location) => location.design)?.design || null;
    if (existingLocationDesign) {
      return res.json({ success: true, data: await formatDesignWithPayment(existingLocationDesign) });
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

    const hydrated = await prisma.design.findUnique({
      where: { id: design.id },
      include: DESIGN_PAYMENT_INCLUDE,
    });
    res.status(201).json({ success: true, data: await formatDesignWithPayment(hydrated ?? design) });
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

    const design = await prisma.design.findFirst({
      where: { id, userId, companyId },
      include: DESIGN_PAYMENT_INCLUDE,
    });
    if (!design) return res.status(404).json({ success: false, error: req.t("design.not_found") });
    if (design.status === "locked") return res.status(409).json({ success: false, error: req.t("design.locked") });

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

    const result = await regenerateCardExportsForDesign(design.id);

    res.json({ success: true, message: req.t("design.step1_saved"), data: await formatDesignWithPayment(updated) });
  } catch (e) { next(e); }
};

// ─── PUT /api/designs/:id/step2 ───────────────────────────────
export const saveStep2 = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);
    const body      = req.body;

    const design = await prisma.design.findFirst({
      where: { id, userId, companyId },
      include: DESIGN_PAYMENT_INCLUDE,
    });
    if (!design) return res.status(404).json({ success: false, error: req.t("design.not_found") });
    if (design.status === "locked") return res.status(409).json({ success: false, error: req.t("design.locked") });

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
      useLogo:        body.useLogo        ?? design.useLogo,
      selectedIconId: body.selectedIconId ?? design.selectedIconId,
      iconColor:      body.iconColor      ?? design.iconColor,

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

      // Serial Number Tag
      showSerialNumber:      body.showSerialNumber      ?? design.showSerialNumber,
      serialNumber:          body.serialNumber          ?? design.serialNumber,
      serialNumberTextColor: body.serialNumberTextColor ?? design.serialNumberTextColor,
      serialNumberBgColor:   body.serialNumberBgColor   ?? design.serialNumberBgColor,
      serialNumberFontSize:  body.serialNumberFontSize  ?? design.serialNumberFontSize,
      serialNumberPaddingX:  body.serialNumberPaddingX  ?? design.serialNumberPaddingX,
      serialNumberPaddingY:  body.serialNumberPaddingY  ?? design.serialNumberPaddingY,
      serialNumberRadius:    body.serialNumberRadius    ?? design.serialNumberRadius,

      // Platform Icon Background
      platformIconBgEnabled: body.platformIconBgEnabled ?? design.platformIconBgEnabled,
      platformIconBgColor:   body.platformIconBgColor   ?? design.platformIconBgColor,
      platformIconBgPadding: body.platformIconBgPadding ?? design.platformIconBgPadding,
      platformIconBgRadius:  body.platformIconBgRadius  ?? design.platformIconBgRadius,
      platformIconBgShadow:  body.platformIconBgShadow  ?? design.platformIconBgShadow,

      lastAutoSave: new Date(),
    }, design);

    const result = await regenerateCardExportsForDesign(design.id);

    res.json({ success: true, message: req.t("design.step2_saved"), data: await formatDesignWithPayment(updated) });
  } catch (e) { next(e); }
};

// ─── PUT /api/designs/:id/validate ───────────────────────────
export const validateDesign = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);

    const design = await prisma.design.findFirst({
      where: { id, userId, companyId },
      include: DESIGN_PAYMENT_INCLUDE,
    });
    if (!design) return res.status(404).json({ success: false, error: req.t("design.not_found") });
    if (!design.businessName) {
      return res.status(422).json({ success: false, error: req.t("design.business_name_required") });
    }
    if (design.status === "locked") {
      return res.status(409).json({ success: false, error: req.t("design.locked_order") });
    }

    const updated = await prisma.design.update({
      where: { id },
      data:  { status: "validated", validatedAt: new Date() },
      include: DESIGN_PAYMENT_INCLUDE,
    });

     const result = await regenerateCardExportsForDesign(id);

    res.json({ success: true, message: req.t("design.validated"), data: await formatDesignWithPayment(updated) });
  } catch (e) { next(e); }
};

// ─── GET /api/designs/:id/versions ───────────────────────────
export const getVersions = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);

    const design = await prisma.design.findFirst({
      where: { id, userId, companyId },
      include: DESIGN_PAYMENT_INCLUDE,
    });
    if (!design) return res.status(404).json({ success: false, error: req.t("design.not_found") });

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

    const design = await prisma.design.findFirst({
      where: { id, userId, companyId },
      include: DESIGN_PAYMENT_INCLUDE,
    });
    if (!design) return res.status(404).json({ success: false, error: req.t("design.not_found") });

    const version = await prisma.designVersion.findFirst({
      where: { id: versionId, designId: id },
    });
    if (!version) return res.status(404).json({ success: false, error: req.t("design.version_not_found") });

    // Restaurer le snapshot complet
    const updated = await prisma.design.update({
      where: { id },
      data:  { ...version.snapshot, status: "draft", lastAutoSave: new Date() },
      include: DESIGN_PAYMENT_INCLUDE,
    });

    res.json({ success: true, message: req.t("design.version_restored"), data: await formatDesignWithPayment(updated) });
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
      include: DESIGN_PAYMENT_INCLUDE,
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

