import express from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireSuperadmin } from "../../middleware/requireSuperadmin.js";
import { login, logout, me } from "../../controllers/superadmin/authController.js";

const router = express.Router();

router.post("/login", login);
router.get("/me", requireAuth, requireSuperadmin, me);
router.post("/logout", requireAuth, requireSuperadmin, logout);

export default router;
