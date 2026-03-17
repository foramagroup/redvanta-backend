// backend/src/controllers/affiliateRegisterController.js
import express from "express";
import prisma from "../prismaClient.js";
import { ok, fail } from "../utils/responses.js";
import { v4 as uuid } from "uuid";

const router = express.Router();

/**
 * POST /api/affiliate/register
 */
router.post("/", async (req, res) => {
  try {
    const { firstname, lastname, email, phone, address, country, iban } = req.body;

    const affiliate = await prisma.affiliate.create({
      data: {
        id: uuid(),
        firstname,
        lastname,
        email,
        phone,
        address,
        country,
        iban,
        code: `AFF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        createdAt: new Date(),
      }
    });

    return ok(res, { affiliate });
  } catch (err) {
    console.error(err);
    return fail(res, 500, err.message);
  }
});

export default router;
