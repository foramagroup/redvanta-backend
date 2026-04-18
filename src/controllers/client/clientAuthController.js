
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
import { createSubscriptionForCompany } from '../../helpers/subscription.helpers.js';
import { generateOtpCode, getOtpExpiration } from '../../helpers/otp.helpers.js';
import { buildVerificationCodeTemplate } from '../../templates/client/verificationCode.template.js';


const SALT_ROUNDS = 12;
const VERIFY_HOURS = 48;
const OTP_EXPIRATION_DAYS = 3;
const MAX_VERIFICATION_ATTEMPTS = 5;

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

    // Vérifier unicité
    const [userExists, companyExists] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.company.findFirst({ where: { email } }),
    ]);

    if (userExists || companyExists) {
        return res.status(409).json({
        success: false,
        error: "Un compte existe déjà avec cet email. Veuillez vous connecter.",
        code: "EMAIL_EXISTS",
        redirectTo: "/login", 
        message: "Connectez-vous puis ajoutez votre nouvelle entreprise"
      });
    }

    const [defaultPlan, adminRole, defaultLang] = await Promise.all([
      getDefaultPlan(),
      getAdminRole(),
      getDefaultLanguage(),
    ]);

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    
    // GÉNÉRER CODE OTP
    const verificationCode = generateOtpCode();
    const codeExpiration = getOtpExpiration(OTP_EXPIRATION_DAYS);

    const result = await prisma.$transaction(async (tx) => {

      // Créer l'utilisateur

      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name: name || companyName,
          phone: phone || null,
          isAdmin: true,
          isSuperadmin: false,
          roleId: adminRole?.id ?? null,
          emailVerifyCode: verificationCode,
          emailVerifyCodeExp: codeExpiration,
          emailVerifyAttempts: 0,
        },
      });

      // Créer la company
      const company = await tx.company.create({
        data: {
          name: companyName,
          email,
          phone: phone || null,
          address: address || null,
          type: "direct",
          status: "active", // Restera active jusqu'à suspension
          planId: defaultPlan?.id ?? null,
          defaultLanguageId: defaultLang?.id ?? null,
          billingAmount: defaultPlan ? `$${defaultPlan.price}` : "$0",
          mrr: 0,
        },
      });

      // Créer les settings
      await tx.companySettings.create({
        data: {
          companyId: company.id,
          timezone: "UTC",
          currency: "USD",
          notificationEmail: true,
          maxLocations: defaultPlan?.locationLimit ?? 1,
          maxApiCalls: parseInt(defaultPlan?.apiLimit ?? "1000") || 1000,
          maxSmsCalls: parseInt(defaultPlan?.smsLimit ?? "100") || 100,
          maxUser: parseInt(defaultPlan?.userLimit ?? "3") || 3,
          allowCustomColor: false,
        },
      });

      // Lien UserCompany
      await tx.userCompany.create({
        data: {
          userId: user.id,
          companyId: company.id,
          roleId: adminRole?.id ?? null,
          isOwner: true,
        },
      });

      // Créer la subscription (en trial)
      if (defaultPlan) {
        await createSubscriptionForCompany(tx, company.id, defaultPlan.id, {
          status: 'trialing',
          interval: 'monthly',
          trialDays: defaultPlan.trialDays || 14,
        });
      }

      return { user, company };
    });

    await logActivity(result.user.id, result.user.name, ip, userAgent, "signup");

    //  ENVOYER EMAIL AVEC CODE OTP
    const emailPayload = buildVerificationCodeTemplate({
      name: companyName,
      companyName,
      verificationCode,
      expiresHours: OTP_EXPIRATION_DAYS * 24,
    });

    sendMail({ to: email, ...emailPayload }).catch((err) => {
      console.error(`[signup] Email verification code error -> ${email}:`, err.message);
    });

    //  Il doit d'abord vérifier
    return res.status(201).json({
      success: true,
      message: "Compte créé avec succès. Un code de vérification a été envoyé à votre email.",
      emailVerified: false,
      codeExpiration: codeExpiration,
      email: email, // Pour redirection vers page de vérification
      requiresVerification: true,
    });
  } catch (e) {
    if (e.code === "P2002") {
      return res.status(409).json({ 
        success: false, 
        error: "Email déjà utilisé", 
        code: "EMAIL_EXISTS" 
      });
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

     if (user.accountSuspendedAt) {
      await logActivity(user.id, user.name, ip, userAgent, "failed_suspended");
      return res.status(403).json({
        success: false,
        error: "Votre compte a été suspendu. Veuillez contacter le support.",
        code: "ACCOUNT_SUSPENDED",
        suspendedAt: user.accountSuspendedAt,
        reason: user.suspensionReason
      });
    }

    const emailVerified = !!user.emailVerifiedAt;
    if (!emailVerified) {
      await logActivity(user.id, user.name, ip, userAgent, "failed_unverified");
      if (user.emailVerifyCodeExp && new Date() > new Date(user.emailVerifyCodeExp)) {
        // Suspendre le compte
        await prisma.user.update({
          where: { id: user.id },
          data: {
            accountSuspendedAt: new Date(),
            suspensionReason: "Code de vérification expiré"
          }
        });
        return res.status(403).json({
          success: false,
          error: "Votre code de vérification a expiré. Votre compte a été suspendu.",
          code: "CODE_EXPIRED_SUSPENDED"
        });
      }
      return res.status(403).json({
        success: false,
        error: "Veuillez vérifier votre email avant de vous connecter.",
        code: "EMAIL_NOT_VERIFIED",
        email: user.email,
        codeExpiration: user.emailVerifyCodeExp,
        requiresVerification: true
      });
    }

    const activeLinks = user.companies?.filter((uc) => ["active", "trial"].includes(uc.company?.status)) ?? [];
    const defaultLink = user.companies?.find((uc) => uc.isOwner && ["active", "trial"].includes(uc.company?.status)) ?? activeLinks[0] ?? user.companies?.[0];

    if (!defaultLink) {
      await logActivity(user.id, user.name, ip, userAgent, "failed");
      return res.status(403).json({ success: false, error: "Aucune entreprise associee a ce compte.", code: "NO_COMPANY" });
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


/**
 * POST /api/client/auth/verify-code
 * Vérifier le code OTP envoyé par email
 */
export const verifyCode = async (req, res, next) => {
  const ip = getIp(req);
  const userAgent = req.headers["user-agent"] ?? null;
  try {
    const { email, code } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!code || code.length !== 6) {
      return res.status(400).json({
        success: false,
        error: "Code invalide. Le code doit contenir 6 chiffres.",
        code: "INVALID_CODE_FORMAT"
      });
    }

    // Récupérer l'utilisateur
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        companies: {
          include: {
            company: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Utilisateur introuvable",
        code: "USER_NOT_FOUND"
      });
    }

    // Vérifier si le compte est suspendu
    if (user.accountSuspendedAt) {
      return res.status(403).json({
        success: false,
        error: "Votre compte a été suspendu. Veuillez contacter le support.",
        code: "ACCOUNT_SUSPENDED",
        suspendedAt: user.accountSuspendedAt,
        reason: user.suspensionReason
      });
    }

    // Vérifier si déjà vérifié
    if (user.emailVerifiedAt) {
      return res.status(400).json({
        success: false,
        error: "Votre email est déjà vérifié. Vous pouvez vous connecter.",
        code: "ALREADY_VERIFIED"
      });
    }

    // Vérifier le nombre de tentatives
    if (user.emailVerifyAttempts >= MAX_VERIFICATION_ATTEMPTS) {
      // Suspendre le compte après trop de tentatives
      await prisma.user.update({
        where: { id: user.id },
        data: {
          accountSuspendedAt: new Date(),
          suspensionReason: "Trop de tentatives de vérification échouées"
        }
      });

      await logActivity(user.id, user.name, ip, userAgent, "account_suspended_attempts");

      return res.status(403).json({
        success: false,
        error: "Trop de tentatives échouées. Votre compte a été suspendu pour des raisons de sécurité.",
        code: "TOO_MANY_ATTEMPTS"
      });
    }

    // Vérifier si le code a expiré
    if (!user.emailVerifyCodeExp || new Date() > new Date(user.emailVerifyCodeExp)) {
      // Suspendre le compte si code expiré
      await prisma.user.update({
        where: { id: user.id },
        data: {
          accountSuspendedAt: new Date(),
          suspensionReason: "Code de vérification expiré"
        }
      });

      await logActivity(user.id, user.name, ip, userAgent, "account_suspended_expired");

      return res.status(403).json({
        success: false,
        error: "Votre code de vérification a expiré. Votre compte a été suspendu.",
        code: "CODE_EXPIRED",
        canRequestNew: true // Permettre de demander un nouveau code
      });
    }

    // Vérifier le code
    if (user.emailVerifyCode !== code.trim()) {
      // Incrémenter les tentatives
      const newAttempts = user.emailVerifyAttempts + 1;
      
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerifyAttempts: newAttempts
        }
      });

      await logActivity(user.id, user.name, ip, userAgent, "verification_failed");

      return res.status(400).json({
        success: false,
        error: "Code incorrect. Veuillez réessayer.",
        code: "INVALID_CODE",
        attemptsRemaining: MAX_VERIFICATION_ATTEMPTS - newAttempts,
        attemptsUsed: newAttempts
      });
    }

    // ✅ CODE VALIDE - Vérifier le compte
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerifyCode: null,
        emailVerifyCodeExp: null,
        emailVerifyAttempts: 0,
      }
    });

    await logActivity(user.id, user.name, ip, userAgent, "email_verified");

    // Récupérer la company pour la connexion
    const companyLink = user.companies.find(uc => uc.isOwner) || user.companies[0];

    if (!companyLink) {
      return res.status(403).json({
        success: false,
        error: "Aucune entreprise associée à ce compte",
        code: "NO_COMPANY"
      });
    }

    // ✅ CONNECTER L'UTILISATEUR
    const token = generateToken({
      userId: user.id,
      email: user.email,
      isAdmin: true,
      isSuperadmin: false,
      companyId: companyLink.company.id,
      emailVerified: true,
    });

    res.cookie("admin_token", token, getCookieOptions("admin_token"));

    const fullUser = await loadUserForAuth(user.id, "admin");

    return res.json({
      success: true,
      message: "Email vérifié avec succès. Vous êtes maintenant connecté.",
      emailVerified: true,
      user: formatAdmin(fullUser, companyLink.company.id),
      redirectTo: req.body.returnUrl || "/dashboard" // Redirection personnalisée
    });

  } catch (e) {
    next(e);
  }
};


/**
 * POST /api/client/auth/resend-code
 * Renvoyer un nouveau code de vérification
 */
export const resendVerificationCode = async (req, res, next) => {
  try {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email requis"
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        companies: {
          include: {
            company: true
          }
        }
      }
    });

    if (!user) {
      // Ne pas révéler si l'email existe ou non (sécurité)
      return res.json({
        success: true,
        message: "Si un compte existe avec cet email, un nouveau code a été envoyé."
      });
    }

    // Vérifier si déjà vérifié
    if (user.emailVerifiedAt) {
      return res.json({
        success: true,
        message: "Si un compte existe avec cet email, un nouveau code a été envoyé."
      });
    }

    // Vérifier si le compte est suspendu
    if (user.accountSuspendedAt) {
      return res.status(403).json({
        success: false,
        error: "Votre compte a été suspendu. Veuillez contacter le support.",
        code: "ACCOUNT_SUSPENDED"
      });
    }

    // ✅ GÉNÉRER NOUVEAU CODE
    const newCode = generateOtpCode();
    const newExpiration = getOtpExpiration(OTP_EXPIRATION_DAYS);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyCode: newCode,
        emailVerifyCodeExp: newExpiration,
        emailVerifyAttempts: 0, // Reset les tentatives
      }
    });

    // Récupérer la company pour le nom
    const companyLink = user.companies.find(uc => uc.isOwner) || user.companies[0];

    // Envoyer l'email
    const emailPayload = buildVerificationCodeTemplate({
      name: user.name || email,
      companyName: companyLink?.company?.name || "votre entreprise",
      verificationCode: newCode,
      expiresHours: OTP_EXPIRATION_DAYS * 24,
    });

    await sendMail({ to: email, ...emailPayload });

    return res.json({
      success: true,
      message: "Un nouveau code de vérification a été envoyé à votre email.",
      codeExpiration: newExpiration
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


// ─── POST /api/client/auth/add-company ────────────────────────
/**
 * Ajouter une nouvelle company à un compte utilisateur existant
 * Nécessite d'être authentifié
 */
// ─── DELETE /api/client/auth/company/:id ──────────────────────
export const deleteUserCompany = async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: "Non authentifié", code: "UNAUTHORIZED" });

    const companyId = parseInt(req.params.id);
    if (!companyId) return res.status(400).json({ success: false, error: "ID invalide" });

    // Vérifier que l'user est owner de cette company
    const link = await prisma.userCompany.findFirst({
      where: { userId, companyId, isOwner: true },
    });
    if (!link) return res.status(403).json({ success: false, error: "Non autorisé ou company introuvable", code: "FORBIDDEN" });

    // Vérifier qu'il lui reste au moins une autre company
    const total = await prisma.userCompany.count({ where: { userId } });
    if (total <= 1) return res.status(400).json({ success: false, error: "Vous ne pouvez pas supprimer votre seule entreprise", code: "LAST_COMPANY" });

    // Supprimer les liens UserCompany d'abord, puis la company
    await prisma.userCompany.deleteMany({ where: { companyId } });
    await prisma.company.delete({ where: { id: companyId } });

    return res.json({ success: true, message: "Entreprise supprimée avec succès" });
  } catch (e) {
    next(e);
  }
};

export const addCompany = async (req, res, next) => {
  const ip = getIp(req);
  const userAgent = req.headers["user-agent"] ?? null;
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Non authentifié",
        code: "UNAUTHORIZED"
      });
    }

    const { companyName, address, phone } = req.validatedBody || req.body;

    if (!companyName || !companyName.trim()) {
      return res.status(400).json({
        success: false,
        error: "MISSING COMPANY NAME",
        code: "MISSING_COMPANY_NAME"
      });
    }

    // Récupérer l'utilisateur avec son email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "USER NOT FOUND",
        code: "USER_NOT_FOUND"
      });
    }

    // Vérifier si une company existe déjà avec cet email
    // const existingCompany = await prisma.company.findUnique({
    //   where: { email: user.email }
    // });

    // if (existingCompany) {
    //   // Vérifier si l'utilisateur est déjà lié à cette company
    //   const existingLink = await prisma.userCompany.findUnique({
    //     where: {
    //       userId_companyId: {
    //         userId: user.id,
    //         companyId: existingCompany.id
    //       }
    //     }
    //   });

    //   if (existingLink) {
    //     return res.status(409).json({
    //       success: false,
    //       error: "ALREADY LINKED",
    //       code: "ALREADY_LINKED"
    //     });
    //   }
    // }

    // Récupérer les valeurs par défaut
    
    const [defaultPlan, adminRole, defaultLang] = await Promise.all([
      getDefaultPlan(),
      getAdminRole(),
      getDefaultLanguage(),
    ]);

    // Transaction pour créer la company + lien + subscription
    const result = await prisma.$transaction(async (tx) => {
      // Créer la nouvelle company
      const company = await tx.company.create({
        data: {
          name: companyName.trim(),
          email: user.email,
          phone: phone?.trim() || null,
          address: address?.trim() || null,
          type: "direct",
          status: "active",
          planId: defaultPlan?.id ?? null,
          defaultLanguageId: defaultLang?.id ?? null,
          billingAmount: defaultPlan ? `$${defaultPlan.price}` : "$0",
          mrr: 0,
        },
      });

      // Créer les settings de la company
      await tx.companySettings.create({
        data: {
          companyId: company.id,
          timezone: "UTC",
          currency: "USD",
          notificationEmail: true,
          maxLocations: defaultPlan?.locationLimit ?? 1,
          maxApiCalls: parseInt(defaultPlan?.apiLimit ?? "1000") || 1000,
          maxSmsCalls: parseInt(defaultPlan?.smsLimit ?? "100") || 100,
          maxUser: parseInt(defaultPlan?.userLimit ?? "3") || 3,
          allowCustomColor: false,
        },
      });

      // Créer le lien UserCompany (isOwner = true)
      const userCompanyLink = await tx.userCompany.create({
        data: {
          userId: user.id,
          companyId: company.id,
          roleId: adminRole?.id ?? null,
          isOwner: true,
        },
      });

      // Créer la subscription (en trial)
      if (defaultPlan) {
        await createSubscriptionForCompany(tx, company.id, defaultPlan.id, {
          status: 'trialing',
          interval: 'monthly',
          trialDays: defaultPlan.trialDays || 14,
        });
      }

      return { company, userCompanyLink };
    });

    await logActivity(userId, user.name, ip, userAgent, "company_added");

    // Générer un nouveau token avec la nouvelle company active
    const newToken = generateToken({
      userId: user.id,
      email: user.email,
      isAdmin: true,
      isSuperadmin: false,
      companyId: result.company.id,
      emailVerified: !!user.emailVerifiedAt,
    });

    // Blacklist l'ancien token si présent
    if (req.token) {
      await blacklistToken(req.token);
    }

    // Définir le nouveau cookie
    res.cookie("admin_token", newToken, getCookieOptions("admin_token"));

    // Recharger l'utilisateur complet pour la réponse
    const fullUser = await loadUserForAuth(user.id, "admin");

    return res.status(201).json({
      success: true,
      message: `Entreprise "${result.company.name}" créée avec succès`,
      company: {
        id: result.company.id,
        name: result.company.name,
        email: result.company.email,
        address: result.company.address,
        phone: result.company.phone,
        status: result.company.status,
      },
      user: formatAdmin(fullUser, result.company.id),
      redirectTo: "/dashboard"
    });

  } catch (e) {
    console.error("Error adding company:", e);
    next(e);
  }
};

