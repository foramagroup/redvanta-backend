// src/routes/superadmin/company.routes.js

import { Router } from "express";
import { authenticate, authorize, validate } from "../../middleware/index.js";
import {
  listCompanies,
  getCompany,
  createCompany,
  updateCompany,
  changeStatus,
  deleteCompany,
  impersonateCompany,
  resendWelcomeEmail,
  addMember,
  removeMember,
  getCompaniesByUser,
  getStats,
} from "../../controllers/superadmin/companyController.js";
import {
  createCompanySchema,
  updateCompanySchema,
  changeStatusSchema,
} from "../../validators/superadmin/company.validator.js";

const router = Router();
// router.use(authenticate, requireSuperAdmin);

// ─── Stats ───────────────────────────────────────────────────
// GET /api/admin/companies/stats
router.get("/stats", getStats);

// ─── Lookup par user ─────────────────────────────────────────
// GET /api/admin/companies/by-user/:userId
router.get("/by-user/:userId", getCompaniesByUser);

// ─── CRUD ────────────────────────────────────────────────────
router.get   ("/",    listCompanies);
router.get   ("/:id", getCompany);
router.post  ("/",    validate(createCompanySchema), createCompany);
router.put   ("/:id", validate(updateCompanySchema), updateCompany);
router.delete("/:id", deleteCompany);

// ─── Actions ─────────────────────────────────────────────────
router.patch("/:id/status",         validate(changeStatusSchema), changeStatus);
router.post ("/:id/impersonate",    impersonateCompany);
router.post ("/:id/resend-welcome", resendWelcomeEmail);

// ─── Gestion des membres (admins) d'une company ──────────────
// POST   /api/admin/companies/:id/members           → ajouter un admin
// DELETE /api/admin/companies/:id/members/:userId   → retirer un admin
// router.post  ("/:id/members",           addMember);
// router.delete("/:id/members/:userId",   removeMember);

export default router;