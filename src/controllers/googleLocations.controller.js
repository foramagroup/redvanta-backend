import prisma from "../config/database.js";
import { getGoogleCredentials } from "./googleOAuth.controller.js";
import { decrypt, encrypt, isEncrypted } from "../utils/tokenEncryption.js";

// Helper: get a valid access token (refresh if needed)
export async function getValidToken(companyId) {
  const conn = await prisma.googleConnection.findUnique({ where: { companyId } });
  if (!conn) throw new Error("No Google connection");

  const needsRefresh = !conn.expiresAt || conn.expiresAt < new Date(Date.now() + 60_000);

  if (!needsRefresh) {
    // Déchiffre l'access token avant de le retourner
    return decrypt(conn.accessToken);
  }

  if (!conn.refreshToken) {
    await prisma.googleConnection.update({ where: { companyId }, data: { needsReauth: true } });
    throw new Error("Token expired and no refresh token — reauth required");
  }

  // Lit les credentials OAuth depuis la DB (pas depuis .env)
  const { clientId, clientSecret } = await getGoogleCredentials();

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: decrypt(conn.refreshToken), // déchiffre avant envoi
      grant_type:    "refresh_token",
    }),
  });
  const tokens = await resp.json();
  if (!tokens.access_token) throw new Error("Refresh failed: " + (tokens.error ?? "unknown"));

  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);
  // Stocke le nouveau access_token chiffré
  await prisma.googleConnection.update({
    where: { companyId },
    data: { accessToken: encrypt(tokens.access_token), expiresAt, needsReauth: false },
  });
  return tokens.access_token;
}

// GET /api/admin/google/locations?refresh=1
// Sans refresh : retourne les locations déjà en DB (pas d'appel Google API).
// Avec refresh=1 : appelle l'API Google et met à jour la DB.
export async function getLocations(req, res) {
  const companyId = req.user.companyId;
  const forceRefresh = req.query.refresh === "1";

  try {
    const dbLocs = await prisma.googleBusinessLocation.findMany({ where: { companyId } });

    // Si on a déjà des locations en DB ET pas de refresh forcé, on sert directement depuis la DB
    if (dbLocs.length > 0 && !forceRefresh) {
      const locations = dbLocs.map((l) => ({
        id:        l.locationId,
        locationId: l.locationId,
        name:      l.locationName,
        address:   l.address ?? "",
        rating:    l.rating ?? null,
        reviews:   l.reviewCount ?? 0,
        connected: l.connected,
        primary:   l.primary,
      }));
      return res.json({ locations, fromCache: true });
    }

    // Sinon on appelle l'API Google (première fois ou refresh manuel)
    let token;
    try { token = await getValidToken(companyId); } catch (e) {
      // Si on a des données en DB malgré tout, on les sert en fallback
      if (dbLocs.length > 0) {
        const locations = dbLocs.map((l) => ({
          id: l.locationId, locationId: l.locationId,
          name: l.locationName, address: l.address ?? "",
          rating: l.rating ?? null, reviews: l.reviewCount ?? 0,
          connected: l.connected, primary: l.primary,
        }));
        return res.json({ locations, fromCache: true });
      }
      return res.status(401).json({ error: e.message });
    }

    const accountsResp = await fetch(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const accountsData = await accountsResp.json();

    if (!accountsResp.ok) {
      const msg = accountsData?.error?.message || `Google API error ${accountsResp.status}`;
      const isQuota = accountsResp.status === 429 || (msg && msg.toLowerCase().includes("quota"));
      console.error("[getLocations] accounts API error:", accountsData);
      // Fallback sur DB si dispo
      if (dbLocs.length > 0) {
        const locations = dbLocs.map((l) => ({
          id: l.locationId, locationId: l.locationId,
          name: l.locationName, address: l.address ?? "",
          rating: l.rating ?? null, reviews: l.reviewCount ?? 0,
          connected: l.connected, primary: l.primary,
        }));
        return res.json({ locations, fromCache: true, warning: msg });
      }
      // DB vide + quota dépassé → retourner 200 avec flag pour que le frontend reste utilisable
      if (isQuota) {
        return res.json({ locations: [], fromCache: false, quotaExceeded: true, error: msg });
      }
      return res.status(502).json({ error: msg, googleError: accountsData?.error ?? null });
    }

    const accounts = accountsData.accounts ?? [];
    const freshLocations = [];
    for (const account of accounts.slice(0, 5)) {
      const locResp = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress,metadata,regularHours`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const locData = await locResp.json();
      if (!locResp.ok) {
        console.error("[getLocations] locations API error for", account.name, locData);
        continue;
      }
      for (const loc of locData.locations ?? []) {
        freshLocations.push({
          locationId:   loc.name,
          locationName: loc.title ?? loc.name,
          address:      loc.storefrontAddress?.addressLines?.join(", ") ?? null,
        });
      }
    }

    const connectedMap = new Map(dbLocs.map((l) => [l.locationId, l]));

    const merged = freshLocations.map((l) => {
      const db = connectedMap.get(l.locationId);
      return {
        id:         l.locationId,
        locationId: l.locationId,
        name:       l.locationName,
        address:    l.address ?? "",
        rating:     db?.rating ?? null,
        reviews:    db?.reviewCount ?? 0,
        connected:  db?.connected ?? false,
        primary:    db?.primary ?? false,
      };
    });

    // Upsert en DB
    for (const loc of merged) {
      await prisma.googleBusinessLocation.upsert({
        where:  { companyId_locationId: { companyId, locationId: loc.locationId } },
        create: { companyId, connectionId: null, locationId: loc.locationId, locationName: loc.name, address: loc.address },
        update: { locationName: loc.name, address: loc.address },
      });
    }

    res.json({ locations: merged, fromCache: false });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch locations: " + err.message });
  }
}

// POST /api/admin/google/locations/connect
export async function connectLocations(req, res) {
  const companyId = req.user.companyId;
  const { locationIds } = req.body;
  if (!Array.isArray(locationIds)) return res.status(400).json({ error: "locationIds must be array" });

  try {
    await prisma.googleBusinessLocation.updateMany({
      where: { companyId },
      data: { connected: false, primary: false },
    });

    if (locationIds.length > 0) {
      await prisma.googleBusinessLocation.updateMany({
        where: { companyId, locationId: { in: locationIds } },
        data: { connected: true },
      });
      // Mark first as primary
      await prisma.googleBusinessLocation.updateMany({
        where: { companyId, locationId: locationIds[0] },
        data: { primary: true },
      });
    }

    res.json({ ok: true, connected: locationIds.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to update locations: " + err.message });
  }
}
