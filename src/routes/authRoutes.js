
import { Router } from "express";
import { authenticateAdmin, requireAdmin } from "../middleware/auth.middleware.js";
import { login, me, logout, check, switchCompany, selectCompany } from "../controllers/authController.js";

const router = Router();

router.post("/login",  login);

router.selectCompany("/select-company", selectCompany)

router.get ("/me",   authenticateAdmin, requireAdmin, me);

// GET  /api/admin/auth/check          — vérification silencieuse session
router.get ("/check",          authenticateAdmin, requireAdmin, check);

// POST /api/admin/auth/switch-company — changer de company active
router.post("/switch-company", authenticateAdmin, requireAdmin, switchCompany);

router.post("/logout",         authenticateAdmin, logout);

export default router;