// src/controllers/client/Team.controller.js
// ─────────────────────────────────────────────────────────────
// Endpoints pour la vue "Team" (admin)
//
//   GET    /team/locations     → locations de la company (invite modal checkboxes)
//   GET    /team               → liste des membres + roles + locations assignées
//   POST   /team/invite        → inviter un nouveau membre
//   GET    /team/:id/activity  → journal d'activité d'un membre (modal)
//   PUT    /team/:id/role      → changer le rôle d'un membre
//   PUT    /team/:id/status    → activer / désactiver un membre
//   DELETE /team/:id           → retirer un membre de la company
// ─────────────────────────────────────────────────────────────

import prisma    from "../config/database.js";
import crypto    from "crypto";
import { sendTemplatedMail } from "../services/client/mail.service.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

function getCompanyId(req) {
  const id = req.user?.companyId;
  if (!id) throw Object.assign(new Error("Aucune company active"), { status: 403 });
  return parseInt(id);
}

// ─── Noms de rôle standard de la vue ─────────────────────────
// Mappés sur les noms en DB (Role.name) — à adapter si tu as des IDs fixes

// ─── Format membre ────────────────────────────────────────────
function formatMember(uc, companyId) {
  const user      = uc.user;
  const locations = user.locationAssignments
    ?.filter((ul) => ul.companyId === companyId)
    .map((ul) => ({ id: ul.location.id, name: ul.location.name })) ?? [];

  // Initiales pour l'avatar
  const avatar = (user.name || user.email)
    .split(" ")
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");

  return {
    id:        user.id,
    name:      user.name  || "",
    email:     user.email,
    avatar,
    role:      uc.role?.name ?? (user.isAdmin ? "Admin" : "Viewer"),
    roleId:    uc.roleId,
    isOwner:   uc.isOwner,
    // "All" si aucune location assignée (accès total), sinon la liste
    locations:     locations.length > 0 ? locations : "All",
    locationNames: locations.length > 0 ? locations.map((l) => l.name).join(", ") : "All",
    status:     user.accountSuspendedAt ? "Inactive" : "Active",
    lastLogin:  user.lastLogin ?? null,
    createdAt:  uc.createdAt,
  };
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/team/locations
// Locations actives de la company (pour les checkboxes du modal invite)
// ─────────────────────────────────────────────────────────────
export const getTeamLocations = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);

    const locations = await prisma.location.findMany({
      where:   { companyId, active: true },
      select:  { id: true, name: true, city: true, address: true },
      orderBy: { name: "asc" },
    });

    res.json({ success: true, data: locations });
  } catch (e) {
    next(e);
  }
};

// GET /api/admin/team/roles
// Liste tous les roles disponibles depuis la table Role
// -> alimente le <select> du modal invite
export const getTeamRoles = async (req, res, next) => {
  try {
    const roles = await prisma.role.findMany({
      where: {
        name: {
          notIn: ["Super Admin", "Support Admin"],
        },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    res.json({ success: true, data: roles });
  } catch (e) {
    next(e);
  }
};


// ─────────────────────────────────────────────────────────────
// GET /api/admin/team
// Liste tous les membres de la company avec leurs rôles et locations
// ─────────────────────────────────────────────────────────────
export const listTeamMembers = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);

    const members = await prisma.userCompany.findMany({
      where:   { companyId },
      include: {
        role: true,
        user: {
          select: {
            id:                  true,
            name:                true,
            email:               true,
            isAdmin:             true,
            lastLogin:           true,
            accountSuspendedAt:  true,
            createdAt:           true,
            locationAssignments: {
              where:   { companyId },
              include: { location: { select: { id: true, name: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json({
      success: true,
      data:    members.map((m) => formatMember(m, companyId)),
    });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/admin/team/invite
// Invite un nouveau membre (créé si inconnu, ajouté à la company sinon)
//
// Body :
//   email       String   (requis)
//   name        String   (requis)
//   roleName    String   "Viewer" | "Manager" | "Admin"
//   locationIds Int[]    vide = accès total
// ─────────────────────────────────────────────────────────────
export const inviteTeamMember = async (req, res, next) => {
  try {
    const companyId   = getCompanyId(req);
    const inviterUser = req.user;
    const { email, name, roleName = "Viewer", locationIds = [] } = req.body;

    if (!email?.trim()) {
      return res.status(422).json({ success: false, error: "L'email est requis" });
    }
    if (!name?.trim()) {
      return res.status(422).json({ success: false, error: "Le nom est requis" });
    }

    // Récupérer l'id du rôle depuis la DB (Role.name = roleName)
    const role = await prisma.role.findFirst({ where: { name: roleName } });
    if (!role) {
      return res.status(422).json({
        success: false,
        error: `Rôle "${roleName}" introuvable en base. Vérifiez la table roles.`,
      });
    }

    // Récupérer la company pour l'email d'invitation
    const company = await prisma.company.findUnique({
      where:  { id: companyId },
      select: { name: true },
    });

    const result = await prisma.$transaction(async (tx) => {
      // ── Chercher ou créer l'utilisateur ────────────────────
      let user = await tx.user.findUnique({ where: { email: email.trim().toLowerCase() } });
      let isNew = false;

      if (!user) {
        // Générer un token de bienvenue (lien de création de mot de passe)
        const welcomeToken = crypto.randomBytes(32).toString("hex");
        const welcomeTokenExp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // +7j

        user = await tx.user.create({
          data: {
            email:          email.trim().toLowerCase(),
            name:           name.trim(),
            password:       crypto.randomBytes(16).toString("hex"), // mot de passe temporaire
            welcomeToken,
            welcomeTokenExp,
          },
        });
        isNew = true;
      }

      // ── Vérifier que l'user n'est pas déjà membre ──────────
      const existing = await tx.userCompany.findFirst({
        where: { userId: user.id, companyId },
      });
      if (existing) {
        throw Object.assign(
          new Error("Cet utilisateur est déjà membre de la company"),
          { status: 409 }
        );
      }

      // ── Créer la liaison UserCompany ───────────────────────
      await tx.userCompany.create({
        data: {
          userId:    user.id,
          companyId,
          roleId:    role.id,
          isOwner:   false,
        },
      });

      // ── Assigner les locations (si précisées) ──────────────
      if (Array.isArray(locationIds) && locationIds.length > 0) {
        const validLocations = await tx.location.findMany({
          where: { id: { in: locationIds.map(Number) }, companyId, active: true },
          select: { id: true },
        });

        if (validLocations.length > 0) {
          await tx.userLocation.createMany({
            data: validLocations.map((loc) => ({
              userId:     user.id,
              companyId,
              locationId: loc.id,
            })),
            skipDuplicates: true,
          });
        }
      }

      // ── Log de l'activité ──────────────────────────────────
      await tx.teamActivityLog.create({
        data: {
          companyId,
          userId:   parseInt(inviterUser.userId),
          action:   `Invited ${user.name || user.email} as ${roleName}`,
          category: "settings",
          metadata: { invitedUserId: user.id, roleName },
        },
      });

      return { user, isNew, role };
    });

    // ── Envoyer l'email d'invitation ───────────────────────
    const inviteUrl = result.isNew
      ? `${FRONTEND_URL}/welcome?token=${result.user.welcomeToken}`
      : `${FRONTEND_URL}/login`;

    await sendTemplatedMail({
      slug: result.isNew ? "team_invite_new" : "team_invite_existing",
      to:   email,
      variables: {
        member_name:   result.user.name || email,
        company_name:  company.name,
        role:          roleName,
        invite_url:    inviteUrl,
        year:          String(new Date().getFullYear()),
      },
      fallbackFn: () => ({
        subject: `You've been invited to join ${company.name} on Opinoor`,
        html: `
          <p>Hi ${result.user.name || "there"},</p>
          <p>You've been invited to join <strong>${company.name}</strong> as <strong>${roleName}</strong>.</p>
          <p><a href="${inviteUrl}" style="background:#E10600;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
            ${result.isNew ? "Set up your account" : "Sign in to access"}
          </a></p>
        `,
        text: `You've been invited to join ${company.name} as ${roleName}. Visit: ${inviteUrl}`,
      }),
    }).catch((err) => console.error("[team] Invite email error:", err.message));

    res.status(201).json({
      success: true,
      message: result.isNew
        ? `Invitation envoyée à ${email}. Un lien de création de compte a été généré.`
        : `${email} ajouté à la company.`,
      data: {
        userId:  result.user.id,
        isNew:   result.isNew,
        role:    roleName,
      },
    });
  } catch (e) {
    if (e.status === 409) {
      return res.status(409).json({ success: false, error: e.message });
    }
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/admin/team/:id/activity
// Journal d'activité d'un membre (modal "Activity Log")
// ─────────────────────────────────────────────────────────────
export const getMemberActivity = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const userId    = parseInt(req.params.id);

    // Vérifier que l'utilisateur appartient à la company
    const membership = await prisma.userCompany.findFirst({
      where: { userId, companyId },
    });
    if (!membership) {
      return res.status(404).json({ success: false, error: "Membre introuvable" });
    }

    const [activityLogs, loginLogs] = await Promise.all([
      // Logs spécifiques (TeamActivityLog)
      prisma.teamActivityLog.findMany({
        where:   { companyId, userId },
        orderBy: { createdAt: "desc" },
        take:    20,
      }),
      // Logs de connexion (LoginActivity)
      prisma.loginActivity.findMany({
        where:   { userId, status: "success" },
        orderBy: { createdAt: "desc" },
        take:    5,
        select:  { id: true, createdAt: true, ip: true },
      }),
    ]);

    // Fusionner et trier par date décroissante
    const merged = [
      ...activityLogs.map((log) => ({
        id:        log.id,
        action:    log.action,
        category:  log.category ?? "general",
        createdAt: log.createdAt,
      })),
      ...loginLogs.map((log) => ({
        id:        `login-${log.id}`,
        action:    `Logged in${log.ip ? ` from ${log.ip}` : ""}`,
        category:  "auth",
        createdAt: log.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 20);

    res.json({ success: true, data: merged });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/admin/team/:id/role
// Changer le rôle d'un membre (bouton "Change Role" dans la modal)
//
// Body : { roleName: "Viewer" | "Manager" | "Admin" }
// ─────────────────────────────────────────────────────────────
export const changeMemberRole = async (req, res, next) => {
  try {
    const companyId   = getCompanyId(req);
    const targetId    = parseInt(req.params.id);
    const { roleName } = req.body;

    if (!ROLE_NAMES.includes(roleName)) {
      return res.status(422).json({
        success: false,
        error: `roleName invalide. Valeurs : ${ROLE_NAMES.join(", ")}`,
      });
    }

    // Récupérer le rôle
    const role = await prisma.role.findFirst({ where: { name: roleName } });
    if (!role) {
      return res.status(422).json({ success: false, error: `Rôle "${roleName}" introuvable` });
    }

    // Vérifier la liaison
    const membership = await prisma.userCompany.findFirst({
      where: { userId: targetId, companyId },
    });
    if (!membership) {
      return res.status(404).json({ success: false, error: "Membre introuvable" });
    }
    if (membership.isOwner) {
      return res.status(403).json({ success: false, error: "Impossible de modifier le rôle du propriétaire" });
    }

    await prisma.$transaction([
      prisma.userCompany.update({
        where: { id: membership.id },
        data:  { roleId: role.id },
      }),
      prisma.teamActivityLog.create({
        data: {
          companyId,
          userId:   parseInt(req.user.userId),
          action:   `Changed role of member #${targetId} to ${roleName}`,
          category: "settings",
          metadata: { targetUserId: targetId, newRole: roleName },
        },
      }),
    ]);

    res.json({ success: true, message: `Rôle mis à jour : ${roleName}` });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/admin/team/:id/status
// Activer ou désactiver un membre (bouton "Deactivate" de la modal)
//
// Body : { active: boolean }
// ─────────────────────────────────────────────────────────────
export const toggleMemberStatus = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const targetId  = parseInt(req.params.id);
    const activate  = req.body.active !== false; // true = activer, false = désactiver

    const membership = await prisma.userCompany.findFirst({
      where: { userId: targetId, companyId },
    });
    if (!membership) {
      return res.status(404).json({ success: false, error: "Membre introuvable" });
    }
    if (membership.isOwner) {
      return res.status(403).json({ success: false, error: "Impossible de désactiver le propriétaire" });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: targetId },
        data:  {
          accountSuspendedAt: activate ? null : new Date(),
          suspensionReason:   activate ? null : "Désactivé par l'admin",
        },
      }),
      prisma.teamActivityLog.create({
        data: {
          companyId,
          userId:   parseInt(req.user.userId),
          action:   `${activate ? "Activated" : "Deactivated"} member #${targetId}`,
          category: "settings",
          metadata: { targetUserId: targetId, action: activate ? "activate" : "deactivate" },
        },
      }),
    ]);

    res.json({
      success: true,
      message: activate ? "Membre activé" : "Membre désactivé",
      status:  activate ? "Active" : "Inactive",
    });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/admin/team/:id
// Retirer un membre de la company (supprime UserCompany + UserLocation)
// ─────────────────────────────────────────────────────────────
export const removeMember = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const targetId  = parseInt(req.params.id);

    const membership = await prisma.userCompany.findFirst({
      where: { userId: targetId, companyId },
    });
    if (!membership) {
      return res.status(404).json({ success: false, error: "Membre introuvable" });
    }
    if (membership.isOwner) {
      return res.status(403).json({ success: false, error: "Impossible de retirer le propriétaire" });
    }

    await prisma.$transaction([
      // Supprimer les assignations de locations
      prisma.userLocation.deleteMany({ where: { userId: targetId, companyId } }),
      // Supprimer la liaison company
      prisma.userCompany.delete({ where: { id: membership.id } }),
      // Log
      prisma.teamActivityLog.create({
        data: {
          companyId,
          userId:   parseInt(req.user.userId),
          action:   `Removed member #${targetId} from company`,
          category: "settings",
          metadata: { targetUserId: targetId },
        },
      }),
    ]);

    res.json({ success: true, message: "Membre retiré de la company" });
  } catch (e) {
    next(e);
  }
};