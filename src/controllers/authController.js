
import prisma  from "../config/database.js";
import bcrypt  from "bcryptjs";
import { generateToken, getCookieOptions, blacklistToken } from "../services/token.service.js";
import { loadUserByEmail, loadUserForAuth, formatAdmin } from "../services/superadmin/auth.service.js";


async function logActivity(userId, name, ip, userAgent, status) {
  await prisma.loginActivity.create({
    data: { userId: userId ?? null, admin_name: name ?? null, ip, userAgent, status },
  }).catch(console.error);
}

function getIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
    || req.socket?.remoteAddress
    || "unknown";
}

// ─── POST /api/admin/auth/login ───────────────────────────────
export const login = async (req, res, next) => {
  const ip        = getIp(req);
  const userAgent = req.headers["user-agent"] ?? null;

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(422).json({ success: false, error: "Email et mot de passe requis" });
    }

    // Charger le user avec toutes ses companies
    const user = await loadUserByEmail(email, "admin");

    // Vérifier que c'est un admin actif
    if (!user || !user.isAdmin) {
      await logActivity(null, email, ip, userAgent, "failed");
      return res.status(401).json({ success: false, error: "Identifiants invalides ou accès non autorisé" });
    }

    // Bloquer les superadmins purs sur cette route
    if (user.isSuperadmin && !user.isAdmin) {
      await logActivity(user.id, user.name, ip, userAgent, "failed");
      return res.status(401).json({ success: false, error: "Utilisez le portail SuperAdmin" });
    }

    // Vérifier le mot de passe
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      await logActivity(user.id, user.name, ip, userAgent, "failed");
      return res.status(401).json({ success: false, error: "Identifiants invalides" });
    }

      const activeCompanies = user.companies
      ?.filter((uc) => ["active", "trial"].includes(uc.company?.status))
      .map(uc => ({
        id: uc.company.id,
        name: uc.company.name,
        isOwner: uc.isOwner,
        logo: uc.company.logo
      }));

      if (!activeCompanies || activeCompanies.length === 0) {
        await logActivity(user.id, user.name, ip, userAgent, "failed");
        return res.status(403).json({ success: false, error: "Aucune entreprise active associée a ce compte" });
      }

      if (activeCompanies.length > 1) {
          return res.json({
            success: true,
            requiresSelection: true,
            companies: activeCompanies,
            userId: user.id 
          });
      }

   const defaultLink = activeCompanies[0];
    // Company par défaut = la company dont il est owner et active
    // const defaultLink = user.companies?.find(
    //   (uc) => uc.isOwner && ["active", "trial"].includes(uc.company?.status)
    // ) ?? activeLink;
    // Générer le JWT avec la company active encodée dedans
    const token = generateToken({
      userId:       user.id,
      email:        user.email,
      isAdmin:      true,
      isSuperadmin: false,
      companyId:    defaultLink.id,
    });
    // Mettre à jour lastLogin
    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

    // Logger
    await logActivity(user.id, user.name, ip, userAgent, "success");
   
    res.cookie("admin_token", token, getCookieOptions("admin_token"));
  
    return res.json({
      success: true,
      message: "Connexion réussie",
      user:    formatAdmin(user),
    });
  } catch (e) {
    await logActivity(null, req.body?.email, ip, userAgent, "failed");
    next(e);
  }
};



export const selectCompany = async (req, res, next) => {
  try {
    const { userId, companyId } = req.body;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { companies: { include: { company: true } } }
    });
    const hasAccess = user.companies.find(uc => 
      uc.companyId === companyId && ["active", "trial"].includes(uc.company.status)
    );
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: "Accès refusé à cette entreprise" });
    }
    const token = generateToken({
      userId: user.id,
      email: user.email,
      isAdmin: true,
      isSuperadmin: false,
      companyId: companyId,
    });
    // 3. Mettre à jour le login et poser le cookie
    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
    res.cookie("admin_token", token, getCookieOptions("admin_token"));
    return res.json({
      success: true,
      user: formatAdmin(user),
      companyId: companyId
    });
  } catch (e) {
    next(e);
  }
};

// ─── GET /api/admin/auth/me ───────────────────────────────────
export const me = async (req, res, next) => {
  try {
    const user = await loadUserForAuth(req.user.userId, "admin");
    if (!user || !user.isAdmin) {
      return res.status(403).json({ success: false, error: "Accès refusé" });
    }
    return res.json({ success: true, user: formatAdmin(user) });
  } catch (e) { next(e); }
};

// ─── POST /api/admin/auth/switch-company ─────────────────────
// Changer de company active → génère un nouveau cookie avec le nouveau companyId
export const switchCompany = async (req, res, next) => {
  try {
    const { companyId } = req.body;
    if (!companyId) return res.status(422).json({ success: false, error: "companyId requis" });

    // Vérifier que cet admin est lié à cette company
    const link = await prisma.userCompany.findUnique({
      where:   { userId_companyId: { userId: req.user.userId, companyId: parseInt(companyId) } },
      include: { company: true },
    });

    if (!link) return res.status(403).json({ success: false, error: "Accès à cette entreprise refusé" });
    if (!["active", "trial"].includes(link.company.status)) {
      return res.status(403).json({ success: false, error: "Cette entreprise est suspendue" });
    }

    // Blacklister l'ancien token
    if (req.token) await blacklistToken(req.token);

    // Nouveau token avec le nouveau companyId
    const newToken = generateToken({
      userId:       req.user.userId,
      email:        req.user.email,
      isAdmin:      true,
      isSuperadmin: false,
      companyId:    parseInt(companyId),
    });

    // Nouveau cookie
    res.cookie("admin_token", newToken, getCookieOptions("admin_token"));

    return res.json({
      success:       true,
      message:       `Basculé vers "${link.company.name}"`,
      activeCompany: { id: link.company.id, name: link.company.name, status: link.company.status },
    });
  } catch (e) { next(e); }
};

// ─── POST /api/admin/auth/logout ─────────────────────────────
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

// ─── GET /api/admin/auth/check ───────────────────────────────
export const check = async (req, res) => {
  return res.json({ success: true, authenticated: true });
};