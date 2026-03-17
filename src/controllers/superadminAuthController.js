import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET || "change_me";
const TOKEN_EXP = "7d";
const SUPERADMIN_ROLES = new Set(["admin", "owner", "superadmin"]);

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderLoginPage(errorMessage = "") {
  const safeError = escapeHtml(errorMessage);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Superadmin Login</title>
  <style>
    :root {
      --bg: #0a0a0a;
      --card: rgba(20, 20, 20, 0.9);
      --border: rgba(255, 255, 255, 0.14);
      --text: #f3f3f3;
      --muted: #a1a1aa;
      --primary: #ef4444;
      --primary-foreground: #ffffff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
      background:
        radial-gradient(1200px 600px at -10% -20%, rgba(239, 68, 68, 0.18), transparent 55%),
        radial-gradient(900px 500px at 120% 120%, rgba(239, 68, 68, 0.14), transparent 55%),
        linear-gradient(180deg, #09090b 0%, #111114 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .container { width: 100%; max-width: 420px; }
    .fade-up {
      animation: fadeUp .45s ease both;
    }
    .fade-up.d1 { animation-delay: .08s; }
    .fade-up.d2 { animation-delay: .16s; }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .brand {
      text-align: center;
      font-weight: 700;
      letter-spacing: .2px;
      text-decoration: none;
      color: var(--text);
      display: inline-block;
      font-size: 30px;
    }
    .brand-wrap { text-align: center; }
    .brand-accent {
      background: linear-gradient(90deg, #ff6b6b, #ef4444);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    h1 {
      margin: 18px 0 8px;
      font-size: 28px;
      text-align: center;
      line-height: 1.2;
    }
    .subtitle {
      margin: 0;
      text-align: center;
      color: var(--muted);
      font-size: 14px;
    }
    .card {
      margin-top: 28px;
      border: 1px solid var(--border);
      background: linear-gradient(180deg, rgba(25,25,28,.96), rgba(17,17,20,.96));
      border-radius: 14px;
      padding: 28px;
      box-shadow: 0 22px 54px rgba(0,0,0,.35);
    }
    .field { margin-bottom: 14px; }
    .label {
      display: block;
      font-size: 14px;
      color: var(--muted);
      margin-bottom: 8px;
      font-weight: 600;
    }
    .input {
      width: 100%;
      border: 1px solid var(--border);
      background: rgba(10,10,10,.6);
      color: var(--text);
      border-radius: 10px;
      padding: 11px 12px;
      font-size: 14px;
      outline: none;
    }
    .input:focus {
      border-color: rgba(239,68,68,.65);
      box-shadow: 0 0 0 3px rgba(239,68,68,.2);
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 8px 0 16px;
      gap: 12px;
    }
    .remember {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--muted);
      font-size: 14px;
    }
    .remember input { accent-color: var(--primary); }
    .link {
      color: var(--primary);
      font-size: 14px;
      text-decoration: none;
    }
    .link:hover { text-decoration: underline; }
    .btn {
      width: 100%;
      border: 0;
      border-radius: 10px;
      padding: 12px 14px;
      font-size: 14px;
      font-weight: 700;
      color: var(--primary-foreground);
      background: var(--primary);
      cursor: pointer;
      box-shadow: 0 0 0 0 rgba(239,68,68,.45);
      transition: transform .12s ease, filter .12s ease, box-shadow .12s ease;
    }
    .btn:hover { filter: brightness(1.05); box-shadow: 0 0 18px rgba(239,68,68,.28); }
    .btn:active { transform: translateY(1px); }
    .error {
      background: rgba(239,68,68,.14);
      border: 1px solid rgba(239,68,68,.42);
      color: #fecaca;
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 14px;
      font-size: 13px;
    }
    .footer {
      margin-top: 18px;
      text-align: center;
      color: var(--muted);
      font-size: 14px;
    }
    @media (max-width: 480px) {
      .card { padding: 20px; }
      h1 { font-size: 24px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="fade-up">
      <div class="brand-wrap">
        <a class="brand" href="/">RED<span class="brand-accent">VANTA</span></a>
      </div>
      <h1>Welcome back</h1>
      <p class="subtitle">Log in to your Reputation Command Center</p>
    </div>

    <div class="card fade-up d1">
      ${safeError ? `<div class="error">${safeError}</div>` : ""}
      <form method="post" action="/superadmin/login">
        <div class="field">
          <label class="label" for="email">Email</label>
          <input class="input" id="email" name="email" type="email" placeholder="you@company.com" required />
        </div>
        <div class="field">
          <label class="label" for="password">Password</label>
          <input class="input" id="password" name="password" type="password" placeholder="••••••••" required />
        </div>
        <div class="row">
          <label class="remember">
            <input type="checkbox" name="remember" />
            Remember me
          </label>
          <a class="link" href="#">Forgot password?</a>
        </div>
        <button class="btn" type="submit">Log In</button>
      </form>
    </div>

    <p class="footer fade-up d2">
      Don't have an account?
      <a class="link" href="/signup">Start Free Trial</a>
    </p>
  </div>
</body>
</html>`;
}

function getTokenFromReq(req) {
  return req.cookies?.superadmin_token || req.cookies?.token || req.headers?.authorization?.split(" ")[1];
}

export function loginPage(req, res) {
  res.status(200).type("html").send(renderLoginPage());
}

export async function loginSubmit(req, res) {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).type("html").send(renderLoginPage("Email and password are required."));
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).type("html").send(renderLoginPage("Invalid credentials."));
    }

    const ok = await bcrypt.compare(password, user.password || "");
    if (!ok) {
      return res.status(401).type("html").send(renderLoginPage("Invalid credentials."));
    }

    if (!SUPERADMIN_ROLES.has(String(user.role || "").toLowerCase())) {
      return res.status(403).type("html").send(renderLoginPage("Access denied: superadmin only."));
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email, scope: "superadmin" },
      JWT_SECRET,
      { expiresIn: TOKEN_EXP }
    );

    res.cookie("superadmin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 3600 * 1000,
      path: "/",
    });

    return res.redirect("/superadmin");
  } catch (err) {
    console.error("superadmin login error", err);
    return res.status(500).type("html").send(renderLoginPage("Internal error."));
  }
}

export async function dashboardPage(req, res) {
  try {
    const token = getTokenFromReq(req);
    if (!token) return res.redirect("/superadmin/login");

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.redirect("/superadmin/login");
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || !SUPERADMIN_ROLES.has(String(user.role || "").toLowerCase())) {
      return res.redirect("/superadmin/login");
    }

    return res.status(200).type("html").send(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Superadmin</title></head>
<body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#0b0b0f;color:#f3f3f3;padding:32px;">
  <h1>Superadmin Console</h1>
  <p>Signed in as <strong>${escapeHtml(user.email)}</strong> (${escapeHtml(String(user.role))})</p>
  <p><a href="/superadmin/logout" style="color:#ef4444;">Logout</a></p>
</body>
</html>`);
  } catch (err) {
    console.error("superadmin root error", err);
    return res.status(500).json({ error: "Internal error" });
  }
}

export function logout(req, res) {
  res.clearCookie("superadmin_token", { path: "/" });
  return res.redirect("/superadmin/login");
}
