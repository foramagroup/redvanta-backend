// backend/src/routes/dashboardUsersRoutes.js
import express from "express";
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  exportUsersCsv,
  inviteUser,
} from "../controllers/dashboardUsersController.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth);
router.use(requireAdmin);

router.get("/", listUsers);               // GET /api/dashboard/users
router.get("/export", exportUsersCsv);    // GET /api/dashboard/users/export?q=
router.post("/invite", inviteUser);       // POST /api/dashboard/users/invite
router.get("/:id", getUser);              // GET /api/dashboard/users/:id
router.post("/", createUser);             // POST /api/dashboard/users
router.put("/:id", updateUser);           // PUT /api/dashboard/users/:id
router.delete("/:id", deleteUser);        // DELETE /api/dashboard/users/:id

export default router;
