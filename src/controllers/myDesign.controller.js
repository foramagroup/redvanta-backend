// src/controllers/designs.client.controller.js
// ─────────────────────────────────────────────────────────────
// Endpoints CLIENT — vue MyDesigns (Next.js)
//
// Routes à monter sous /api/designs/my
//   GET    /                    → liste paginée + filtres
//   GET    /stats               → compteurs (total, active, draft, archived)
//   GET    /:id                 → détail complet
//   POST   /:id/duplicate       → dupliquer → nouveau design "draft"
//   PATCH  /:id/rename          → renommer (body: { name })
//   PATCH  /:id/archive         → status → "archived"
//   PATCH  /:id/restore         → status → "draft"
//   DELETE /:id                 → suppression permanente (uniquement si draft/archived)
//
// Note : create/edit restent dans design.controller.js (step1/step2/validate)
// ─────────────────────────────────────────────────────────────

import prisma from "../config/database.js";

const PAYMENT_LOCK_MESSAGE = "Please pay the invoice first.";

// ─── Helper ──────────────────────────────────────────────────

function getCompanyId(req) {
  const id = req.user?.companyId;
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

// Format design pour la vue MyDesigns
// Mappe les champs DB vers ce que le front attend dans DesignCard / DesignRow
function formatDesign(d) {
  const invoiceStatus = d.__blockingStatus ?? resolveInvoiceStatus(d);
  const paymentLockActive = Boolean(invoiceStatus && invoiceStatus !== "paid");

  return {
    // ── Identifiants ──────────────────────────────────────
    id:        d.id,
    productId: d.productId,

    // ── Nom & statut ──────────────────────────────────────
    name:         d.businessName ?? `Design #${d.id}`,
    businessName: d.businessName ?? "",
    status:       mapStatus(d.status),

    // ── Couleurs template (pour DesignCard thumbnail) ─────
    templateColor1: d.gradient1   ?? d.bgColor    ?? "#0D0D0D",
    templateColor2: d.gradient2   ?? d.accentColor ?? "#E10600",

    // ── Infos résumé ──────────────────────────────────────
    template:    d.templateName ?? d.colorMode ?? "Single",
    model:       d.cardModel    ?? "classic",
    orientation: d.orientation  ?? "landscape",
    platform:    d.platform     ?? "google",

    // ── Carte NFC liée ────────────────────────────────────
    linkedCard: d.nfcCards?.length > 0
      ? d.nfcCards[0].uid.slice(0, 8).toUpperCase()
      : null,
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

    // ── Dates ─────────────────────────────────────────────
    createdAt: d.createdAt?.toISOString().split("T")[0] ?? null,
    updatedAt: d.updatedAt?.toISOString().split("T")[0] ?? null,

    // ══════════════════════════════════════════════════════
    // TOUS les champs visuels pour CardPreview
    // ══════════════════════════════════════════════════════

    // Step 1
    slogan:          d.slogan          ?? "",
    callToAction:    d.callToAction    ?? `${'Powered by'+process.env.MAIL_FROM_NAME}`,
    ctaPaddingTop:   d.ctaPaddingTop   ?? 8,
    googlePlaceId:   d.googlePlaceId   ?? null,
    googleReviewUrl: d.googleReviewUrl ?? null,
    platformUrl:     d.platformUrl     ?? null,

    // Logo
    logoUrl:      d.logoUrl      ?? null,
    logoPosition: d.logoPosition ?? "left",
    logoSize:     d.logoSize     ?? 32,

    // Couleurs
    colorMode:   d.colorMode   ?? "template",
    bgColor:     d.bgColor     ?? "#0D0D0D",
    textColor:   d.textColor   ?? "#FFFFFF",
    accentColor: d.accentColor ?? "#E10600",   // = qrColor
    starColor:   d.starColor   ?? "#FBBF24",
    iconsColor:  d.iconsColor  ?? "#22C55E",

    // Template & Bandes
    templateName:    d.templateName    ?? null,
    gradient1:       d.gradient1       ?? "#0D0D0D",
    gradient2:       d.gradient2       ?? "#1A1A1A",
    accentBand1:     d.accentBand1     ?? "#E10600",
    accentBand2:     d.accentBand2     ?? "#FF4444",
    bandPosition:    d.bandPosition    ?? "bottom",
    frontBandHeight: d.frontBandHeight ?? 22,
    backBandHeight:  d.backBandHeight  ?? 12,

    // Icônes
    showNfcIcon:    d.showNfcIcon    ?? true,
    showGoogleIcon: d.showGoogleIcon ?? true,
    nfcIconSize:    d.nfcIconSize    ?? 24,
    googleLogoSize: d.googleLogoSize ?? 20,

    // Typo Nom
    businessFont:          d.businessFont          ?? "'Space Grotesk', sans-serif",
    businessFontSize:      d.businessFontSize      ?? 16,
    businessFontWeight:    d.businessFontWeight    ?? "700",
    businessFontSpacing:   d.businessFontSpacing   ?? "normal",
    businessLineHeight:    d.businessLineHeight    ?? "1.2",
    businessAlign:         d.businessAlign         ?? "left",
    businessTextTransform: d.businessTextTransform ?? "none",

    // Typo Slogan
    sloganFont:          d.sloganFont          ?? "'Space Grotesk', sans-serif",
    sloganFontSize:      d.sloganFontSize      ?? 12,
    sloganFontWeight:    d.sloganFontWeight    ?? "400",
    sloganFontSpacing:   d.sloganFontSpacing   ?? "normal",
    sloganLineHeight:    d.sloganLineHeight    ?? "1.4",
    sloganAlign:         d.sloganAlign         ?? "left",
    sloganTextTransform: d.sloganTextTransform ?? "none",

    // Ombre
    textShadow: d.textShadow ?? "none",

    // Instructions
    frontInstruction1: d.frontInstruction1 ?? "",
    frontInstruction2: d.frontInstruction2 ?? "",
    backInstruction1:  d.backInstruction1  ?? "",
    backInstruction2:  d.backInstruction2  ?? "",

    // Typo Instructions
    instrFont:          d.instrFont          ?? "'Space Grotesk', sans-serif",
    instrFontSize:      d.instrFontSize      ?? 10,
    instrFontWeight:    d.instrFontWeight    ?? "400",
    instrFontSpacing:   d.instrFontSpacing   ?? "normal",
    instrLineHeight:    d.instrLineHeight    ?? "1.4",
    instrAlign:         d.instrAlign         ?? "left",
    instrCheckboxStyle: d.instrCheckboxStyle ?? "checkmark",
    checkStrokeWidth:   d.checkStrokeWidth   ? Number(d.checkStrokeWidth) : 3.5,

    // QR Code
    qrCodeStyle: d.qrCodeStyle ?? "top",
    qrCodeSize:  d.qrCodeSize  ?? 80,

    // Drag-and-drop
    elementOffsets: d.elementOffsets ?? null,

    // Versioning
    version:      d.version      ?? 1,
    validatedAt:  d.validatedAt  ?? null,
    lastAutoSave: d.lastAutoSave ?? null,
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

// DesignStatus DB → statut front
// La vue utilise "active" | "draft" | "archived"
// On n'a pas de champ "archived" en DB — on le stocke en status="archived" (valeur custom)
// ou on utilise un champ séparé. Pour rester compatible avec le schéma existant :
//   draft     → "draft"
//   validated → "active"
//   locked    → "active"
//   archived  → "archived"  (valeur custom qu'on peut ajouter dans l'enum si besoin)
function mapStatus(dbStatus) {
  if (!dbStatus) return "draft";
  if (dbStatus === "validated" || dbStatus === "locked") return "active";
  if (dbStatus === "archived") return "archived";
  return "draft";
}

// Statut DB inverse (front → DB)
function mapStatusToDb(frontStatus) {
  if (frontStatus === "active")   return "validated";
  if (frontStatus === "archived") return "archived";
  return "draft";
}

// ─────────────────────────────────────────────────────────────
// GET /api/designs/my/stats
// Compteurs pour les 4 badges en haut de la vue
// ─────────────────────────────────────────────────────────────
export const getMyDesignStats = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const userId    = req.user.userId;

    const [total, byStatus] = await Promise.all([
      prisma.design.count({ where: { companyId, userId } }),
      prisma.design.groupBy({
        by:    ["status"],
        where: { companyId, userId },
        _count: { id: true },
      }),
    ]);

    const sm = {};
    byStatus.forEach((s) => { sm[s.status] = s._count.id; });

    res.json({
      success: true,
      data: {
        total,
        active:   (sm["validated"] ?? 0) + (sm["locked"] ?? 0),
        draft:    sm["draft"]     ?? 0,
        archived: sm["archived"]  ?? 0,
      },
    });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// GET /api/designs/my
// Liste paginée avec filtres
// Query : ?status=all|active|draft|archived&search=&page=1&limit=20
// ─────────────────────────────────────────────────────────────
export const listMyDesigns = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const userId    = req.user.userId;
    const { status = "all", search, page = "1", limit = "20" } = req.query;
    const where = { companyId, userId };
    // Filtre statut
    if (status !== "all") {
      if (status === "active") {
        where.status = { in: ["validated", "locked"] };
      } else {
        // "draft" ou "archived"
        where.status = mapStatusToDb(status);
      }
    }
    // Recherche sur businessName
    if (search?.trim()) {
      where.businessName = { contains: search.trim() };
    }

    const pageNum = Math.max(1, parseInt(page));
    const take    = Math.min(100, parseInt(limit));
    const skip    = (pageNum - 1) * take;

    const [designs, total] = await Promise.all([
      prisma.design.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take,
        include: DESIGN_PAYMENT_INCLUDE,
      }),
      prisma.design.count({ where }),
    ]);

    const blockingStatusMap = await getBlockingStatusMap(designs.map((d) => d.id));
    res.json({
      success: true,
      data:    designs.map((d) => formatDesign({ ...d, __blockingStatus: blockingStatusMap.get(d.id) ?? null })),
      meta:    { total, page: pageNum, limit: take, pages: Math.ceil(total / take) },
    });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// GET /api/designs/my/:id
// Détail complet d'un design
// ─────────────────────────────────────────────────────────────
export const getMyDesign = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const userId    = req.user.userId;
    const id        = parseInt(req.params.id);

    const design = await prisma.design.findFirst({
      where:   { id, companyId, userId },
      include: DESIGN_PAYMENT_INCLUDE,
    });
    if (!design) return res.status(404).json({ success: false, error: req.t("design.not_found") });

    res.json({ success: true, data: await formatDesignWithPayment(design) });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// POST /api/designs/my/:id/duplicate
// Duplique un design → nouveau design "draft"
// La vue appelle handleDuplicate() qui crée une copie locale
// Cet endpoint persiste la copie en DB
// ─────────────────────────────────────────────────────────────
export const duplicateMyDesign = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const userId    = req.user.userId;
    const id        = parseInt(req.params.id);

    const source = await prisma.design.findFirst({
      where: { id, companyId, userId },
    });
    if (!source) return res.status(404).json({ success: false, error: req.t("design.not_found") });

    // Copier tous les champs sauf les métadonnées système
    const {
      id: _id, createdAt: _c, updatedAt: _u, validatedAt: _v,
      lastAutoSave: _l, version: _ver, status: _s,
      nfcCards: _n,
      ...fields
    } = source;

    const copy = await prisma.design.create({
      data: {
        ...fields,
        businessName: `${source.businessName ?? "Design"} (Copy)`,
        status:       "draft",
        version:      1,
        validatedAt:  null,
        lastAutoSave: null,
      },
      include: DESIGN_PAYMENT_INCLUDE,
    });

    res.status(201).json({
      success: true,
      message: req.t("admin.design.duplicated"),
      data:    await formatDesignWithPayment(copy),
    });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/designs/my/:id/rename
// Body : { name: string }
// "name" = businessName dans notre schéma (pas de champ name séparé)
// ─────────────────────────────────────────────────────────────
export const renameMyDesign = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const userId    = req.user.userId;
    const id        = parseInt(req.params.id);
    const { name }  = req.body;

    if (!name?.trim()) {
      return res.status(422).json({ success: false, error: req.t("admin.design.name_required") });
    }

    const design = await prisma.design.findFirst({
      where: { id, companyId, userId },
      include: DESIGN_PAYMENT_INCLUDE,
    });
    if (!design) return res.status(404).json({ success: false, error: req.t("design.not_found") });

    // Un design locked (commande en cours) ne peut pas être renommé
    if (design.status === "locked") {
      return res.status(409).json({ success: false, error: req.t("admin.design.rename_locked") });
    }

    const updated = await prisma.design.update({
      where: { id },
      data:  { businessName: name.trim() },
      include: DESIGN_PAYMENT_INCLUDE,
    });

    res.json({ success: true, message: req.t("admin.design.renamed"), data: await formatDesignWithPayment(updated) });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/designs/my/:id/archive
// Passe le design en "archived"
// ─────────────────────────────────────────────────────────────
export const archiveMyDesign = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const userId    = req.user.userId;
    const id        = parseInt(req.params.id);

    const design = await prisma.design.findFirst({
      where: { id, companyId, userId },
      include: DESIGN_PAYMENT_INCLUDE,
    });
    if (!design) return res.status(404).json({ success: false, error: req.t("design.not_found") });

    if (design.status === "locked") {
      return res.status(409).json({ success: false, error: req.t("superadmin.design.cannot_archive_locked") });
    }
    if (design.status === "archived") {
      return res.status(409).json({ success: false, error: req.t("superadmin.design.already_archived") });
    }

    const updated = await prisma.design.update({
      where: { id },
      data:  { status: "archived" },
      include: DESIGN_PAYMENT_INCLUDE,
    });

    res.json({ success: true, message: req.t("superadmin.design.archived"), data: await formatDesignWithPayment(updated) });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/designs/my/:id/restore
// Restaure un design archivé en "draft"
// ─────────────────────────────────────────────────────────────
export const restoreMyDesign = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const userId    = req.user.userId;
    const id        = parseInt(req.params.id);

    const design = await prisma.design.findFirst({
      where: { id, companyId, userId },
      include: DESIGN_PAYMENT_INCLUDE,
    });
    if (!design) return res.status(404).json({ success: false, error: req.t("design.not_found") });

    if (design.status !== "archived") {
      return res.status(409).json({ success: false, error: req.t("admin.design.only_archived_restorable") });
    }

    const updated = await prisma.design.update({
      where: { id },
      data:  { status: "draft" },
      include: DESIGN_PAYMENT_INCLUDE,
    });

    res.json({ success: true, message: req.t("admin.design.restored"), data: await formatDesignWithPayment(updated) });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/designs/my/:id
// Suppression permanente
// Règles métier :
//   - Interdit si status = "locked" (commande en cours)
//   - Interdit si des NFCCards actives sont liées
//   - Autorisé pour draft et archived
// ─────────────────────────────────────────────────────────────
export const deleteMyDesign = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const userId    = req.user.userId;
    const id        = parseInt(req.params.id);

    const design = await prisma.design.findFirst({
      where:   { id, companyId, userId },
      include: { nfcCards: { select: { id: true, active: true, status: true } } },
    });


    if (!design) return res.status(404).json({ success: false, error: req.t("design.not_found") });

    // Bloquer si commande en cours
    if (design.status === "locked") {
      return res.status(409).json({
        success: false,
        error:   req.t("superadmin.design.cannot_delete_locked"),
      });
    }

    // Bloquer si des cartes NFC actives utilisent ce design
    const activeCards = design.nfcCards.filter((c) => c.active || c.status === "ACTIVE");
    if (activeCards.length > 0) {
      return res.status(409).json({
        success: false,
        error:   req.t("admin.design.used_by_nfc_cards", { count: activeCards.length }),
      });
    }

    await prisma.design.delete({ where: { id } });

    res.json({ success: true, message: req.t("superadmin.design.permanently_deleted") });
  } catch (e) { next(e); }
};
