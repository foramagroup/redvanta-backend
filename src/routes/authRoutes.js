// backend/src/routes/authRoutes.js

import express from "express";

import {
  login,
  logout,
  me,
  registerUser
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();   // only one declaration

// POST /api/auth/login
router.post("/login", login);

// POST /api/auth/register
router.post("/register", registerUser);

// GET /api/auth/me - protected route
router.get("/me", requireAuth, me);

// POST /api/auth/logout
router.post("/logout", logout);

export default router;
