// src/controllers/googlePlaces.controller.js

import prisma from "../../config/database.js";
import {
  autocomplete,
  getPlaceDetails,
  invalidateCache,
  getCacheStats,
} from "../../services/Googleplaces.service.js";

// ─── GET /api/places/search?q=...&session=... ─────────────────
// Suggestions d'autocomplétion pour le champ de recherche
// Appelé à chaque frappe (avec debounce côté front ~300ms)

export const search = async (req, res, next) => {
  try {
    const query        = req.query.q?.trim()       || "";
    const sessionToken = req.query.session         || null;
    const language     = req.query.lang            || "fr";

    if (query.length < 2) {
      return res.json({ success: true, data: [] });
    }

    const suggestions = await autocomplete(query, sessionToken, language);
    res.json({ success: true, data: suggestions });
  } catch (e) { next(e); }
};

// ─── GET /api/places/details/:placeId?session=... ─────────────
// Détails complets d'un lieu sélectionné
// Retourne toutes les infos + reviewUrl + photo

export const details = async (req, res, next) => {
  try {
    const { placeId }  = req.params;
    const sessionToken = req.query.session || null;

    if (!placeId) {
      return res.status(422).json({ success: false, error: "placeId requis" });
    }

    const place = await getPlaceDetails(placeId, sessionToken);

    res.json({ success: true, data: place, fromCache: place.fromCache ?? false });
  } catch (e) { next(e); }
};

// ─── POST /api/places/link-to-company ────────────────────────
// Lier un Google Place à une company
// → sauvegarde placeId + reviewUrl dans la table companies
// → met aussi à jour le design courant si designId fourni

export const linkToCompany = async (req, res, next) => {
  try {
    const { placeId, designId } = req.body;
    const userId    = req.user.userId;
    const companyId = parseInt(req.user.companyId);

    if (!placeId) {
      return res.status(422).json({ success: false, error: "placeId requis" });
    }

    // Récupérer les détails (depuis cache ou API)
    const place = await getPlaceDetails(placeId);

    // 1. Mettre à jour la company
    await prisma.company.update({
      where: { id: companyId },
      data: {
        googlePlaceId:   placeId,
        googleReviewUrl: place.reviewUrl,
        // Pré-remplir d'autres champs si manquants
        ...(place.phone   && { phone:   place.phone }),
        ...(place.website && {
          googleLink: `https://www.google.com/maps/place/?q=place_id:${placeId}`,
        }),
      },
    });

    // 2. Mettre à jour le design si fourni
    if (designId) {
      const design = await prisma.design.findFirst({
        where: { id: parseInt(designId), userId, companyId },
      });
      if (design && design.status !== "locked") {
        await prisma.design.update({
          where: { id: parseInt(designId) },
          data: {
            googlePlaceId:   placeId,
            googleReviewUrl: place.reviewUrl,
            // Pré-remplir le businessName si vide
            ...(place.name && !design.businessName && { businessName: place.name }),
          },
        });
      }
    }

    res.json({
      success:  true,
      message:  `Google Place "${place.name}" lié à votre entreprise`,
      data:     place,
    });
  } catch (e) { next(e); }
};

// ─── POST /api/places/link-to-design ─────────────────────────
// Lier un Google Place directement à un design (sans toucher la company)
// Utilisé depuis le customize step 1

export const linkToDesign = async (req, res, next) => {
  try {
    const { placeId, designId } = req.body;
    const userId    = req.user.userId;
    const companyId = parseInt(req.user.companyId);

    if (!placeId || !designId) {
      return res.status(422).json({ success: false, error: "placeId et designId requis" });
    }

    const design = await prisma.design.findFirst({
      where: { id: parseInt(designId), userId, companyId },
    });
    if (!design) return res.status(404).json({ success: false, error: "Design introuvable" });
    if (design.status === "locked") return res.status(409).json({ success: false, error: "Design verrouillé" });

    // Récupérer les détails depuis cache ou API
    const place = await getPlaceDetails(placeId);

    // Mettre à jour le design
    const updated = await prisma.design.update({
      where: { id: parseInt(designId) },
      data: {
        googlePlaceId:   placeId,
        googleReviewUrl: place.reviewUrl,
        // Pré-remplir le businessName si vide
        ...(place.name && !design.businessName && { businessName: place.name }),
      },
    });

    res.json({
      success: true,
      message: `Place "${place.name}" lié au design`,
      data: {
        placeId:         place.placeId,
        name:            place.name,
        reviewUrl:       place.reviewUrl,
        businessName:    updated.businessName,
        googleReviewUrl: updated.googleReviewUrl,
      },
    });
  } catch (e) { next(e); }
};

// ─── POST /api/places/cache/invalidate ───────────────────────
// Superadmin uniquement — forcer le rechargement d'un lieu

export const invalidatePlaceCache = async (req, res, next) => {
  try {
    const { placeId } = req.body;
    if (!placeId) return res.status(422).json({ success: false, error: "placeId requis" });

    await invalidateCache(placeId);
    res.json({ success: true, message: `Cache invalidé pour placeId: ${placeId}` });
  } catch (e) { next(e); }
};

// ─── GET /api/places/cache/stats ─────────────────────────────
// Superadmin — stats du cache

export const placeCacheStats = async (req, res, next) => {
  try {
    const stats = await getCacheStats();
    res.json({ success: true, data: stats });
  } catch (e) { next(e); }
};