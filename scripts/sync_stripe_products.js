// backend/scripts/sync_stripe_products.js
import dotenv from 'dotenv';
dotenv.config();
import Stripe from "stripe";
import prisma from "../src/config/prisma.js";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function sync() {
  const products = await prisma.product.findMany();
  for (const p of products) {
    if (!p.stripeProductId) {
      const sp = await stripe.products.create({ name: p.title, description: p.description || "" });
      await prisma.product.update({ where: { id: p.id }, data: { stripeProductId: sp.id }});
    }
    if (!p.stripePriceId) {
      const pr = await stripe.prices.create({ unit_amount: p.priceCents, currency: p.currency || 'eur', product: p.stripeProductId });
      await prisma.product.update({ where: { id: p.id }, data: { stripePriceId: pr.id }});
    }
  }
  console.log("Stripe sync done");
}

sync().catch(err => { console.error(err); process.exit(1); });
