// backend/src/routes/userRoutes.js
import express from "express";
import prisma from "../prismaClient.js";
import { ok, fail } from "../utils/responses.js";

const router = express.Router();

// GET /api/users/me (example)
router.get("/me", async (req, res) => {
  try {
    if (!req.user) return fail(res, 401, "Not authenticated");
    const user = await prisma.user.findUnique({ where: { id: req.user.id }});
    return ok(res, { user });
  } catch (err) { console.error(err); return fail(res, 500, err.message); }
});

export default router;
