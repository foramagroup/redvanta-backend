// src/controllers/location.controller.js
// Mis à jour pour NFCCard (v3) — remplacement de nfcTag/nfcTags par nfcCard/nfcCards
// Bugs corrigés :
//   - nfcTagIds → nfcCardIds (ligne analytics)
//   - tagId → cardId dans assign-card
//   - nfcTags → nfcCards dans les includes/counts
//   - nfcScan.tagId → nfcScan.cardUid (clé de relation scan)
//   - reviewClicked supprimé (champ inexistant → on utilise AnalyticsEvent)

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
function formatLocation(loc) {
  return {
    id:              loc.id,
    name:            loc.name,
    address:         loc.address           ?? null,
    googlePlaceId:   loc.googlePlaceId     ?? null,
    googleReviewUrl: loc.googleReviewUrl   ?? null,
    googleMapsUrl:   loc.googleMapsUrl     ?? null,
    rating:          loc.googleRating      ? Number(loc.googleRating) : 0,
    reviews:         loc.googleReviewCount ?? 0,
    // ✅ nfcCards (plus nfcTags ni nfccards)
    cards:           loc._count?.nfcCards  ?? loc.cardCount ?? 0,
    active:          loc.active,
    createdAt:       loc.createdAt,
    updatedAt:       loc.updatedAt,
  };
}

// ─── GET /api/locations ───────────────────────────────────────
export const listLocations = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);

    const locations = await prisma.location.findMany({
      where:   { companyId },
      include: { _count: { select: { nfcCards: true } } },
      orderBy: { createdAt: "asc" },
    });

    res.json({ success: true, data: locations.map(formatLocation) });
  } catch (e) { next(e); }
};


export const listCompanyNfcCards = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const nfcCards = await prisma.nFCCard.findMany({
      where: { 
        companyId: companyId,
        locationId: null
      },
      select: {
        id: true,
        companyId: true,
        uid: true,
        tagId: true,
        locationId: true,
        tag: { 
          select: { 
            tagSerial: true 
          } 
        },
      }
    });
    res.json({ success: true, data: nfcCards });
  } catch (e) { 
    next(e); 
  }
};

// ─── GET /api/locations/:id ───────────────────────────────────
export const getLocation = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const companyId = getCompanyId(req);

    const loc = await prisma.location.findFirst({
      where:   { id, companyId },
      include: { _count: { select: { nfcCards: true } } },
    });
    if (!loc) return res.status(404).json({ success: false, error: "Location introuvable" });

    res.json({ success: true, data: formatLocation(loc) });
  } catch (e) { next(e); }
};

// ─── POST /api/locations ──────────────────────────────────────
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
          googlePlaceId:     placeId,
          googleReviewUrl:   place.reviewUrl,
          googleMapsUrl:     `https://www.google.com/maps/place/?q=place_id:${placeId}`,
          googleRating:      place.rating           ?? null,
          googleReviewCount: place.userRatingsTotal  ?? 0,
          address:           address || place.formattedAddress || null,
        };
      } catch (e) {
        console.error("[location] Erreur Google Places:", e.message);
        googleData = { googlePlaceId: placeId };
      }
    }

    const location = await prisma.location.create({
      data: {
        companyId,
        ownerId,
        name:      name.trim(),
        address:   googleData.address ?? address ?? null,
        ...googleData,
        cardCount: parseInt(cards) || 0,
        active:    true,
      },
      include: { _count: { select: { nfcCards: true } } },
    });

    // Mettre à jour googlePlaceId de la company si elle n'en a pas encore
    if (placeId) {
      const company = await prisma.company.findUnique({ where: { id: companyId }, select: { googlePlaceId: true } });
      if (!company?.googlePlaceId) {
        await prisma.company.update({
          where: { id: companyId },
          data: { googlePlaceId: placeId, googleReviewUrl: googleData.googleReviewUrl ?? null },
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
export const updateLocation = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const companyId = getCompanyId(req);
    const { name, address, placeId, cards } = req.body;

    const existing = await prisma.location.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ success: false, error: "Location introuvable" });

    let googleData = {};
    if (placeId && placeId !== existing.googlePlaceId) {
      try {
        const place = await getPlaceDetails(placeId);
        googleData = {
          googlePlaceId:     placeId,
          googleReviewUrl:   place.reviewUrl,
          googleMapsUrl:     `https://www.google.com/maps/place/?q=place_id:${placeId}`,
          googleRating:      place.rating           ?? null,
          googleReviewCount: place.userRatingsTotal  ?? 0,
        };
      } catch (e) {
        console.error("[location] Erreur Google Places:", e.message);
        googleData = { googlePlaceId: placeId };
      }
    }

    const updated = await prisma.location.update({
      where: { id },
      data: {
        ...(name    !== undefined && { name:      name.trim() }),
        ...(address !== undefined && { address:   address || null }),
        ...(cards   !== undefined && { cardCount: parseInt(cards) || 0 }),
        ...googleData,
      },
      include: { _count: { select: { nfcCards: true } } },
    });

    res.json({ success: true, message: "Location mise à jour", data: formatLocation(updated) });
  } catch (e) { next(e); }
};

// ─── PATCH /api/locations/:id/toggle ─────────────────────────
export const toggleLocation = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const companyId = getCompanyId(req);

    const existing = await prisma.location.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ success: false, error: "Location introuvable" });

    const updated = await prisma.location.update({
      where:   { id },
      data:    { active: !existing.active },
      include: { _count: { select: { nfcCards: true } } },
    });

    res.json({
      success: true,
      message: `Location ${updated.active ? "activée" : "désactivée"}`,
      data:    formatLocation(updated),
    });
  } catch (e) { next(e); }
};

// ─── DELETE /api/locations/:id ────────────────────────────────
export const deleteLocation = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const companyId = getCompanyId(req);

    const existing = await prisma.location.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ success: false, error: "Location introuvable" });

    // ✅ Détacher les NFCCards liées (SetNull sur locationId)
    await prisma.nFCCard.updateMany({
      where: { locationId: id },
      data:  { locationId: null, locationName: null, locationAddress: null },
    });

    await prisma.location.delete({ where: { id } });

    res.json({ success: true, message: `Location "${existing.name}" supprimée` });
  } catch (e) { next(e); }
};

// ─── GET /api/locations/stats ─────────────────────────────────
export const getLocationStats = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);

    const [total, active, locations] = await Promise.all([
      prisma.location.count({ where: { companyId } }),
      prisma.location.count({ where: { companyId, active: true } }),
      prisma.location.findMany({
        where:   { companyId },
        // ✅ nfcCards (plus nfcTags)
        include: { _count: { select: { nfcCards: true } } },
      }),
    ]);

    // ✅ _count.nfcCards (plus _count.nfcTags)
    const totalCards   = locations.reduce((s, l) => s + (l._count?.nfcCards ?? 0), 0);
    const totalReviews = locations.reduce((s, l) => s + (l.googleReviewCount ?? 0), 0);
    const ratedLocs    = locations.filter((l) => l.googleRating);
    const avgRating    = ratedLocs.length > 0
      ? ratedLocs.reduce((s, l) => s + Number(l.googleRating), 0) / ratedLocs.length
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

// ─── GET /api/locations/:id/analytics ────────────────────────
export const getLocationAnalytics = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const companyId = getCompanyId(req);

    const loc = await prisma.location.findFirst({
      where:   { id, companyId },
      include: { _count: { select: { nfcCards: true } } },
    });
    if (!loc) return res.status(404).json({ success: false, error: "Location introuvable" });

    const nfcCards = await prisma.nFCCard.findMany({
      where:  { locationId: id },
      select: { uid: true },
    });
    const cardUids = nfcCards.map((c) => c.uid);

    // Stats via AnalyticsEvent (plus de champ reviewClicked qui n'existe pas)
    const [totalScans, googleRedirects] = cardUids.length
      ? await Promise.all([
          prisma.analyticsEvent.count({ where: { cardUid: { in: cardUids }, type: "SCAN" } }),
          prisma.analyticsEvent.count({ where: { cardUid: { in: cardUids }, type: "GOOGLE_REDIRECT" } }),
        ])
      : [0, 0];

    const conversionRate = totalScans > 0 ? Math.round((googleRedirects / totalScans) * 100) : 0;

    // Trend mensuel (6 derniers mois)
    const monthlyTrend = await getMonthlyTrend(cardUids);

    res.json({
      success: true,
      data: {
        location:       formatLocation(loc),
        rating:         loc.googleRating      ? Number(loc.googleRating) : 0,
        reviews:        loc.googleReviewCount ?? 0,
        conversion:     `${conversionRate}%`,
        monthlyTrend,
        totalScans,
        googleRedirects,
        cardCount:      cardUids.length,
      },
    });
  } catch (e) { next(e); }
};

// ─── POST /api/locations/:id/refresh-google ──────────────────
export const refreshGoogleData = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const companyId = getCompanyId(req);

    const loc = await prisma.location.findFirst({ where: { id, companyId } });
    if (!loc) return res.status(404).json({ success: false, error: "Location introuvable" });
    if (!loc.googlePlaceId) {
      return res.status(422).json({ success: false, error: "Aucun Google Place ID associé à cette location" });
    }

    const { invalidateCache } = await import("../services/Googleplaces.service.js");
    await invalidateCache(loc.googlePlaceId);
    const place = await getPlaceDetails(loc.googlePlaceId);

    const updated = await prisma.location.update({
      where: { id },
      data: {
        googleRating:      place.rating           ?? null,
        googleReviewCount: place.userRatingsTotal  ?? 0,
        googleReviewUrl:   place.reviewUrl         ?? loc.googleReviewUrl,
      },
      // ✅ nfcCards
      include: { _count: { select: { nfcCards: true } } },
    });

    res.json({ success: true, message: "Données Google mises à jour", data: formatLocation(updated) });
  } catch (e) { next(e); }
};

// ─── POST /api/locations/:id/assign-card ─────────────────────
export const assignNfcCard = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const companyId = getCompanyId(req);
    // ✅ cardId (plus tagId — on travaille avec NFCCard.id)
    const { cardId } = req.body;

    if (!cardId) return res.status(422).json({ success: false, error: "cardId requis" });

    const loc = await prisma.location.findFirst({ where: { id, companyId } });
    if (!loc) return res.status(404).json({ success: false, error: "Location introuvable" });

    // ✅ Chercher par id (NFCCard.id) et companyId
    const card = await prisma.nFCCard.findFirst({ where: { id: cardId, companyId } });
    if (!card) return res.status(404).json({ success: false, error: "NFCCard introuvable" });

    // ✅ Mettre à jour la NFCCard (champs corrects du modèle v3)
    await prisma.nFCCard.update({
      where: { id: cardId },
      data: {
        locationId:      id,
        googlePlaceId:   loc.googlePlaceId   ?? card.googlePlaceId,
        googleReviewUrl: loc.googleReviewUrl  ?? card.googleReviewUrl,
        locationName:    loc.name,
        locationAddress: loc.address ?? null,
      },
    });

    // Recalculer cardCount sur la location
    const cardCount = await prisma.nFCCard.count({ where: { locationId: id } });
    await prisma.location.update({ where: { id }, data: { cardCount } });

    res.json({ success: true, message: `NFCCard #${cardId} assignée à "${loc.name}"` });
  } catch (e) { next(e); }
};

// ─── Helper : trend mensuel des scans (6 derniers mois) ──────

async function getMonthlyTrend(cardUids) {
  if (!cardUids.length) {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { month: d.toLocaleString("en-US", { month: "short" }), scans: 0 };
    });
  }

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  // ✅ AnalyticsEvent.cardUid (plus nfcScan.tagId qui n'existe plus)
  const events = await prisma.analyticsEvent.findMany({
    where:  {
      cardUid:    { in: cardUids },
      type:       "SCAN",
      occurredAt: { gte: sixMonthsAgo },
    },
    select: { occurredAt: true },
  });

  const byMonth = {};
  events.forEach((e) => {
    const key = `${e.occurredAt.getFullYear()}-${e.occurredAt.getMonth()}`;
    byMonth[key] = (byMonth[key] || 0) + 1;
  });

  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d   = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    return { month: d.toLocaleString("en-US", { month: "short" }), scans: byMonth[key] || 0 };
  });
}