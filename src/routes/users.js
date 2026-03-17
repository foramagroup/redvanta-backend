import express from "express";
import { isAdmin } from "../middleware/auth.js";
import {
  listUsers,
  inviteUser,
  exportUsersCsv
} from "../controllers/usersController.js";

const router = express.Router();

router.get("/", isAdmin, listUsers);
router.post("/invite", isAdmin, inviteUser);
router.get("/export", isAdmin, exportUsersCsv);

export default router;
