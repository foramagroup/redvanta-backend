
import prisma from "../config/database.js";
import { getPlaceDetails } from "../services/Googleplaces.service.js";

// ─── Helpers ──────────────────────────────────────────────────

function getCompanyId(req) {
  const id = req.user?.companyId;
  if (!id) throw Object.assign(new Error("Aucune company active"), { status: 403 });
  return parseInt(id);
}

function getOwnerId(req) {
  return req.user.userId;
}

// Format location pour la réponse API
// Correspond exactement à la shape attendue par la vue front
function formatLocation(loc) {
  return {
    id:                loc.id,
    name:              loc.name,
    address:           loc.address     ?? null,
    googlePlaceId:     loc.googlePlaceId ?? null,
    googleReviewUrl:   loc.googleReviewUrl ?? null,
    googleMapsUrl:     loc.googleMapsUrl ?? null,
    // Métriques Google (correspondant aux 3 cards de la vue)
    rating:            loc.googleRating     ? Number(loc.googleRating)   : 0,
    reviews:           loc.googleReviewCount ?? 0,
    cards:             loc._count?.nfccards ?? loc.cardCount ?? 0,
    active:            loc.active,
    createdAt:         loc.createdAt,
    updatedAt:         loc.updatedAt,
  };
}

// ─── GET /api/locations ───────────────────────────────────────
// Liste toutes les locations de la company courante
// Retourne le comptage de cards NFC en temps réel
export const listLocations = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);

    const locations = await prisma.location.findMany({
      where:   { companyId },
      include: { _count: { select: { nfccards: true } } },
      orderBy: { createdAt: "asc" },
    });

    res.json({
      success: true,
      data:    locations.map(formatLocation),
    });
  } catch (e) { next(e); }
};

// ─── GET /api/locations/:id ───────────────────────────────────
export const getLocation = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const companyId = getCompanyId(req);

    const loc = await prisma.location.findFirst({
      where:   { id, companyId },
      include: { _count: { select: { nfccards: true } } },
    });
    if (!loc) return res.status(404).json({ success: false, error: "Location introuvable" });

    res.json({ success: true, data: formatLocation(loc) });
  } catch (e) { next(e); }
};

// ─── POST /api/locations ──────────────────────────────────────
// Créer une nouvelle location
// Si un placeId est fourni → enrichir automatiquement avec les données Google
// Body : { name, address, placeId?, cards? }
export const createLocation = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const ownerId   = getOwnerId(req);
    const { name, address, placeId, cards } = req.body;

    if (!name?.trim()) {
      return res.status(422).json({ success: false, error: "Le nom de la location est requis" });
    }

    // Vérifier la limite du plan
    const settings = await prisma.companySettings.findUnique({ where: { companyId } });
    const currentCount = await prisma.location.count({ where: { companyId } });
    if (settings && currentCount >= settings.maxLocations) {
      return res.status(403).json({
        success: false,
        error:   `Limite atteinte : votre plan autorise ${settings.maxLocations} location(s). Passez au plan supérieur.`,
        code:    "LOCATION_LIMIT_REACHED",
      });
    }

    // Données Google Places si placeId fourni
    let googleData = {};
    if (placeId) {
      try {
        const place = await getPlaceDetails(placeId);
        googleData = {
          googlePlaceId:    placeId,
          googleReviewUrl:  place.reviewUrl,
          googleMapsUrl:    `https://www.google.com/maps/place/?q=place_id:${placeId}`,
          googleRating:     place.rating      ?? null,
          googleReviewCount: place.userRatingsTotal ?? 0,
          // Pré-remplir l'adresse si vide
          address:          address || place.formattedAddress || null,
        };
      } catch (e) {
        console.error("[location] Erreur Google Places:", e.message);
        // On continue sans les données Google — non bloquant
        googleData = { googlePlaceId: placeId };
      }
    }

    const location = await prisma.location.create({
      data: {
        companyId,
        ownerId,
        name:    name.trim(),
        address: googleData.address ?? address ?? null,
        ...googleData,
        cardCount: parseInt(cards) || 0,
        active:    true,
      },
      include: { _count: { select: { nfccards: true } } },
    });

    // Si placeId, mettre aussi à jour la company (googlePlaceId principal)
    // seulement si la company n'en a pas déjà un
    if (placeId) {
      const company = await prisma.company.findUnique({ where: { id: companyId }, select: { googlePlaceId: true } });
      if (!company?.googlePlaceId) {
        await prisma.company.update({
          where: { id: companyId },
          data: {
            googlePlaceId:   placeId,
            googleReviewUrl: googleData.googleReviewUrl ?? null,
          },
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Location "${location.name}" créée`,
      data:    formatLocation(location),
    });
  } catch (e) { next(e); }
};

// ─── PUT /api/locations/:id ───────────────────────────────────
// Modifier une location (dialog "Edit")
// Body : { name, address, placeId?, cards? }
export const updateLocation = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const companyId = getCompanyId(req);
    const { name, address, placeId, cards } = req.body;

    const existing = await prisma.location.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ success: false, error: "Location introuvable" });

    // Si le placeId a changé → récupérer les nouvelles données Google
    let googleData = {};
    if (placeId && placeId !== existing.googlePlaceId) {
      try {
        const place = await getPlaceDetails(placeId);
        googleData = {
          googlePlaceId:    placeId,
          googleReviewUrl:  place.reviewUrl,
          googleMapsUrl:    `https://www.google.com/maps/place/?q=place_id:${placeId}`,
          googleRating:     place.rating ?? null,
          googleReviewCount: place.userRatingsTotal ?? 0,
        };
      } catch (e) {
        console.error("[location] Erreur Google Places:", e.message);
        googleData = { googlePlaceId: placeId };
      }
    }

    const updated = await prisma.location.update({
      where: { id },
      data: {
        ...(name    !== undefined && { name:    name.trim() }),
        ...(address !== undefined && { address: address || null }),
        ...(cards   !== undefined && { cardCount: parseInt(cards) || 0 }),
        ...googleData,
      },
      include: { _count: { select: { nfccards: true } } },
    });

    res.json({
      success: true,
      message: "Location mise à jour",
      data:    formatLocation(updated),
    });
  } catch (e) { next(e); }
};

// ─── PATCH /api/locations/:id/toggle ─────────────────────────
// Activer/désactiver une location (switch dans la carte)
export const toggleLocation = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const companyId = getCompanyId(req);

    const existing = await prisma.location.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ success: false, error: "Location introuvable" });

    const updated = await prisma.location.update({
      where: { id },
      data:  { active: !existing.active },
      include: { _count: { select: { nfccards: true } } },
    });

    res.json({
      success: true,
      message: `Location ${updated.active ? "activée" : "désactivée"}`,
      data:    formatLocation(updated),
    });
  } catch (e) { next(e); }
};

// ─── DELETE /api/locations/:id ────────────────────────────────
// Supprimer une location (bouton poubelle + confirm dialog)
export const deleteLocation = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const companyId = getCompanyId(req);

    const existing = await prisma.location.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ success: false, error: "Location introuvable" });

    // Détacher les tags NFC liés à cette location (SetNull)
    await prisma.nfcCard.updateMany({
      where: { locationId: id },
      data:  { locationId: null },
    });

    await prisma.location.delete({ where: { id } });

    res.json({ success: true, message: `Location "${existing.name}" supprimée` });
  } catch (e) { next(e); }
};

// ─── GET /api/locations/:id/analytics ────────────────────────
// Analytics d'une location (dialog "Analytics" de la vue)
// Retourne : rating, reviews, conversion, trend mensuel des scans
export const getLocationAnalytics = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const companyId = getCompanyId(req);

    const loc = await prisma.location.findFirst({
      where:   { id, companyId },
      include: { _count: { select: { nfccards: true } } },
    });
    if (!loc) return res.status(404).json({ success: false, error: "Location introuvable" });

    // Récupérer les scans via les tags NFC de cette location
    // On cherche les scans des tags liés à ce googlePlaceId ou locationId
    const nfcCardIds = await prisma.nfcCard.findMany({
      where:  { locationId: id },
      select: { tagId: true },
    });
    const tagIdList = nfcTagIds.map((t) => t.tagId);

    // Stats totales
    const [totalScans, reviewClicks] = tagIdList.length
      ? await Promise.all([
          prisma.nfcScan.count({ where: { tagId: { in: tagIdList } } }),
          prisma.nfcScan.count({ where: { tagId: { in: tagIdList }, reviewClicked: true } }),
        ])
      : [0, 0];

    const conversionRate = totalScans > 0 ? Math.round((reviewClicks / totalScans) * 100) : 0;

    // Trend mensuel (6 derniers mois)
    const monthlyTrend = await getMonthlyTrend(tagIdList);

    res.json({
      success: true,
      data: {
        location: formatLocation(loc),
        // Métriques affichées dans les 3 cards du dialog
        rating:     loc.googleRating      ? Number(loc.googleRating) : 0,
        reviews:    loc.googleReviewCount ?? 0,
        conversion: `${conversionRate}%`,
        // Données pour le graphique bar (6 mois)
        monthlyTrend,
        // Stats scans
        totalScans,
        reviewClicks,
        cardCount: nfcTagIds.length,
      },
    });
  } catch (e) { next(e); }
};

// ─── GET /api/locations/stats ─────────────────────────────────
// Stats globales de toutes les locations de la company
export const getLocationStats = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);

    const [total, active, locations] = await Promise.all([
      prisma.location.count({ where: { companyId } }),
      prisma.location.count({ where: { companyId, active: true } }),
      prisma.location.findMany({
        where:   { companyId },
        include: { _count: { select: { nfcTags: true } } },
      }),
    ]);

    const totalCards   = locations.reduce((s, l) => s + (l._count?.nfcTags ?? 0), 0);
    const totalReviews = locations.reduce((s, l) => s + (l.googleReviewCount ?? 0), 0);
    const avgRating    = locations.filter((l) => l.googleRating).length > 0
      ? (locations.reduce((s, l) => s + (l.googleRating ? Number(l.googleRating) : 0), 0) /
         locations.filter((l) => l.googleRating).length)
      : 0;

    res.json({
      success: true,
      data: {
        total,
        active,
        inactive:     total - active,
        totalCards,
        totalReviews,
        avgRating:    Math.round(avgRating * 10) / 10,
      },
    });
  } catch (e) { next(e); }
};

// ─── POST /api/locations/:id/refresh-google ──────────────────
// Rafraîchir les données Google (rating, reviews) depuis l'API Places
// Utile si les données sont périmées
export const refreshGoogleData = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const companyId = getCompanyId(req);

    const loc = await prisma.location.findFirst({ where: { id, companyId } });
    if (!loc) return res.status(404).json({ success: false, error: "Location introuvable" });
    if (!loc.googlePlaceId) {
      return res.status(422).json({ success: false, error: "Aucun Google Place ID associé à cette location" });
    }

    // Forcer le rechargement depuis Google (invalidate cache)
    const { invalidateCache } = await import("../services/Googleplaces.service.js");
    await invalidateCache(loc.googlePlaceId);
    const place = await getPlaceDetails(loc.googlePlaceId);

    const updated = await prisma.location.update({
      where: { id },
      data: {
        googleRating:     place.rating ?? null,
        googleReviewCount: place.userRatingsTotal ?? 0,
        googleReviewUrl:  place.reviewUrl ?? loc.googleReviewUrl,
      },
      include: { _count: { select: { nfcTags: true } } },
    });

    res.json({
      success: true,
      message: "Données Google mises à jour",
      data:    formatLocation(updated),
    });
  } catch (e) { next(e); }
};

// ─── POST /api/locations/:id/assign-card ─────────────────────
// Assigner un tag NFC existant à une location
// (pour les tags créés sans locationId)
export const assignNfcCard = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const companyId = getCompanyId(req);
    const { cardId } = req.body;

    if (!tagId) return res.status(422).json({ success: false, error: "cardId requis" });

    const loc = await prisma.location.findFirst({ where: { id, companyId } });
    if (!loc) return res.status(404).json({ success: false, error: "Location introuvable" });

    const card = await prisma.nfcCard.findFirst({ where: { tagId, companyId } });
    if (!card) return res.status(404).json({ success: false, error: "Card NFC introuvable" });

    // Mettre à jour le card + synchroniser les données
    await prisma.nfcCard.update({
      where: { cardId },
      data: {
        locationId:      id,
        googlePlaceId:   loc.googlePlaceId   ?? tag.googlePlaceId,
        googleReviewUrl: loc.googleReviewUrl  ?? tag.googleReviewUrl,
        locationName:    loc.name,
        locationAddress: loc.address ?? null,
      },
    });

    // Recalculer cardCount
    const cardCount = await prisma.nfcCard.count({ where: { locationId: id } });
    await prisma.location.update({ where: { id }, data: { cardCount } });

    res.json({ success: true, message: `Tag ${tagId} assigné à "${loc.name}"` });
  } catch (e) { next(e); }
};

// ─── Helpers analytics ────────────────────────────────────────

async function getMonthlyTrend(tagIdList) {
  if (!tagIdList.length) {
    // Retourner 6 mois vides
    const months = [];
    const now    = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        month: d.toLocaleString("en-US", { month: "short" }),
        scans: 0,
      });
    }
    return months;
  }

  // Scans des 6 derniers mois
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const scans = await prisma.nfcScan.findMany({
    where:  { cardId: { in: tagIdList }, scannedAt: { gte: sixMonthsAgo } },
    select: { scannedAt: true },
  });

  // Grouper par mois
  const byMonth = {};
  scans.forEach((s) => {
    const key = `${s.scannedAt.getFullYear()}-${s.scannedAt.getMonth()}`;
    byMonth[key] = (byMonth[key] || 0) + 1;
  });

  // Construire le tableau des 6 derniers mois
  const result = [];
  const now    = new Date();
  for (let i = 5; i >= 0; i--) {
    const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    result.push({
      month: d.toLocaleString("en-US", { month: "short" }),
      scans: byMonth[key] || 0,
    });
  }

  return result;
}