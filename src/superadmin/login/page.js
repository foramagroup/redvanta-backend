import express from "express";
import {
  dashboardPage,
  loginPage,
  loginSubmit,
  logout,
} from "../../controllers/superadminAuthController.js";

const router = express.Router();

router.get("/login", loginPage);
router.post("/login", loginSubmit);
router.get("/", dashboardPage);
router.get("/logout", logout);

export default router;
