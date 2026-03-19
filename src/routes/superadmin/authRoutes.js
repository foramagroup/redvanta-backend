import express from "express";
import { authenticateSuperAdmin, requireSuperAdmin } from "../../middleware/auth.middleware.js";
import { login, me, logout, check } from "../../controllers/superadmin/authController.js";

const router = express.Router();




// router.post("/login", login);
// router.get("/me", requireAuth, requireSuperadmin, me);
// router.post("/logout", requireAuth, requireSuperadmin, logout);

router.post("/login",  login);
router.get ("/me",     authenticateSuperAdmin, requireSuperAdmin, me);
router.get ("/check",  authenticateSuperAdmin, requireSuperAdmin, check);
router.post("/logout", authenticateSuperAdmin, logout);



export default router;
