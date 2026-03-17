// backend/src/lib/stripe.js
import Stripe from "stripe";
import prisma from "../config/prisma.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET, { apiVersion: "2024-08-01" });

export async function syncStripeProduct(localProduct) {
  // localProduct can be object or id
  let p = localProduct;
  if (typeof localProduct === "string") {
    p = await prisma.product.findUnique({ where: { id: localProduct } });
  }

  if (!p) throw new Error("Product not found for stripe sync");

  // if we already have stripeProductId -> create a new price
  if (p.stripeProductId) {
    const price = await stripe.prices.create({
      product: p.stripeProductId,
      unit_amount: Math.round(Number(p.price) * 100),
      currency: p.currency || "eur"
    });
    await prisma.product.update({ where: { id: p.id }, data: { stripePriceId: price.id } });
    return { stripeProductId: p.stripeProductId, stripePriceId: price.id };
  }

  // otherwise create product+price
  const sp = await stripe.products.create({ name: p.title, description: p.description || undefined });
  const price = await stripe.prices.create({
    product: sp.id,
    unit_amount: Math.round(Number(p.price) * 100),
    currency: p.currency || "eur"
  });

  await prisma.product.update({
    where: { id: p.id },
    data: { stripeProductId: sp.id, stripePriceId: price.id }
  });

  return { stripeProductId: sp.id, stripePriceId: price.id };
}

export default stripe;
