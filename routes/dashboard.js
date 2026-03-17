import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

// -------------------------------------------------
// GET ALL USERS (for dashboard)
// -------------------------------------------------
router.get("/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true
      }
    });

    res.json(users);
  } catch (err) {
    console.error("❌ Error fetching users", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Export the router
export default router;
