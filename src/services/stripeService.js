// src/services/stripeService.js
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY), { apiVersion: "2022-11-15" });

export const createCheckoutSession = async ({ items, successUrl, cancelUrl }) => {
  return await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: items,
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl
  });
};

export const verifyWebhook = (rawBody, signature) => {
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );
};

export async function createProductWithPrice({ name, description, unit_amount, currency = "eur" }) {
  const product = await stripe.products.create({ name, description });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount,
    currency
  });
  return { product, price };
}
