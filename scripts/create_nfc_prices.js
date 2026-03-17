import Stripe from "stripe";
import fs from "fs";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function run() {
  const tiers = [{ name: "Tag basic", price: 1990 }, { name: "Tag premium", price: 2990 }];
  for (const t of tiers) {
    const product = await stripe.products.create({ name: t.name });
    const price = await stripe.prices.create({ product: product.id, unit_amount: t.price, currency: "eur" });
    console.log("Created", t.name, product.id, price.id);
  }
}

run().catch(console.error);
