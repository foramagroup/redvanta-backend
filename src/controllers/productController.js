/**
 * productController.js
 * CRUD product + Stripe sync + upsells
 */

import express from "express";
import prisma from "../config/database.js";
import stripe from "../config/stripe.js";
import { ok, fail } from "../utils/responses.js";

const router = express.Router();

/**
 * GET /api/products
 */
router.get("/", async (req, res) => {
  try {
    const items = await prisma.product.findMany({
      orderBy: { createdAt: "desc" }
    });
    return ok(res, { items });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

/**
 * GET /api/products/:slug
 */
router.get("/:slug", async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { slug: req.params.slug }
    });

    if (!product) return fail(res, 404, "Produit introuvable");

    return ok(res, { product });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

/**
 * POST /api/products
 * Create product + Stripe sync
 */
router.post("/", async (req, res) => {
  try {
    const { name, slug, description, price, upsellPriceCents } = req.body;

    // Stripe product
    const stripeProduct = await stripe.products.create({
      name,
      description: description || ""
    });

    const stripePrice = await stripe.prices.create({
      product: stripeProduct.id,
      unit_amount: Math.round(price * 100), // convert € → cents
      currency: "eur"
    });

    const product = await prisma.product.create({
      data: {
        name,
        slug,
        description,
        price,
        upsellPriceCents: upsellPriceCents || null,
        stripeProductId: stripeProduct.id,
        stripePriceId: stripePrice.id
      }
    });

    return ok(res, { product });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

/**
 * PUT /api/products/:id
 */
router.put("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);

    const product = await prisma.product.update({
      where: { id },
      data: req.body
    });

    return ok(res, { product });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

/**
 * DELETE /api/products/:id
 */
router.delete("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);

    await prisma.product.delete({ where: { id } });

    return ok(res, { message: "Produit supprimé" });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

export default router;
