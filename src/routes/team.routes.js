// src/routes/team.routes.js
// Monté dans app.js via : app.use("/api/admin/team", teamRoutes)

import { Router } from "express";
import { authenticateAdmin, requireAdmin } from "../middleware/auth.middleware.js";

import {
  getTeamLocations,
  listTeamMembers,
  inviteTeamMember,
  getMemberActivity,
  changeMemberRole,
  toggleMemberStatus,
  removeMember,
  getTeamRoles
} from "../controllers/team.controller.js";

const router = Router();
const auth = [authenticateAdmin, requireAdmin];

// ── Routes statiques AVANT /:id ───────────────────────────────
router.get  ("/locations", ...auth, getTeamLocations);   // GET  /api/admin/team/locations
router.get  ("/",          ...auth, listTeamMembers);    // GET  /api/admin/team
router.get  ("/roles",     ...auth, getTeamRoles);       // GET  /api/admin/roles
router.post ("/invite",    ...auth, inviteTeamMember);   // POST /api/admin/team/invite

// ── Routes paramétrées ────────────────────────────────────────
router.get   ("/:id/activity", ...auth, getMemberActivity);   // GET    /api/admin/team/:id/activity
router.put   ("/:id/role",     ...auth, changeMemberRole);    // PUT    /api/admin/team/:id/role
router.put   ("/:id/status",   ...auth, toggleMemberStatus);  // PUT    /api/admin/team/:id/status
router.delete("/:id",          ...auth, removeMember);        // DELETE /api/admin/team/:id

export default router;