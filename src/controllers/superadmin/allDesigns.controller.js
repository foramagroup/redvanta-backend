// src/controllers/designs.superadmin.controller.js
// ─────────────────────────────────────────────────────────────
// Endpoints SUPERADMIN — vue AllDesigns (platform-wide moderation)
//
// Routes montées sous /api/superadmin/designs
//   GET    /stats          → compteurs globaux (total, active, uniqueUsers, flagged)
//   GET    /               → liste paginée + search + filtre statut
//   GET    /:id            → détail complet d'un design
//   PATCH  /:id/flag       → marquer comme flagged
//   PATCH  /:id/unflag     → retirer le flag → repasse en "draft"
//   PATCH  /:id/archive    → archiver
//   DELETE /:id            → suppression définitive (avec guards métier)
//
// Différence vs designs.client.controller :
//   - Pas de scope userId/companyId → visibilité plateforme entière
//   - Chaque mutation écrit une ligne dans AuditLog
//   - Le formatage inclut user + company pour affichage dans le tableau
// ─────────────────────────────────────────────────────────────

import prisma from "../../config/database.js";

// ─── Helpers ──────────────────────────────────────────────────

// Inclusions Prisma communes à toutes les requêtes de liste/détail
const DESIGN_INCLUDE = {
  user:    { select: { id: true, email: true, name: true } },
  company: { select: { id: true, name: true } },
  nfcCards: { select: { uid: true, active: true, status: true }, take: 1 },
};

// DB → UI   (validated|locked → "active", draft → "draft", archived → "archived", flagged → "flagged")
function mapStatus(dbStatus) {
  if (!dbStatus) return "draft";
  if (dbStatus === "validated" || dbStatus === "locked") return "active";
  return dbStatus; // "draft" | "archived" | "flagged" passent tels quels
}

// UI → DB
const UI_TO_DB_STATUS = {
  active:   "validated",
  draft:    "draft",
  archived: "archived",
  flagged:  "flagged",
};

// Filtre Prisma pour le paramètre ?status=
function buildStatusFilter(status) {
  if (!status || status === "all") return {};
  if (status === "active") return { status: { in: ["validated", "locked"] } };
  return { status: UI_TO_DB_STATUS[status] ?? status };
}

// Formate un row Prisma pour la réponse JSON (vue tableau AllDesigns)
function formatDesign(d) {
  return {
    // ── Identifiants ──────────────────────────────────────
    id:        d.id,
    productId: d.productId,
    companyId: d.companyId,

    // ── Nom & statut ──────────────────────────────────────
    name:         d.businessName ?? `Design #${d.id}`,
    businessName: d.businessName ?? "",
    status:       mapStatus(d.status),

    // ── Template (pour la thumbnail colorée dans la table) ─
    template:       d.templateName ?? d.colorMode ?? "Single",
    templateColor1: d.gradient1    ?? d.bgColor    ?? "#0D0D0D",
    templateColor2: d.gradient2    ?? d.accentColor ?? "#E10600",

    // ── Infos résumé ──────────────────────────────────────
    model:       d.cardModel   ?? "classic",
    orientation: d.orientation ?? "landscape",
    platform:    d.platform    ?? "google",

    // ── Propriétaire ──────────────────────────────────────
    userId:      d.userId,
    userEmail:   d.user?.email  ?? "",
    userName:    d.user?.name   ?? null,
    companyName: d.company?.name ?? null,

    // ── Carte NFC liée (preview) ──────────────────────────
    linkedCard: d.nfcCards?.length > 0
      ? d.nfcCards[0].uid.slice(0, 8).toUpperCase()
      : null,

    // ── Dates ─────────────────────────────────────────────
    createdAt: d.createdAt?.toISOString().split("T")[0] ?? null,
    updatedAt: d.updatedAt?.toISOString().split("T")[0] ?? null,

    // ── Champs visuels complets (pour DesignDetailModal) ──
    slogan:           d.slogan          ?? "",
    callToAction:     d.callToAction    ?? `${'Powered by'+process.env.MAIL_FROM_NAME}`,
    logoUrl:          d.logoUrl         ?? null,
    logoPosition:     d.logoPosition    ?? "left",
    logoSize:         d.logoSize        ?? 32,
    colorMode:        d.colorMode       ?? "template",
    bgColor:          d.bgColor         ?? "#0D0D0D",
    textColor:        d.textColor       ?? "#FFFFFF",
    accentColor:      d.accentColor     ?? "#E10600",
    starColor:        d.starColor       ?? "#FBBF24",
    iconsColor:       d.iconsColor      ?? "#22C55E",
    gradient1:        d.gradient1       ?? "#0D0D0D",
    gradient2:        d.gradient2       ?? "#1A1A1A",
    accentBand1:      d.accentBand1     ?? "#E10600",
    accentBand2:      d.accentBand2     ?? "#FF4444",
    bandPosition:     d.bandPosition    ?? "bottom",
    frontBandHeight:  d.frontBandHeight ?? 22,
    backBandHeight:   d.backBandHeight  ?? 12,
    showNfcIcon:      d.showNfcIcon     ?? true,
    showGoogleIcon:   d.showGoogleIcon  ?? true,
    frontInstruction1: d.frontInstruction1 ?? "",
    frontInstruction2: d.frontInstruction2 ?? "",
    backInstruction1:  d.backInstruction1  ?? "",
    backInstruction2:  d.backInstruction2  ?? "",
    qrCodeStyle:      d.qrCodeStyle ?? "top",
    qrCodeSize:       d.qrCodeSize  ?? 80,
    elementOffsets:   d.elementOffsets ?? null,
    version:          d.version         ?? 1,
    validatedAt:      d.validatedAt     ?? null,
  };
}

// Écrit une ligne dans AuditLog après chaque action de modération
async function writeAuditLog({ adminId, action, designId, ip, reason }) {
  await prisma.auditLog.create({
    data: {
      adminId,
      action,
      target:   `Design#${designId}`,
      metadata: reason ? JSON.stringify({ reason }) : null,
      ip:       ip ?? "unknown",
    },
  });
}

// Récupère l'IP réelle même derrière un proxy
function getIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
    req.headers["x-real-ip"] ??
    req.ip ??
    "unknown"
  );
}

// ─────────────────────────────────────────────────────────────
// GET /api/superadmin/designs/stats
// 4 compteurs pour les cards en haut de la vue AllDesigns
// ─────────────────────────────────────────────────────────────
export const getSuperadminDesignStats = async (req, res, next) => {
  try {
    const [total, byStatus, uniqueUsersRaw] = await Promise.all([
      prisma.design.count(),

      prisma.design.groupBy({
        by:    ["status"],
        _count: { id: true },
      }),

      // userId distincts — équivaut à un COUNT(DISTINCT userId)
      prisma.design.groupBy({
        by: ["userId"],
      }),
    ]);

    const sm = {};
    byStatus.forEach((row) => { sm[row.status] = row._count.id; });

    res.json({
      success: true,
      data: {
        total,
        active:      (sm["validated"] ?? 0) + (sm["locked"] ?? 0),
        flagged:     sm["flagged"]   ?? 0,
        uniqueUsers: uniqueUsersRaw.length,
      },
    });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// GET /api/superadmin/designs
// Liste paginée — toute la plateforme
// Query : ?status=all|active|draft|archived|flagged
//         &search=   (businessName, user email/name, company)
//         &page=1  &limit=20
//         &sortBy=createdAt|updatedAt|businessName  &order=asc|desc
// ─────────────────────────────────────────────────────────────
export const listAllDesigns = async (req, res, next) => {
  try {
    const {
      status  = "all",
      search  = "",
      page    = "1",
      limit   = "20",
      sortBy  = "createdAt",
      order   = "desc",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const take    = Math.min(100, Math.max(1, parseInt(limit)));
    const skip    = (pageNum - 1) * take;

    // Colonnes triables autorisées (évite l'injection via orderBy)
    const SORTABLE = ["createdAt", "updatedAt", "businessName"];
    const safeSort = SORTABLE.includes(sortBy) ? sortBy : "createdAt";
    const safeOrder = order === "asc" ? "asc" : "desc";

    // ── Filtre statut ──────────────────────────────────────
    const where = { ...buildStatusFilter(status) };

    // ── Recherche libre ────────────────────────────────────
    const q = search.trim();
    if (q) {
      where.OR = [
        { businessName: { contains: q } },
        { templateName: { contains: q } },
        { user:    { email: { contains: q } } },
        { user:    { name:  { contains: q } } },
        { company: { name:  { contains: q } } },
      ];
    }

    const [designs, total] = await Promise.all([
      prisma.design.findMany({
        where,
        include:  DESIGN_INCLUDE,
        orderBy:  { [safeSort]: safeOrder },
        skip,
        take,
      }),
      prisma.design.count({ where }),
    ]);

    res.json({
      success: true,
      data:    designs.map(formatDesign),
      meta:    { total, page: pageNum, limit: take, pages: Math.ceil(total / take) },
    });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// GET /api/superadmin/designs/:id
// Détail complet d'un design (pour DesignDetailModal)
// ─────────────────────────────────────────────────────────────
export const getSuperadminDesign = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: "ID invalide" });

    const design = await prisma.design.findUnique({
      where:   { id },
      include: DESIGN_INCLUDE,
    });

    if (!design) return res.status(404).json({ success: false, error: "Design introuvable" });

    res.json({ success: true, data: formatDesign(design) });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/superadmin/designs/:id/flag
// Marque un design comme flagged pour modération
// Body optionnel : { reason: string }
// ─────────────────────────────────────────────────────────────
export const flagDesign = async (req, res, next) => {
  try {
    const id    = parseInt(req.params.id);
    const { reason } = req.body ?? {};
    if (isNaN(id)) return res.status(400).json({ success: false, error: "ID invalide" });

    const design = await prisma.design.findUnique({ where: { id } });
    if (!design) return res.status(404).json({ success: false, error: "Design introuvable" });

    if (design.status === "flagged") {
      return res.status(409).json({ success: false, error: "Design déjà flaggé" });
    }
    if (design.status === "archived") {
      return res.status(409).json({ success: false, error: "Impossible de flagguer un design archivé" });
    }

    const [updated] = await prisma.$transaction([
      prisma.design.update({
        where:   { id },
        data:    { status: "flagged" },
        include: DESIGN_INCLUDE,
      }),
      prisma.auditLog.create({
        data: {
          adminId:  req.user.userId,
          action:   "DESIGN_FLAG",
          target:   `Design#${id}`,
          metadata: reason ? JSON.stringify({ reason }) : null,
          ip:       getIp(req),
        },
      }),
    ]);

    res.json({
      success: true,
      message: "Design flaggé pour révision",
      data:    formatDesign(updated),
    });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/superadmin/designs/:id/unflag
// Retire le flag → repasse en "draft"
// ─────────────────────────────────────────────────────────────
export const unflagDesign = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: "ID invalide" });

    const design = await prisma.design.findUnique({ where: { id } });
    if (!design) return res.status(404).json({ success: false, error: "Design introuvable" });

    if (design.status !== "flagged") {
      return res.status(409).json({ success: false, error: "Seuls les designs flaggés peuvent être unflaggés" });
    }

    const [updated] = await prisma.$transaction([
      prisma.design.update({
        where:   { id },
        data:    { status: "draft" },
        include: DESIGN_INCLUDE,
      }),
      prisma.auditLog.create({
        data: {
          adminId:  req.user.userId,
          action:   "DESIGN_UNFLAG",
          target:   `Design#${id}`,
          metadata: null,
          ip:       getIp(req),
        },
      }),
    ]);

    res.json({
      success: true,
      message: "Flag retiré — design restauré en brouillon",
      data:    formatDesign(updated),
    });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/superadmin/designs/:id/archive
// Archiver un design (depuis n'importe quel statut sauf locked)
// ─────────────────────────────────────────────────────────────
export const archiveDesignSuperadmin = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: "ID invalide" });

    const design = await prisma.design.findUnique({ where: { id } });
    if (!design) return res.status(404).json({ success: false, error: "Design introuvable" });

    if (design.status === "locked") {
      return res.status(409).json({ success: false, error: "Impossible d'archiver un design verrouillé (commande en cours)" });
    }
    if (design.status === "archived") {
      return res.status(409).json({ success: false, error: "Design déjà archivé" });
    }

    const [updated] = await prisma.$transaction([
      prisma.design.update({
        where:   { id },
        data:    { status: "archived" },
        include: DESIGN_INCLUDE,
      }),
      prisma.auditLog.create({
        data: {
          adminId:  req.user.userId,
          action:   "DESIGN_ARCHIVE",
          target:   `Design#${id}`,
          metadata: null,
          ip:       getIp(req),
        },
      }),
    ]);

    res.json({
      success: true,
      message: "Design archivé",
      data:    formatDesign(updated),
    });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/superadmin/designs/:id
// Suppression définitive — guards métier stricts
// Bloqué si :
//   • status = "locked"  (commande en cours)
//   • des OrderItems référencent ce design
//   • des NFCCards actives utilisent ce design
// ─────────────────────────────────────────────────────────────
export const deleteDesignSuperadmin = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: "ID invalide" });

    const design = await prisma.design.findUnique({
      where:   { id },
      include: {
        nfcCards:  { select: { id: true, active: true, status: true } },
        orderItem: { select: { id: true } },
      },
    });

    if (!design) return res.status(404).json({ success: false, error: "Design introuvable" });

    // ── Guard 1 : commande en cours ────────────────────────
    if (design.status === "locked") {
      return res.status(409).json({
        success: false,
        error:   "Impossible de supprimer un design lié à une commande en cours",
      });
    }

    // ── Guard 2 : OrderItems liés ──────────────────────────
    if (design.orderItem?.length > 0) {
      return res.status(409).json({
        success: false,
        error:   `Ce design est référencé par ${design.orderItem.length} ligne(s) de commande. Archivez-le plutôt.`,
      });
    }

    // ── Guard 3 : NFCCards actives ─────────────────────────
    const activeCards = (design.nfcCards ?? []).filter(
      (c) => c.active || c.status === "ACTIVE",
    );
    if (activeCards.length > 0) {
      return res.status(409).json({
        success: false,
        error:   `Ce design est utilisé par ${activeCards.length} carte(s) NFC active(s)`,
      });
    }

    await prisma.$transaction([
      prisma.design.delete({ where: { id } }),
      prisma.auditLog.create({
        data: {
          adminId:  req.user.userId,
          action:   "DESIGN_DELETE",
          target:   `Design#${id}`,
          metadata: JSON.stringify({ businessName: design.businessName, companyId: design.companyId }),
          ip:       getIp(req),
        },
      }),
    ]);

    res.json({ success: true, message: "Design supprimé définitivement" });
  } catch (e) { next(e); }
};