
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
export const signup = async (req, res, next) => {
  const ip        = getIp(req);
  const userAgent = req.headers["user-agent"] ?? null;

  try {
    const { email, password, companyName, phone, address } = req.validatedBody;

    // 1. Vérifier unicité
    const [userExists, companyExists] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.company.findUnique({ where: { email } }),
    ]);

    if (userExists) {
      return res.status(409).json({
        success: false,
        error:   "Un compte existe déjà avec cet email. Veuillez vous connecter.",
        code:    "EMAIL_EXISTS",
      });
    }

    // 2. Charger les données de référence en parallèle
    const [defaultPlan, adminRole, defaultLang] = await Promise.all([
      getDefaultPlan(),
      getAdminRole(),
      getDefaultLanguage(),
    ]);

    // 3. Préparer les tokens
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const verifyToken    = generateVerifyToken();
    const verifyExp      = new Date(Date.now() + VERIFY_HOURS * 60 * 60 * 1000);

    // 4. Transaction : User + Company + CompanySettings + UserCompany
    const result = await prisma.$transaction(async (tx) => {
      // Créer le User admin
      const user = await tx.user.create({
        data: {
          email,
          password:         hashedPassword,
          name:             companyName, // nom = nom de la company par défaut
          phone:            phone || null,
          isAdmin:          true,
          isSuperadmin:     false,
          roleId:           adminRole?.id ?? null,
          emailVerifyToken: verifyToken,
          emailVerifyExp:   verifyExp,
          // emailVerifiedAt = null → pas encore confirmé
        },
      });

      // Créer la Company avec status "active" (mais compte non confirmé)
      // La suspension se fait automatiquement après 48h si non confirmé
      const company = await tx.company.create({
        data: {
          name:              companyName,
          email,                              // email de la company = email du user
          phone:             phone   || null,
          address:           address || null,
          type:              "direct",
          status:            "active",        // actif dès le début, suspendu si non confirmé
          planId:            defaultPlan?.id  ?? null,
          defaultLanguageId: defaultLang?.id  ?? null,
          billingAmount:     defaultPlan ? `$${defaultPlan.price}` : "$0",
          mrr:               0,
        },
      });

      // Créer CompanySettings par défaut
      await tx.companySettings.create({
        data: {
          companyId:         company.id,
          timezone:          "UTC",
          currency:          "USD",
          notificationEmail: true,
          maxLocations:      defaultPlan?.locationLimit ?? 1,
          maxApiCalls:       parseInt(defaultPlan?.apiLimit  ?? "1000") || 1000,
          maxSmsCalls:       parseInt(defaultPlan?.smsLimit  ?? "100")  || 100,
          allowCustomColor:  false,
        },
      });

      // Créer le lien UserCompany (isOwner=true)
      await tx.userCompany.create({
        data: {
          userId:    user.id,
          companyId: company.id,
          roleId:    adminRole?.id ?? null,
          isOwner:   true,
        },
      });

      return { user, company };
    });

    // 5. Logger la création de compte
    await logActivity(result.user.id, result.user.name, ip, userAgent, "signup");

    // 6. Générer le JWT et connecter directement
    const token = generateToken({
      userId:       result.user.id,
      email:        result.user.email,
      isAdmin:      true,
      isSuperadmin: false,
      companyId:    result.company.id,
      emailVerified: false,  // flag utile côté frontend
    });

    // Cookie HttpOnly
    res.cookie("admin_token", token, getCookieOptions("admin_token"));

    // 7. Envoyer email de confirmation (asynchrone — ne bloque pas)
    const confirmUrl = `${process.env.FRONT_URL}/verify-email?token=${verifyToken}`;
    const emailPayload = buildConfirmEmailTemplate({
      name:        companyName,
      companyName,
      confirmUrl,
      expiresHours: VERIFY_HOURS,
    });

    sendMail({ to: email, ...emailPayload }).catch((err) => {
      console.error(`[signup] Échec email confirmation → ${email}:`, err.message);
    });

    // 8. Charger le user complet pour la réponse
    const fullUser = await loadUserForAuth(result.user.id, "admin");

    return res.status(201).json({
      success: true,
      message: "Compte créé. Un email de confirmation a été envoyé à votre adresse.",
      emailVerified:    false,
      verifyDeadline:   verifyExp,           // deadline affichable côté frontend
      user:             formatAdmin(fullUser),
    });
  } catch (e) {
    if (e.code === "P2002") {
      return res.status(409).json({ success: false, error: "Email déjà utilisé", code: "EMAIL_EXISTS" });
    }
    next(e);
  }
};

// ─── POST /api/auth/login ─────────────────────────────────────
// Connecter un admin existant
export const login = async (req, res, next) => {
  const ip        = getIp(req);
  const userAgent = req.headers["user-agent"] ?? null;

  try {
    const { email, password } = req.validatedBody;

    // Charger le user avec toutes ses companies
    const user = await loadUserByEmail(email, "admin");

    if (!user || !user.isAdmin) {
      await logActivity(null, email, ip, userAgent, "failed");
      return res.status(401).json({ success: false, error: "Email ou mot de passe incorrect", code: "INVALID_CREDENTIALS" });
    }

    // Vérifier le mot de passe
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      await logActivity(user.id, user.name, ip, userAgent, "failed");
      return res.status(401).json({ success: false, error: "Email ou mot de passe incorrect", code: "INVALID_CREDENTIALS" });
    }

    // Vérifier qu'il a au moins une company
    const activeLinks = user.companies?.filter(
      (uc) => ["active", "trial"].includes(uc.company?.status)
    ) ?? [];

    // Company par défaut = owner + active
    const defaultLink = user.companies?.find(
      (uc) => uc.isOwner && ["active", "trial"].includes(uc.company?.status)
    ) ?? activeLinks[0] ?? user.companies?.[0];

    if (!defaultLink) {
      await logActivity(user.id, user.name, ip, userAgent, "failed");
      return res.status(403).json({
        success: false,
        error:   "Aucune entreprise associée à ce compte.",
        code:    "NO_COMPANY",
      });
    }

    // Avertir si l'email n'est pas encore confirmé (mais autoriser la connexion)
    const emailVerified = !!user.emailVerifiedAt;

    // Générer le token
    const token = generateToken({
      userId:        user.id,
      email:         user.email,
      isAdmin:       true,
      isSuperadmin:  false,
      companyId:     defaultLink.company.id,
      emailVerified,
    });

    // Mettre à jour lastLogin
    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

    // Logger
    await logActivity(user.id, user.name, ip, userAgent, "success");

    // Cookie
    res.cookie("admin_token", token, getCookieOptions("admin_token"));

    const fullUser = await loadUserForAuth(user.id, "admin");

    return res.json({
      success:       true,
      message:       "Connexion réussie",
      emailVerified,
      // Avertissement si email non confirmé
      ...(!emailVerified && {
        warning: "Votre email n'est pas encore confirmé. Vérifiez votre boîte mail.",
      }),
      user: formatAdmin(fullUser),
    });
  } catch (e) {
    await logActivity(null, req.body?.email, ip, userAgent, "failed");
    next(e);
  }
};

// ─── GET /api/auth/verify-email?token=xxx ────────────────────
// Confirmer l'email via le lien reçu par mail
export const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ success: false, error: "Token manquant", code: "MISSING_TOKEN" });
    }

    // Chercher le user avec ce token
    const user = await prisma.user.findUnique({
      where: { emailVerifyToken: token },
    });

    if (!user) {
      return res.status(400).json({ success: false, error: "Lien invalide ou déjà utilisé", code: "INVALID_TOKEN" });
    }

    // Vérifier l'expiration
    if (user.emailVerifyExp && user.emailVerifyExp < new Date()) {
      return res.status(400).json({
        success: false,
        error:   "Ce lien a expiré. Demandez un nouveau lien de confirmation.",
        code:    "TOKEN_EXPIRED",
      });
    }

    // Marquer l'email comme vérifié + nettoyer le token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt:  new Date(),
        emailVerifyToken: null,
        emailVerifyExp:   null,
      },
    });

    // Logger
    await logActivity(user.id, user.name, getIp(req), req.headers["user-agent"], "email_verified");

    return res.json({
      success: true,
      message: "Email confirmé avec succès ! Vous pouvez accéder à votre espace.",
    });
  } catch (e) { next(e); }
};

// ─── POST /api/auth/resend-verification ──────────────────────
// Renvoyer l'email de confirmation (si le premier a expiré)
export const resendVerification = async (req, res, next) => {
  try {
    const email = req.body?.email || req.user?.email;
    if (!email) return res.status(422).json({ success: false, error: "Email requis" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ success: false, error: "Utilisateur introuvable" });
    if (user.emailVerifiedAt) {
      return res.status(400).json({ success: false, error: "Cet email est déjà confirmé" });
    }

    const verifyToken = generateVerifyToken();
    const verifyExp   = new Date(Date.now() + VERIFY_HOURS * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data:  { emailVerifyToken: verifyToken, emailVerifyExp: verifyExp },
    });
    const companyLink = await prisma.userCompany.findFirst({
      where: { userId: user.id, isOwner: true },
      include: { company: true },
    });

    const confirmUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verifyToken}`;
    const emailPayload = buildConfirmEmailTemplate({
      name:         user.name || email,
      companyName:  companyLink?.company?.name || "votre entreprise",
      confirmUrl,
      expiresHours: VERIFY_HOURS,
    });

    await sendMail({ to: email, ...emailPayload });

    return res.json({
      success: true,
      message: `Email de confirmation renvoyé à ${email}`,
    });
  } catch (e) { next(e); }
};

// ─── GET /api/auth/me ─────────────────────────────────────────
export const me = async (req, res, next) => {
  try {
    const user = await loadUserForAuth(req.user.userId, "admin");
    if (!user) return res.status(404).json({ success: false, error: "Utilisateur introuvable" });
    return res.json({
      success:       true,
      emailVerified: !!user.emailVerifiedAt,
      user:          formatAdmin(user),
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
    res.clearCookie("admin_token", { path: "/" });
    return res.json({ success: true, message: "Déconnecté avec succès" });
  } catch (e) { next(e); }
};