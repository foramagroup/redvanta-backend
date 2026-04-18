

import { Router } from "express";
import { authenticateAdmin, requireAdmin, validate } from "../../middleware/auth.middleware.js";
import {
  authLoginLimiter,
  authResendLimiter,
  authSignupLimiter,
  authVerifyLimiter,
} from "../../middleware/rateLimit.js";
import {
  signup,
  login,
  verifyEmail,
  resendVerification,
  verifyCode,           
  resendVerificationCode,
  me,
  switchCompany,
  addCompany,
  logout,
} from "../../controllers/client/clientAuthController.js";
import { signupSchema, loginSchema, addCompanySchema } from "../../validators/client/clientauth.validator.js";

const router = Router();

// ─── Routes publiques ─────────────────────────────────────────


// POST /api/auth/signup  — inscription + création company + connexion auto
router.post("/signup", authSignupLimiter, validate(signupSchema), signup);

// POST /api/auth/login   — connexion admin client
router.post("/login", authLoginLimiter, validate(loginSchema), login);

//  Vérification du code OTP
router.post('/verify-code', verifyCode);

//  Renvoyer le code
router.post('/resend-code', resendVerificationCode);

// GET  /api/auth/verify-email?token=xxx  — confirmation email (lien du mail)
router.get("/verify-email", authVerifyLimiter, verifyEmail);

// POST /api/auth/resend-verification  — renvoyer le mail de confirmation
router.post("/resend-verification", authResendLimiter, resendVerification);



// GET  /api/auth/me
router.get("/me", authenticateAdmin, requireAdmin, me);


// POST /api/auth/switch-company
router.post("/switch-company", authenticateAdmin, requireAdmin, switchCompany);


router.post("/add-company", authenticateAdmin, validate(addCompanySchema), addCompany);

// POST /api/auth/logout
router.post("/logout", authenticateAdmin, logout);

export default router;
