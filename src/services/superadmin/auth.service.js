

import prisma from "../../config/database.js";

const SUPERADMIN_INCLUDE = {
  role: {
    include: {
      rolepermission: {
        include: {
          module:     true,
          permission: true,
        },
      },
    },
  },
};

const ADMIN_INCLUDE = {
  role: {
    include: {
      rolepermission: {
        include: {
          module:     true,
          permission: true,
        },
      },
    },
  },
  // Toutes les companies liées via UserCompany
  companies: {
    include: {
      company: {
        include: {
          package:        true,
          defaulLanguage: true,
          settings:       true,
        },
      },
      role: {
        include: {
          rolepermission: {
            include: { module: true, permission: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  },
};

// ─── Formater les permissions ─────────────────────────────────
// Retourne une map { "module_name": ["view", "create", ...] }
function formatPermissions(rolepermissions = []) {
  const map = {};
  for (const rp of rolepermissions) {
    const mod  = rp.module?.name;
    const perm = rp.permission?.name;
    if (!mod || !perm) continue;
    if (!map[mod]) map[mod] = [];
    if (!map[mod].includes(perm)) map[mod].push(perm);
  }
  return map;
}

// ─── Formater le user superadmin pour la réponse ─────────────
export function formatSuperAdmin(user) {
  const permissions = formatPermissions(user.role?.rolepermission ?? []);
  return {
    id:              user.id,
    email:           user.email,
    name:            user.name,
    phone:           user.phone,
    isSuperadmin:    user.isSuperadmin,
    isAdmin:         user.isAdmin,
    superadminSince: user.superadminSince,
    twoFa:           user.twoFa ?? false,
    lastLogin:       user.lastLogin,
    role: user.role ? {
      id:   user.role.id,
      name: user.role.name,
    } : null,
    permissions,  // { "products": ["view","create","update","delete"], ... }
    // Modules auxquels le superadmin a accès
    modules: Object.keys(permissions),
    createdAt: user.createdAt,
  };
}

// ─── Formater le user admin pour la réponse ──────────────────
export function formatAdmin(user) {
  const globalPermissions = formatPermissions(user.role?.rolepermission ?? []);
  const companies = (user.companies ?? []).map((uc) => {
    const companyPermissions = formatPermissions(uc.role?.rolepermission ?? []);
    return {
      linkId:      uc.id,
      isOwner:     uc.isOwner,
      joinedAt:    uc.createdAt,
      // Permissions dans cette company (rôle company > rôle global)
      permissions: Object.keys(companyPermissions).length > 0 ? companyPermissions : globalPermissions,
      modules:     Object.keys(companyPermissions).length > 0 ? Object.keys(companyPermissions) : Object.keys(globalPermissions),
      role: uc.role ? { id: uc.role.id, name: uc.role.name } : null,
      company: {
        id:             uc.company.id,
        name:           uc.company.name,
        logo:           uc.company.logo,
        email:          uc.company.email,
        phone:          uc.company.phone,
        country:        uc.company.country,
        status:         uc.company.status,
        type:           uc.company.type,
        primaryColor:   uc.company.primaryColor,
        captchaEnabled: uc.company.captchaEnabled,
        mapsEnabled:    uc.company.mapsEnabled,
        googleLink:     uc.company.googleLink,
        facebookLink:   uc.company.facebookLink,
        defaultLanguage: uc.company.defaulLanguage
          ? { id: uc.company.defaulLanguage.id, code: uc.company.defaulLanguage.code }
          : null,
        plan: uc.company.package
          ? { id: uc.company.package.id, name: uc.company.package.name, locationLimit: uc.company.package.locationLimit }
          : null,
        settings: uc.company.settings
          ? {
              timezone:          uc.company.settings.timezone,
              currency:          uc.company.settings.currency,
              maxLocations:      uc.company.settings.maxLocations,
              maxApiCalls:       uc.company.settings.maxApiCalls,
              notificationEmail: uc.company.settings.notificationEmail,
              allowCustomColor:  uc.company.settings.allowCustomColor,
            }
          : null,
      },
    };
  });

  // Company active par défaut = première company dont il est owner
  const activeCompany = companies.find((c) => c.isOwner) ?? companies[0] ?? null;

  return {
    id:           user.id,
    email:        user.email,
    name:         user.name,
    phone:        user.phone,
    isAdmin:      user.isAdmin,
    isSuperadmin: user.isSuperadmin,
    twoFa:        user.twoFa ?? false,
    lastLogin:    user.lastLogin,
    role: user.role ? { id: user.role.id, name: user.role.name } : null,
    // Permissions globales (fallback si pas de rôle company)
    permissions:  globalPermissions,
    modules:      Object.keys(globalPermissions),
    // Toutes les companies de cet admin
    companies,
    // Company courante (la première par défaut)
    activeCompany: activeCompany?.company ?? null,
    activePermissions: activeCompany?.permissions ?? globalPermissions,
    activeModules:     activeCompany?.modules     ?? Object.keys(globalPermissions),
    createdAt: user.createdAt,
  };
}

// ─── Charger un user pour l'auth ─────────────────────────────

export async function loadUserForAuth(userId, type = "admin") {
  const include = type === "superadmin" ? SUPERADMIN_INCLUDE : ADMIN_INCLUDE;
  return prisma.user.findUnique({ where: { id: userId }, include });
}

export async function loadUserByEmail(email, type = "admin") {
  const include = type === "superadmin" ? SUPERADMIN_INCLUDE : ADMIN_INCLUDE;
  return prisma.user.findUnique({ where: { email }, include });
}