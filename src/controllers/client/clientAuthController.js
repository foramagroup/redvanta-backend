
import prisma  from "../../config/database.js";
import bcrypt  from "bcryptjs";
import crypto  from "crypto";
import {
  generateToken,
  getCookieOptions,
  blacklistToken,
} from "../../services/token.service.js";
import { sendMail }                   from "../../services/client/mail.service.js";
import { buildConfirmEmailTemplate }  from "../../templates/client/confirmEmail.template.js";
import { loadUserByEmail, loadUserForAuth, formatAdmin } from "../../services/superadmin/auth.service.js";


const SALT_ROUNDS = 12;
const VERIFY_HOURS = 48; // délai avant suspension

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function hashVerifyToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getFrontendBase() {
  return  process.env.URL_PROD_FRONTEND
    ||  process.env.FRONT_URL
    || process.env.URL_DEV_FRONTEND
    || "http://localhost:3000";
}

function redirectVerifyResult(res, status, message, target = "/verify-email") {
  const url = new URL(target, getFrontendBase());
  url.searchParams.set("status", status);
  url.searchParams.set("message", message);
  return res.redirect(url.toString());
}

function getIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
    || req.socket?.remoteAddress || "unknown";
}

async function logActivity(userId, name, ip, userAgent, status) {
  await prisma.loginActivity.create({
    data: { userId: userId ?? null, admin_name: name ?? null, ip, userAgent: userAgent ?? null, status },
  }).catch(console.error);
}

// Générer un token de vérification email
function generateVerifyToken() {
  return crypto.randomBytes(32).toString("hex");
}

// Trouver le plan trial par défaut
async function getDefaultPlan() {
  return prisma.planSetting.findFirst({
    where: {
      OR: [
        { name: { contains: "Trial"} },
        { name: { contains: "free" } },
        { price: 0 },
      ],
      status: "Active",
    },
    orderBy: { id: "asc" },
  });
}

// Trouver le rôle "admin"
async function getAdminRole() {
  return prisma.role.findFirst({
    where: { name: { in: ["admin", "Admin", "ADMIN", "company_admin"] } },
  });
}

// Charger la langue par défaut du système
async function getDefaultLanguage() {
  return prisma.language.findFirst({
    where: { isDefault: true, status: "Active" },
    select: { id: true, code: true },
  });
}

// ─── POST /api/auth/signup ────────────────────────────────────
// Scénario complet :
//   1. Vérifier unicité email (user + company)
//   2. Créer le User (password hashé)
//   3. Créer la Company avec plan trial + CompanySettings
//   4. Créer le lien UserCompany (isOwner=true)
//   5. Connecter directement (cookie JWT)
//   6. Envoyer email de confirmation (lien 48h)
// POST /api/auth/signup

export const signup = async (req, res, next) => {
  const ip = getIp(req);
  const userAgent = req.headers["user-agent"] ?? null;

  try {
    const { name, password, companyName, phone, address } = req.validatedBody;
    const email = normalizeEmail(req.validatedBody.email);

    const [userExists, companyExists] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.company.findUnique({ where: { email } }),
    ]);

    if (userExists || companyExists) {
      return res.status(409).json({
        success: false,
        error: "Un compte existe deja avec cet email. Veuillez vous connecter.",
        code: "EMAIL_EXISTS",
      });
    }

    const [defaultPlan, adminRole, defaultLang] = await Promise.all([
      getDefaultPlan(),
      getAdminRole(),
      getDefaultLanguage(),
    ]);

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const verifyToken = generateVerifyToken();
    const verifyTokenHash = hashVerifyToken(verifyToken);
    const verifyExp = new Date(Date.now() + VERIFY_HOURS * 60 * 60 * 1000);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name: name || companyName,
          phone: phone || null,
          isAdmin: true,
          isSuperadmin: false,
          roleId: adminRole?.id ?? null,
          emailVerifyToken: verifyTokenHash,
          emailVerifyExp: verifyExp,
        },
      });

      const company = await tx.company.create({
        data: {
          name: companyName,
          email,
          phone: phone || null,
          address: address || null,
          type: "direct",
          status: "active",
          planId: defaultPlan?.id ?? null,
          defaultLanguageId: defaultLang?.id ?? null,
          billingAmount: defaultPlan ? `$${defaultPlan.price}` : "$0",
          mrr: 0,
        },
      });

      await tx.companySettings.create({
        data: {
          companyId: company.id,
          timezone: "UTC",
          currency: "USD",
          notificationEmail: true,
          maxLocations: defaultPlan?.locationLimit ?? 1,
          maxApiCalls: parseInt(defaultPlan?.apiLimit ?? "1000") || 1000,
          maxSmsCalls: parseInt(defaultPlan?.smsLimit ?? "100") || 100,
          allowCustomColor: false,
        },
      });

      await tx.userCompany.create({
        data: {
          userId: user.id,
          companyId: company.id,
          roleId: adminRole?.id ?? null,
          isOwner: true,
        },
      });

      return { user, company };
    });

    await logActivity(result.user.id, result.user.name, ip, userAgent, "signup");

    const backendBase = process.env.URL_DEV_BACKEND ||  "http://localhost:4000";
    const confirmUrl = `${backendBase}/api/client/auth/verify-email?token=${verifyToken}&redirect=1`;
    const emailPayload = buildConfirmEmailTemplate({
      name: companyName,
      companyName,
      confirmUrl,
      expiresHours: VERIFY_HOURS,
    });

    sendMail({ to: email, ...emailPayload }).catch((err) => {
      console.error(`[signup] Email confirmation error -> ${email}:`, err.message);
    });

    const fullUser = await loadUserForAuth(result.user.id, "admin");

    return res.status(201).json({
      success: true,
      message: "Compte cree. Verifiez votre email avant d'acceder au dashboard.",
      emailVerified: false,
      verifyDeadline: verifyExp,
      user: formatAdmin(fullUser, result.company.id),
    });
  } catch (e) {
    if (e.code === "P2002") {
      return res.status(409).json({ success: false, error: "Email deja utilise", code: "EMAIL_EXISTS" });
    }
    next(e);
  }
};

// POST /api/auth/login
export const login = async (req, res, next) => {
  const ip = getIp(req);
  const userAgent = req.headers["user-agent"] ?? null;

  try {
    const { password } = req.validatedBody;
    const email = normalizeEmail(req.validatedBody.email);
    const user = await loadUserByEmail(email, "admin");

    if (!user || !user.isAdmin) {
      await logActivity(null, email, ip, userAgent, "failed");
      return res.status(401).json({ success: false, error: "Email ou mot de passe incorrect", code: "INVALID_CREDENTIALS" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      await logActivity(user.id, user.name, ip, userAgent, "failed");
      return res.status(401).json({ success: false, error: "Email ou mot de passe incorrect", code: "INVALID_CREDENTIALS" });
    }

    const activeLinks = user.companies?.filter((uc) => ["active", "trial"].includes(uc.company?.status)) ?? [];
    const defaultLink = user.companies?.find((uc) => uc.isOwner && ["active", "trial"].includes(uc.company?.status)) ?? activeLinks[0] ?? user.companies?.[0];

    if (!defaultLink) {
      await logActivity(user.id, user.name, ip, userAgent, "failed");
      return res.status(403).json({ success: false, error: "Aucune entreprise associee a ce compte.", code: "NO_COMPANY" });
    }

    const emailVerified = !!user.emailVerifiedAt;
    if (!emailVerified) {
      await logActivity(user.id, user.name, ip, userAgent, "failed");
      return res.status(403).json({
        success: false,
        error: "Veuillez confirmer votre email avant de vous connecter.",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      isAdmin: true,
      isSuperadmin: false,
      companyId: defaultLink.company.id,
      emailVerified: true,
    });

    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
    await logActivity(user.id, user.name, ip, userAgent, "success");

    res.cookie("admin_token", token, getCookieOptions("admin_token"));

    const fullUser = await loadUserForAuth(user.id, "admin");

    return res.json({
      success: true,
      message: "Connexion reussie",
      emailVerified: true,
      user: formatAdmin(fullUser, defaultLink.company.id),
    });
  } catch (e) {
    await logActivity(null, req.body?.email, ip, userAgent, "failed");
    next(e);
  }
};

// GET /api/auth/verify-email?token=xxx
export const verifyEmail = async (req, res, next) => {
  try {
    const rawToken = typeof req.query.token === "string" ? req.query.token.trim() : "";
    const shouldRedirect = req.query.redirect === "1";

    if (!rawToken) {
      if (shouldRedirect) {
        return redirectVerifyResult(res, "error", "Token manquant");
      }
      return res.status(400).json({ success: false, error: "Token manquant", code: "MISSING_TOKEN" });
    }

    const tokenHash = hashVerifyToken(rawToken);
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { emailVerifyToken: tokenHash },
          { emailVerifyToken: rawToken },
        ],
      },
    });
    if (!user) {
      if (shouldRedirect) {
        return redirectVerifyResult(res, "error", "Lien invalide ou deja utilise");
      }
      return res.status(400).json({ success: false, error: "Lien invalide ou deja utilise", code: "INVALID_TOKEN" });
    }

    if (user.emailVerifyExp && user.emailVerifyExp < new Date()) {
      if (shouldRedirect) {
        return redirectVerifyResult(res, "error", "Ce lien a expire. Demandez un nouveau lien de confirmation.");
      }
      return res.status(400).json({
        success: false,
        error: "Ce lien a expire. Demandez un nouveau lien de confirmation.",
        code: "TOKEN_EXPIRED",
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerifyToken: null,
        emailVerifyExp: null,
      },
    });

    const companyLink = await prisma.userCompany.findFirst({
      where: {
        userId: user.id,
        company: { status: { in: ["active", "trial"] } },
      },
      include: { company: true },
      orderBy: { isOwner: "desc" },
    });

    if (!companyLink) {
      if (shouldRedirect) {
        return redirectVerifyResult(res, "error", "Aucune entreprise active associee a ce compte.");
      }
      return res.status(403).json({ success: false, error: "Aucune entreprise active associee a ce compte.", code: "NO_COMPANY" });
    }

    const authToken = generateToken({
      userId: user.id,
      email: user.email,
      isAdmin: true,
      isSuperadmin: false,
      companyId: companyLink.companyId,
      emailVerified: true,
    });

    res.cookie("admin_token", authToken, getCookieOptions("admin_token"));
    await logActivity(user.id, user.name, getIp(req), req.headers["user-agent"], "email_verified");

    if (shouldRedirect) {
      return res.redirect(new URL("/dashboard", getFrontendBase()).toString());
    }

    return res.json({
      success: true,
      message: "Email confirme avec succes. Vous etes maintenant connecte.",
    });
  } catch (e) {
    next(e);
  }
};

// POST /api/auth/resend-verification
export const resendVerification = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email || req.user?.email);
    if (!email) return res.status(422).json({ success: false, error: "Email requis" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.json({
        success: true,
        message: "Si un compte correspondant existe, un email de confirmation sera envoye.",
      });
    }
    if (user.emailVerifiedAt) {
      return res.json({
        success: true,
        message: "Si un compte correspondant existe, un email de confirmation sera envoye.",
      });
    }

    const verifyToken = generateVerifyToken();
    const verifyTokenHash = hashVerifyToken(verifyToken);
    const verifyExp = new Date(Date.now() + VERIFY_HOURS * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken: verifyTokenHash, emailVerifyExp: verifyExp },
    });

    const companyLink = await prisma.userCompany.findFirst({
      where: { userId: user.id, isOwner: true },
      include: { company: true },
    });

    const backendBase = process.env.URL_DEV_BACKEND || process.env.URL_PROD_BACKEND || "http://localhost:4000";
    const confirmUrl = `${backendBase}/api/client/auth/verify-email?token=${verifyToken}&redirect=1`;
    const emailPayload = buildConfirmEmailTemplate({
      name: user.name || email,
      companyName: companyLink?.company?.name || "votre entreprise",
      confirmUrl,
      expiresHours: VERIFY_HOURS,
    });

    await sendMail({ to: email, ...emailPayload });

    return res.json({
      success: true,
      message: `Email de confirmation renvoye a ${email}`,
    });
  } catch (e) {
    next(e);
  }
};
// ─── GET /api/auth/me ─────────────────────────────────────────
export const me = async (req, res, next) => {
  try {
    const user = await loadUserForAuth(req.user.userId, "admin");
    if (!user) return res.status(404).json({ success: false, error: "Utilisateur introuvable" });
    return res.json({
      success:       true,
      emailVerified: !!user.emailVerifiedAt,
      user:          formatAdmin(user, req.user.companyId),
    });
  } catch (e) { next(e); }
};

// ─── POST /api/auth/switch-company ───────────────────────────
export const switchCompany = async (req, res, next) => {
  try {
    const { companyId } = req.body;
    if (!companyId) return res.status(422).json({ success: false, error: "companyId requis" });

    const link = await prisma.userCompany.findUnique({
      where:   { userId_companyId: { userId: req.user.userId, companyId: parseInt(companyId) } },
      include: { company: true },
    });

    if (!link) return res.status(403).json({ success: false, error: "Accès refusé à cette entreprise" });
    if (!["active", "trial"].includes(link.company.status)) {
      return res.status(403).json({ success: false, error: "Cette entreprise est suspendue" });
    }

    if (req.token) await blacklistToken(req.token);

    const newToken = generateToken({
      userId:        req.user.userId,
      email:         req.user.email,
      isAdmin:       true,
      isSuperadmin:  false,
      companyId:     parseInt(companyId),
      emailVerified: !!req.user.emailVerified,
    });

    res.cookie("admin_token", newToken, getCookieOptions("admin_token"));

    return res.json({
      success:       true,
      message:       `Basculé vers "${link.company.name}"`,
      activeCompany: { id: link.company.id, name: link.company.name, status: link.company.status },
    });
  } catch (e) { next(e); }
};

// ─── POST /api/auth/logout ────────────────────────────────────
export const logout = async (req, res, next) => {
  try {
    if (req.token) await blacklistToken(req.token);
    if (req.user?.userId) {
      await logActivity(req.user.userId, null, getIp(req), req.headers["user-agent"], "logout");
    }
    res.clearCookie("admin_token", getCookieOptions("admin_token"));
    return res.json({ success: true, message: "Déconnecté avec succès" });
  } catch (e) { next(e); }
};









