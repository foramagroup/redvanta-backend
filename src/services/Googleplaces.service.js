

import prisma from "../config/database.js";

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const CACHE_TTL_DAYS = 30;
const BASE_URL       = "https://maps.googleapis.com/maps/api";


function assertApiKey() {
  if (!GOOGLE_API_KEY) {
    throw Object.assign(
      new Error("GOOGLE_PLACES_API_KEY non configurée dans .env"),
      { status: 503 }
    );
  }
}

// ─── 1. AUTOCOMPLETE — Suggestions de recherche ──────────────

export async function autocomplete(input, sessionToken, language = "fr") {
  assertApiKey();

  if (!input || input.trim().length < 2) return [];

  const params = new URLSearchParams({
    input:        input.trim(),
    key:          GOOGLE_API_KEY,
    language,
    sessiontoken: sessionToken,
    types:        "establishment",
  });

  const response = await fetch(`${BASE_URL}/place/autocomplete/json?${params}`);
  if (!response.ok) throw new Error(`Google Autocomplete HTTP ${response.status}`);

  const data = await response.json();

  if (data.status === "ZERO_RESULTS") return [];
  if (data.status !== "OK") {
    console.error("[places] Autocomplete error:", data.status, data.error_message);
    throw new Error(`Google Places: ${data.status}`);
  }

  return data.predictions.map((p) => ({
    placeId:       p.place_id,
    description:   p.description,
    mainText:      p.structured_formatting?.main_text    ?? p.description,
    secondaryText: p.structured_formatting?.secondary_text ?? "",
  }));
}

// ─── 2. PLACE DETAILS — Détails complets d'un lieu ──────────


export async function getPlaceDetails(placeId, sessionToken = null) {
  assertApiKey();

  if (!placeId) throw Object.assign(new Error("placeId requis"), { status: 422 });

  // 1. Vérifier le cache DB d'abord
  const cached = await getCachedPlace(placeId);
  if (cached) {
    console.log(`[places] Cache HIT pour placeId: ${placeId}`);
    return cached;
  }

  console.log(`[places] Cache MISS — appel Google API pour placeId: ${placeId}`);

  // 2. Appel Google Places Details API
  const fields = [
    "place_id", "name", "formatted_address",
    "formatted_phone_number", "website",
    "geometry/location",
    "rating", "user_ratings_total",
    "types", "photos",
    "url",   // URL Google Maps du lieu
  ].join(",");

  const params = new URLSearchParams({
    place_id:  placeId,
    fields,
    key:       GOOGLE_API_KEY,
    language:  "fr",
    ...(sessionToken && { sessiontoken: sessionToken }),
  });

  const response = await fetch(`${BASE_URL}/place/details/json?${params}`);
  if (!response.ok) throw new Error(`Google Place Details HTTP ${response.status}`);

  const data = await response.json();

  if (data.status !== "OK") {
    console.error("[places] Details error:", data.status, data.error_message);
    throw new Error(`Google Places: ${data.status}`);
  }

  const place  = data.result;
  const result = formatPlaceResult(place, placeId);

  // 3. Sauvegarder en cache DB
  await savePlaceToCache(result);

  return result;
}



function formatPlaceResult(place, placeId) {
  // URL pour laisser un avis Google
  // Format officiel : https://search.google.com/local/writereview?placeid=ChIJxxx
  const reviewUrl = `https://search.google.com/local/writereview?placeid=${placeId}`;

  // Photo principale (reference pour construire l'URL)
  const photo         = place.photos?.[0] ?? null;
  const photoReference = photo?.photo_reference ?? null;
  const photoUrl       = photoReference
    ? `${BASE_URL}/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${GOOGLE_API_KEY}`
    : null;

  return {
    placeId:          placeId,
    name:             place.name             ?? null,
    formattedAddress: place.formatted_address ?? null,
    phone:            place.formatted_phone_number ?? null,
    website:          place.website          ?? null,
    lat:              place.geometry?.location?.lat ?? null,
    lng:              place.geometry?.location?.lng ?? null,
    rating:           place.rating           ?? null,
    userRatingsTotal: place.user_ratings_total ?? null,
    reviewUrl,
    photoReference,
    photoUrl,
    types:            place.types            ?? [],
    mapsUrl:          place.url              ?? null, // URL de la fiche Google Maps
  };
}


async function getCachedPlace(placeId) {
  const record = await prisma.googlePlaceCache.findUnique({
    where: { placeId },
  });

  if (!record) return null;

  // Vérifier expiration
  if (record.expiresAt < new Date()) {
    // Entrée expirée → supprimer et retourner null (on ira re-chercher)
    await prisma.googlePlaceCache.delete({ where: { placeId } }).catch(() => {});
    return null;
  }

  return {
    placeId:          record.placeId,
    name:             record.name,
    formattedAddress: record.formattedAddress,
    phone:            record.phone,
    website:          record.website,
    lat:              record.lat ? Number(record.lat) : null,
    lng:              record.lng ? Number(record.lng) : null,
    rating:           record.rating ? Number(record.rating) : null,
    userRatingsTotal: record.userRatingsTotal,
    reviewUrl:        record.reviewUrl,
    photoReference:   record.photoReference,
    photoUrl:         record.photoUrl,
    types:            record.types ?? [],
    fromCache:        true,
    cachedAt:         record.cachedAt,
  };
}


async function savePlaceToCache(place) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);

  await prisma.googlePlaceCache.upsert({
    where:  { placeId: place.placeId },
    update: {
      name:             place.name,
      formattedAddress: place.formattedAddress,
      phone:            place.phone,
      website:          place.website,
      lat:              place.lat,
      lng:              place.lng,
      rating:           place.rating,
      userRatingsTotal: place.userRatingsTotal,
      reviewUrl:        place.reviewUrl,
      photoReference:   place.photoReference,
      photoUrl:         place.photoUrl,
      types:            place.types,
      cachedAt:         new Date(),
      expiresAt,
    },
    create: {
      placeId:          place.placeId,
      name:             place.name,
      formattedAddress: place.formattedAddress,
      phone:            place.phone,
      website:          place.website,
      lat:              place.lat,
      lng:              place.lng,
      rating:           place.rating,
      userRatingsTotal: place.userRatingsTotal,
      reviewUrl:        place.reviewUrl,
      photoReference:   place.photoReference,
      photoUrl:         place.photoUrl,
      types:            place.types,
      expiresAt,
    },
  });

  console.log(`[places] Cache WRITE pour placeId: ${place.placeId} (expire le ${expiresAt.toISOString().split("T")[0]})`);
}


export async function invalidateCache(placeId) {
  await prisma.googlePlaceCache.deleteMany({ where: { placeId } });
  console.log(`[places] Cache INVALIDATED pour placeId: ${placeId}`);
}


export async function getCacheStats() {
  const [total, expired, valid] = await Promise.all([
    prisma.googlePlaceCache.count(),
    prisma.googlePlaceCache.count({ where: { expiresAt: { lt: new Date() } } }),
    prisma.googlePlaceCache.count({ where: { expiresAt: { gte: new Date() } } }),
  ]);
  return { total, expired, valid };
}