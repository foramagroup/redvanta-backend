import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function listPrices(req, res) {
  try {
    const prices = await stripe.prices.list({ limit: 10, expand: ['data.product'] });
    const mapped = prices.data.map(p => ({ priceId: p.id, unit_amount: p.unit_amount, currency: p.currency, name: p.product.name || p.product.id }));
    res.json(mapped);
  } catch (err) {
    console.error("listPrices", err);
    res.status(500).json({ error: "stripe error" });
  }
}
