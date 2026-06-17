import prisma from "../config/database.js";
import jwt from "jsonwebtoken";
import { encrypt, decrypt } from "../utils/tokenEncryption.js";

const SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

export async function getGoogleCredentials() {
  const ps = await prisma.platformSetting.findFirst({
    select: { googleClientId: true, googleClientSecret: true, googleRedirectUri: true },
  });
  const clientId     = ps?.googleClientId     || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = ps?.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri  = ps?.googleRedirectUri  || process.env.GOOGLE_REDIRECT_URI
    || `${process.env.URL_DEV_BACKEND || "http://localhost:4000/api"}/admin/google/callback`;

  if (!clientId || !clientSecret) {
    throw Object.assign(new Error("Google OAuth credentials not configured. Ask your superadmin to set them in Platform Settings."), { status: 503 });
  }
  return { clientId, clientSecret, redirectUri };
}

// GET /api/admin/google/auth-url
export async function getAuthUrl(req, res) {
  try {
    const companyId = req.user.companyId;
    const { clientId, redirectUri } = await getGoogleCredentials();
    const state = jwt.sign({ companyId }, process.env.JWT_SECRET, { expiresIn: "10m" });
    const params = new URLSearchParams({
      client_id:     clientId,
      redirect_uri:  redirectUri,
      response_type: "code",
      scope:         SCOPES,
      access_type:   "offline",
      prompt:        "consent",
      state,
    });
    res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to generate auth URL" });
  }
}

// GET /api/admin/google/callback  (public — called by Google redirect)
export async function handleCallback(req, res) {
  const { code, state, error } = req.query;

  const closeWithError = (msg) => res.send(`
    <script>
      window.opener?.postMessage({ type: "GOOGLE_ERROR", message: ${JSON.stringify(msg)} }, "*");
      window.close();
    </script>
  `);

  if (error) return closeWithError(error);
  if (!code || !state) return closeWithError("Missing code or state");

  let companyId;
  try {
    ({ companyId } = jwt.verify(state, process.env.JWT_SECRET));
  } catch {
    return closeWithError("Invalid or expired state");
  }

  // Exchange code for tokens
  let tokens;
  try {
    const { clientId, clientSecret, redirectUri } = await getGoogleCredentials();
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    tokens = await resp.json();
    if (!tokens.access_token) throw new Error(tokens.error ?? "No access_token");
  } catch (err) {
    return closeWithError("Token exchange failed: " + err.message);
  }

  // Fetch Google account info
  let email = null, googleAccountId = null;
  try {
    const info = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    }).then((r) => r.json());
    email = info.email;
    googleAccountId = info.id;
  } catch {
    // non-fatal
  }

  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : new Date(Date.now() + 3600 * 1000);

  await prisma.googleConnection.upsert({
    where: { companyId },
    create: {
      companyId,
      googleAccountId,
      email,
      accessToken:  encrypt(tokens.access_token),
      refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      expiresAt,
      needsReauth: false,
    },
    update: {
      googleAccountId,
      email,
      accessToken:  encrypt(tokens.access_token),
      // Ne mettre à jour le refreshToken que si Google en envoie un nouveau
      ...(tokens.refresh_token ? { refreshToken: encrypt(tokens.refresh_token) } : {}),
      expiresAt,
      needsReauth: false,
    },
  });

  res.send(`
    <script>
      window.opener?.postMessage({ type: "GOOGLE_CONNECTED", email: ${JSON.stringify(email)} }, "*");
      window.close();
    </script>
  `);
}

// GET /api/admin/google/status
export async function getStatus(req, res) {
  try {
    const companyId = req.user.companyId;
    const conn = await prisma.googleConnection.findUnique({ where: { companyId } });
    if (!conn) return res.json({ connected: false });

    const needsRefresh = conn.expiresAt && conn.expiresAt < new Date(Date.now() + 60_000);
    res.json({
      connected: true,
      email: conn.email,
      googleAccountId: conn.googleAccountId,
      needsReauth: conn.needsReauth || (!conn.refreshToken && needsRefresh),
      reviewsSynced: conn.reviewsSynced,
      averageRating: conn.averageRating,
      lastSyncAt: conn.lastSyncAt,
      expiresAt: conn.expiresAt,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch Google status" });
  }
}

// DELETE /api/admin/google/disconnect
export async function disconnect(req, res) {
  try {
    const companyId = req.user.companyId;
    const conn = await prisma.googleConnection.findUnique({ where: { companyId } });
    if (conn?.accessToken) {
      const plainToken = decrypt(conn.accessToken);
      fetch(`https://oauth2.googleapis.com/revoke?token=${plainToken}`, { method: "POST" }).catch(() => {});
    }
    await prisma.googleConnection.deleteMany({ where: { companyId } });
    await prisma.googleBusinessLocation.deleteMany({ where: { companyId } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to disconnect" });
  }
}
