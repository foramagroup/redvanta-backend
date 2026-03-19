
import prisma from "../../config/database.js";
import { processLogo, deleteLogo }                              from "../../services/superadmin/logo.service.js";
import { generatePassword, hashPassword, generateWelcomeToken } from "../../services/superadmin/password.service.js";
import { sendMail }                                             from "../../services/superadmin/mail.service.js";
import { buildWelcomeEmailFromTemplate }     from "../../services/superadmin/emailTemplate.service.js";
// import { buildWelcomeEmail }                                    from "../../templates/superadmin/welcome.email.js";


// Chargement des membres (admins) via UserCompany
const COMPANY_INCLUDE = {
  package:        true,
  defaulLanguage: true,
  settings:       true,
  // Tous les admins liés à cette company
  members: {
    include: {
      user: {
        select: { id: true, name: true, email: true, isAdmin: true, lastLogin: true, _count: { select: { locations: true } } },
      },
      role: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  },
  _count: {
    select: {
      members:   true,   // nombre d'admins
    },
  },
};


function formatCompany(c) {
  // Admin principal = isOwner=true
  const ownerLink = c.members?.find((m) => m.isOwner) ?? c.members?.[0] ?? null;
  const admin     = ownerLink ? { ...ownerLink.user, role: ownerLink.role } : null;

  return {
    id:              c.id,
    name:            c.name,
    logo:            c.logo ?? null,
    logoScale:       c.logoScale,
    email:           c.email,
    phone:           c.phone,
    country:         c.country,
    address:         c.address,
    vatNumber:       c.vatNumber,
    tradeNumber:     c.tradeNumber,
    type:            c.type,
    status:          c.status,
    primaryColor:    c.primaryColor,
    plan:            c.package ? { id: c.package.id, name: c.package.name, price: c.package.price } : null,
    defaultLanguage: c.defaulLanguage ? { id: c.defaulLanguage.id, code: c.defaulLanguage.code } : null,
    billingDate:     c.billingDate,
    billingNextDate: c.billingNextDate,
    billingAmount:   c.billingAmount,
    mrr:             c.mrr,
    apiUsageCount:   c.apiUsageCount,
    locations:       c._count?.locations ?? 0,
    adminCount:      c._count?.members   ?? 0,
    // Admin principal pour la vue tableau
    admin,
    // Tous les admins (pour la vue détail)
    members: c.members?.map((m) => ({
      id:       m.id,
      isOwner:  m.isOwner,
      user:     m.user,
      role:     m.role,
      joinedAt: m.createdAt,
    })),
    settings:  c.settings,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function buildDefaultSettings(plan) {
  if (!plan) return { timezone: "UTC", currency: "USD", notificationEmail: true, maxLocations: 1, maxApiCalls: 1000, maxSmsCalls: 100, allowCustomColor: false };
  return {
    timezone:          "UTC",
    currency:          "USD",
    notificationEmail: true,
    maxLocations:      plan.locationLimit ?? 1,
    maxApiCalls:       parseInt(plan.apiLimit)  || 1000,
    maxSmsCalls:       parseInt(plan.smsLimit)  || 100,
    allowCustomColor:  ["pro", "agency"].includes(plan.name?.toLowerCase()),
  };
}

async function findAdminRole() {
  return prisma.role.findFirst({
    where: { name: { in: ["admin", "Admin", "ADMIN", "company_admin"] } },
  });
}

// ─── LIST ─────────────────────────────────────────────────────
export const listCompanies = async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 10);
    const skip   = (page - 1) * limit;
    const search = req.query.search?.trim() || "";
    const status = req.query.status || undefined;
    const type   = req.query.type   || undefined;

    const where = {
      ...(search && { OR: [{ name: { contains: search } }, { email: { contains: search } }] }),
      ...(status && { status }),
      ...(type   && { type }),
    };

    const [data, total] = await Promise.all([
      prisma.company.findMany({ where, skip, take: limit, include: COMPANY_INCLUDE, orderBy: { createdAt: "desc" } }),
      prisma.company.count({ where }),
    ]);

    res.json({ success: true, data: data.map(formatCompany), meta: { total, page, last_page: Math.ceil(total / limit) } });
  } catch (e) { next(e); }
};

// ─── GET ──────────────────────────────────────────────────────
export const getCompany = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const c  = await prisma.company.findUnique({ where: { id }, include: COMPANY_INCLUDE });
    if (!c) return res.status(404).json({ success: false, message: "Entreprise introuvable" });
    res.json({ success: true, data: formatCompany(c) });
  } catch (e) { next(e); }
};

// ─── CREATE ───────────────────────────────────────────────────
// Scénario :
//   Si adminEmail correspond à un User existant → lier via UserCompany (sans recréer)
//   Sinon → créer le User + envoyer email de bienvenue
export const createCompany = async (req, res, next) => {
  try {
    const body       = req.validatedBody;
    const adminEmail = body.adminEmail || body.email;

    // 1. Vérifier unicité email company
    const emailExists = await prisma.company.findUnique({ where: { email: body.email } });
    if (emailExists) return res.status(409).json({ success: false, message: `L'email "${body.email}" est déjà utilisé par une autre entreprise` });

    // 2. Chercher si l'admin existe déjà
    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

    // 3. Logo
    const logoResult = await processLogo(body.logo);

    // 4. Plan et calculs billing
    const plan          = body.planId ? await prisma.plansetting.findUnique({ where: { id: body.planId } }) : null;
    const mrr           = plan?.price ?? 0;
    const billingAmount = plan ? `$${plan.price}` : null;

    // 5. Rôle admin
    const adminRole = await findAdminRole();

    // 6. Password (seulement si nouveau user)
    let plainPassword  = null;
    let hashedPassword = null;
    let welcomeToken   = null;
    let welcomeTokenExp = null;

    if (!existingAdmin) {
      plainPassword   = generatePassword();
      hashedPassword  = await hashPassword(plainPassword);
      welcomeToken    = generateWelcomeToken();
      welcomeTokenExp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    // 7. Transaction : company + settings + user (si nouveau) + UserCompany
    const result = await prisma.$transaction(async (tx) => {
      // Créer la Company
      const company = await tx.company.create({
        data: {
          name:              body.name,
          logo:              logoResult?.url ?? null,
          logoScale:         body.logoScale ?? 100,
          vatNumber:         body.vatNumber  || null,
          tradeNumber:       body.tradeNumber || null,
          email:             body.email,
          phone:             body.phone || null,
          country:           body.country || null,
          address:           body.address || null,
          type:              body.type,
          status:            body.status,
          planId:            body.planId || null,
          defaultLanguageId: body.defaultLanguageId || null,
          billingAmount,
          billingDate:       body.billingDate     ? new Date(body.billingDate)     : null,
          billingNextDate:   body.billingNextDate  ? new Date(body.billingNextDate) : null,
          mrr,
        },
      });

      // Créer les CompanySettings
      await tx.companySettings.create({
        data: { companyId: company.id, ...buildDefaultSettings(plan) },
      });

      let adminUser = existingAdmin;

      if (!existingAdmin) {
        // Créer le nouvel utilisateur admin
        adminUser = await tx.user.create({
          data: {
            email:          adminEmail,
            password:       hashedPassword,
            name:           body.adminName,
            isAdmin:        true,
            isSuperadmin:   false,
            roleId:         adminRole?.id ?? null,
            welcomeToken,
            welcomeTokenExp,
          },
        });
      } else {
        // Marquer l'utilisateur existant comme admin s'il ne l'est pas encore
        await tx.user.update({
          where: { id: existingAdmin.id },
          data:  { isAdmin: true },
        });
      }

      // Créer le lien UserCompany
      await tx.userCompany.create({
        data: {
          userId:    adminUser.id,
          companyId: company.id,
          roleId:    adminRole?.id ?? null,
          isOwner:   true,
        },
      });

      return { company, adminUser, isNewUser: !existingAdmin };
    });

    // 8. Email de bienvenue (seulement si nouvel utilisateur)
    if (result.isNewUser && plainPassword) {
      const loginUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/login`;
          // const emailPayload = buildWelcomeEmail({
          //   companyName:  result.company.name,
          //   adminName:    body.adminName,
          //   email:        adminEmail,
          //   password:     plainPassword,
          //   loginUrl,
          //   primaryColor: result.company.primaryColor,
          // });

      const emailPayload = await buildWelcomeEmailFromTemplate(
      {
        companyName:  result.company.name,
        adminName:    body.adminName,
        email:        adminEmail,
        password:     plainPassword,
        loginUrl,
        primaryColor: result.company.primaryColor,
      },
      body.defaultLanguageId ?? null);

      sendMail({ to: adminEmail, ...emailPayload }).catch((err) => {
        console.error(`[company] Échec email bienvenue → ${adminEmail}:`, err.message);
      });
    }
    // Si l'admin existe déjà → envoyer un email de notification (company rattachée)
    else if (existingAdmin) {
      const loginUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/login`;
      sendMail({
        to:      adminEmail,
        subject: `Nouvelle entreprise rattachée à votre compte`,
        html:    `<p>Bonjour ${existingAdmin.name || adminEmail},<br>L'entreprise <strong>${result.company.name}</strong> a été rattachée à votre compte REDVANTA.<br><a href="${loginUrl}">Accéder à votre espace</a></p>`,
        text:    `L'entreprise "${result.company.name}" a été rattachée à votre compte. Connexion : ${loginUrl}`,
      }).catch(console.error);
    }

    const fullCompany = await prisma.company.findUnique({ where: { id: result.company.id }, include: COMPANY_INCLUDE });

    const msg = result.isNewUser
      ? `Entreprise "${result.company.name}" créée. Email de bienvenue envoyé à ${adminEmail}.`
      : `Entreprise "${result.company.name}" créée et rattachée au compte existant ${adminEmail}.`;

    res.status(201).json({ success: true, message: msg, data: formatCompany(fullCompany) });
  } catch (e) {
    if (e.code === "P2002") return res.status(409).json({ success: false, message: "Email déjà utilisé" });
    next(e);
  }
};

// ─── UPDATE ───────────────────────────────────────────────────
export const updateCompany = async (req, res, next) => {
  try {
    const id      = parseInt(req.params.id);
    const body    = req.validatedBody;
    const existing = await prisma.company.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Entreprise introuvable" });

    if (body.email && body.email !== existing.email) {
      const emailExists = await prisma.company.findUnique({ where: { email: body.email } });
      if (emailExists) return res.status(409).json({ success: false, message: `L'email "${body.email}" est déjà utilisé` });
    }

    let logoUrl = undefined;
    if (body.logo !== undefined) {
      if (body.logo === null) { deleteLogo(existing.logo); logoUrl = null; }
      else {
        const result = await processLogo(body.logo);
        if (result?.url && result.url !== existing.logo) { deleteLogo(existing.logo); logoUrl = result.url; }
        else if (result?.url) logoUrl = result.url;
      }
    }

    let mrr = undefined, billingAmount = undefined;
    if (body.planId !== undefined) {
      const plan = body.planId ? await prisma.plansetting.findUnique({ where: { id: body.planId } }) : null;
      mrr = plan?.price ?? 0;
      billingAmount = plan ? `$${plan.price}` : null;
      if (plan) {
        const ns = buildDefaultSettings(plan);
        await prisma.companySettings.upsert({
          where:  { companyId: id },
          update: { maxLocations: ns.maxLocations, maxApiCalls: ns.maxApiCalls, maxSmsCalls: ns.maxSmsCalls, allowCustomColor: ns.allowCustomColor },
          create: { companyId: id, ...ns },
        });
      }
    }

    const updated = await prisma.company.update({
      where: { id },
      data: {
        ...(body.name              !== undefined && { name: body.name }),
        ...(body.email             !== undefined && { email: body.email }),
        ...(body.phone             !== undefined && { phone: body.phone }),
        ...(body.country           !== undefined && { country: body.country }),
        ...(body.address           !== undefined && { address: body.address }),
        ...(body.vatNumber         !== undefined && { vatNumber: body.vatNumber }),
        ...(body.tradeNumber       !== undefined && { tradeNumber: body.tradeNumber }),
        ...(body.logoScale         !== undefined && { logoScale: body.logoScale }),
        ...(body.type              !== undefined && { type: body.type }),
        ...(body.status            !== undefined && { status: body.status }),
        ...(body.planId            !== undefined && { planId: body.planId }),
        ...(body.defaultLanguageId !== undefined && { defaultLanguageId: body.defaultLanguageId }),
        ...(body.primaryColor      !== undefined && { primaryColor: body.primaryColor }),
        ...(body.billingDate       !== undefined && { billingDate: body.billingDate ? new Date(body.billingDate) : null }),
        ...(body.billingNextDate   !== undefined && { billingNextDate: body.billingNextDate ? new Date(body.billingNextDate) : null }),
        ...(logoUrl    !== undefined && { logo: logoUrl }),
        ...(mrr        !== undefined && { mrr }),
        ...(billingAmount !== undefined && { billingAmount }),
      },
      include: COMPANY_INCLUDE,
    });

    res.json({ success: true, message: "Entreprise mise à jour", data: formatCompany(updated) });
  } catch (e) {
    if (e.code === "P2002") return res.status(409).json({ success: false, message: "Email déjà utilisé" });
    next(e);
  }
};

// ─── CHANGE STATUS ────────────────────────────────────────────
export const changeStatus = async (req, res, next) => {
  try {
    const id     = parseInt(req.params.id);
    const { status } = req.validatedBody;
    const existing = await prisma.company.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Entreprise introuvable" });
    const updated = await prisma.company.update({ where: { id }, data: { status }, include: COMPANY_INCLUDE });
    const labels  = { active: "réactivée", suspended: "suspendue", cancelled: "annulée", trial: "en essai" };
    res.json({ success: true, message: `Entreprise ${labels[status] || status}`, data: formatCompany(updated) });
  } catch (e) { next(e); }
};

// ─── DELETE ───────────────────────────────────────────────────
export const deleteCompany = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.company.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Entreprise introuvable" });
    deleteLogo(existing.logo);
    // La cascade DB supprime user_companies, company_settings, etc.
    await prisma.company.delete({ where: { id } });
    res.json({ success: true, message: "Entreprise supprimée" });
  } catch (e) { next(e); }
};

// ─── IMPERSONATE ──────────────────────────────────────────────
export const impersonateCompany = async (req, res, next) => {
  try {
    const id      = parseInt(req.params.id);
    // Chercher l'admin principal (isOwner=true) via UserCompany
    const ownerLink = await prisma.userCompany.findFirst({
      where:   { companyId: id, isOwner: true },
      include: { user: true, company: true },
    });

    if (!ownerLink) return res.status(422).json({ success: false, message: "Aucun admin propriétaire trouvé pour cette entreprise" });

    const jwt   = await import("jsonwebtoken");
    const token = jwt.default.sign(
      { userId: ownerLink.user.id, companyId: id, isAdmin: true, impersonatedBy: req.user?.id },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({
      success:     true,
      message:     `Impersonnification active pour "${ownerLink.company.name}"`,
      token,
      redirectUrl: `${process.env.FRONTEND_URL}/dashboard?impersonate=1`,
      company:     { id: ownerLink.company.id, name: ownerLink.company.name },
      user:        { id: ownerLink.user.id, email: ownerLink.user.email, name: ownerLink.user.name },
    });
  } catch (e) { next(e); }
};

// ─── RESEND WELCOME EMAIL ─────────────────────────────────────
export const resendWelcomeEmail = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) return res.status(404).json({ success: false, message: "Entreprise introuvable" });

    // Chercher l'admin principal via UserCompany
    const ownerLink = await prisma.userCompany.findFirst({
      where:   { companyId: id, isOwner: true },
      include: { user: true },
    });
    if (!ownerLink) return res.status(404).json({ success: false, message: "Admin principal introuvable" });

    const adminUser     = ownerLink.user;
    const plainPassword = generatePassword();
    const hashedPassword = await hashPassword(plainPassword);
    const welcomeToken   = generateWelcomeToken();
    const welcomeTokenExp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: adminUser.id },
      data:  { password: hashedPassword, welcomeToken, welcomeTokenExp },
    });

    const loginUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/login`;

    // const emailPayload = buildWelcomeEmail({
    //   companyName:  company.name,
    //   adminName:    adminUser.name || "Administrateur",
    //   email:        adminUser.email,
    //   password:     plainPassword,
    //   loginUrl,
    //   primaryColor: company.primaryColor,
    // });


    const lang = await prisma.language.findFirst({
      where: { companies: { some: { id: company.id } } },
      select: { id: true },
    });
    const emailPayload = await buildWelcomeEmailFromTemplate(
      {
        companyName:  company.name,
        adminName:    adminUser.name || "Administrateur",
        email:        adminUser.email,
        password:     plainPassword,
        loginUrl,
        primaryColor: company.primaryColor,
      },
      lang?.id ?? null
    );

    await sendMail({ to: adminUser.email, ...emailPayload });
    res.json({ success: true, message: `Email de bienvenue renvoyé à ${adminUser.email}` });
  } catch (e) { next(e); }
};

// ─── ADD ADMIN TO COMPANY ─────────────────────────────────────
// POST /api/admin/companies/:id/members
// Rattacher un admin existant (ou en créer un nouveau) à une company
export const addMember = async (req, res, next) => {
  try {
    const companyId  = parseInt(req.params.id);
    const { adminEmail, adminName, isOwner = false } = req.body;

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return res.status(404).json({ success: false, message: "Entreprise introuvable" });

    const adminRole = await findAdminRole();
    let adminUser   = await prisma.user.findUnique({ where: { email: adminEmail } });
    let isNewUser   = false;
    let plainPassword = null;

    if (!adminUser) {
      // Créer le nouvel admin
      plainPassword = generatePassword();
      const hashedPassword = await hashPassword(plainPassword);
      const welcomeToken   = generateWelcomeToken();

      adminUser = await prisma.user.create({
        data: {
          email:          adminEmail,
          password:       hashedPassword,
          name:           adminName || adminEmail,
          isAdmin:        true,
          roleId:         adminRole?.id ?? null,
          welcomeToken,
          welcomeTokenExp: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      isNewUser = true;
    }

    // Vérifier qu'il n'est pas déjà lié
    const alreadyLinked = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId: adminUser.id, companyId } },
    });
    if (alreadyLinked) return res.status(409).json({ success: false, message: "Cet admin est déjà rattaché à cette entreprise" });

    await prisma.userCompany.create({
      data: { userId: adminUser.id, companyId, roleId: adminRole?.id ?? null, isOwner },
    });

    // Envoyer email
    if (isNewUser && plainPassword) {
      const loginUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/login`;
      sendMail({
        to: adminEmail,
        ...buildWelcomeEmail({ companyName: company.name, adminName: adminName || adminEmail, email: adminEmail, password: plainPassword, loginUrl, primaryColor: company.primaryColor }),
      }).catch(console.error);
    }

    res.status(201).json({
      success: true,
      message: isNewUser
        ? `Nouvel admin créé et rattaché à "${company.name}". Email envoyé.`
        : `Admin "${adminEmail}" rattaché à "${company.name}".`,
      data: { userId: adminUser.id, email: adminUser.email, companyId, isOwner },
    });
  } catch (e) {
    if (e.code === "P2002") return res.status(409).json({ success: false, message: "Admin déjà rattaché à cette entreprise" });
    next(e);
  }
};

// ─── REMOVE ADMIN FROM COMPANY ────────────────────────────────
// DELETE /api/admin/companies/:id/members/:userId
export const removeMember = async (req, res, next) => {
  try {
    const companyId = parseInt(req.params.id);
    const userId    = parseInt(req.params.userId);

    const link = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (!link) return res.status(404).json({ success: false, message: "Ce lien admin-company n'existe pas" });
    if (link.isOwner) return res.status(409).json({ success: false, message: "Impossible de retirer le propriétaire principal. Transférez d'abord la propriété." });

    await prisma.userCompany.delete({ where: { userId_companyId: { userId, companyId } } });

    // Si cet admin n'a plus aucune company → retirer isAdmin
    const remainingLinks = await prisma.userCompany.count({ where: { userId } });
    if (remainingLinks === 0) {
      await prisma.user.update({ where: { id: userId }, data: { isAdmin: false } });
    }

    res.json({ success: true, message: "Admin retiré de l'entreprise" });
  } catch (e) { next(e); }
};

// ─── GET COMPANIES OF A USER ──────────────────────────────────
// GET /api/admin/companies/by-user/:userId
export const getCompaniesByUser = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId);
    const user   = await prisma.user.findUnique({
      where:   { id: userId },
      include: {
        companies: {
          include: {
            company: { include: { package: true, settings: true } },
            role:    true,
          },
        },
      },
    });
    if (!user) return res.status(404).json({ success: false, message: "Utilisateur introuvable" });

    res.json({
      success: true,
      data: {
        user:      { id: user.id, name: user.name, email: user.email },
        companies: user.companies.map((uc) => ({
          linkId:    uc.id,
          isOwner:   uc.isOwner,
          role:      uc.role,
          joinedAt:  uc.createdAt,
          company:   { id: uc.company.id, name: uc.company.name, email: uc.company.email, status: uc.company.status, plan: uc.company.package },
        })),
      },
    });
  } catch (e) { next(e); }
};

// ─── STATS ────────────────────────────────────────────────────
export const getStats = async (req, res, next) => {
  try {
    const [total, byStatus, byType, totalMrr] = await Promise.all([
      prisma.company.count(),
      prisma.company.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.company.groupBy({ by: ["type"],   _count: { id: true } }),
      prisma.company.aggregate({ _sum: { mrr: true } }),
    ]);
    res.json({
      success: true,
      data: {
        total,
        byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count.id])),
        byType:   Object.fromEntries(byType.map((t)   => [t.type,   t._count.id])),
        totalMrr: totalMrr._sum.mrr ?? 0,
      },
    });
  } catch (e) { next(e); }
};