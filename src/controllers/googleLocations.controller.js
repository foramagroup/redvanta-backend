import prisma from "../config/database.js";

// Helper: get a valid access token (refresh if needed)
export async function getValidToken(companyId) {
  const conn = await prisma.googleConnection.findUnique({ where: { companyId } });
  if (!conn) throw new Error("No Google connection");

  const needsRefresh = !conn.expiresAt || conn.expiresAt < new Date(Date.now() + 60_000);
  if (!needsRefresh) return conn.accessToken;
  if (!conn.refreshToken) {
    await prisma.googleConnection.update({ where: { companyId }, data: { needsReauth: true } });
    throw new Error("Token expired and no refresh token — reauth required");
  }

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: conn.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const tokens = await resp.json();
  if (!tokens.access_token) throw new Error("Refresh failed: " + (tokens.error ?? "unknown"));

  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);
  await prisma.googleConnection.update({
    where: { companyId },
    data: { accessToken: tokens.access_token, expiresAt, needsReauth: false },
  });
  return tokens.access_token;
}

// GET /api/admin/google/locations
export async function getLocations(req, res) {
  const companyId = req.user.companyId;
  try {
    let token;
    try { token = await getValidToken(companyId); } catch (e) {
      return res.status(401).json({ error: e.message });
    }

    // Fetch accounts then locations from GBP API
    const accountsResp = await fetch(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const accountsData = await accountsResp.json();
    const accounts = accountsData.accounts ?? [];

    const locations = [];
    for (const account of accounts.slice(0, 3)) {
      const locResp = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress,metadata,regularHours`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const locData = await locResp.json();
      for (const loc of locData.locations ?? []) {
        locations.push({
          locationId: loc.name,
          locationName: loc.title ?? loc.name,
          address: loc.storefrontAddress?.addressLines?.join(", ") ?? null,
          rating: loc.metadata?.mapsUri ? null : null,
        });
      }
    }

    // Merge with DB connected state
    const dbLocs = await prisma.googleBusinessLocation.findMany({ where: { companyId } });
    const connectedSet = new Set(dbLocs.filter((l) => l.connected).map((l) => l.locationId));

    const merged = locations.map((l) => ({ id: l.locationId, ...l, connected: connectedSet.has(l.locationId) }));

    // Upsert discovered locations into DB
    for (const loc of merged) {
      await prisma.googleBusinessLocation.upsert({
        where: { companyId_locationId: { companyId, locationId: loc.locationId } },
        create: { companyId, connectionId: null, ...loc },
        update: { locationName: loc.locationName, address: loc.address },
      });
    }

    res.json({ locations: merged });
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
