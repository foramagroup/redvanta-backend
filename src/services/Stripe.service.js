

import Stripe  from "stripe";
import prisma  from "../config/database.js";

let _stripeInstance = null;
let _lastLoadedAt   = null;
const CACHE_MS = 5 * 60 * 1000;



async function loadStripeGateway() {
  const gateway = await prisma.paymentGateway.findFirst({
    where: {
      provider: { in: ["stripe", "Stripe", "STRIPE"] },
      status:   "Active",
      isDefault: true,
    },
  });

  // Fallback sur le premier gateway Stripe actif
  if (!gateway) {
    const fallback = await prisma.paymentGateway.findFirst({
      where: {
        provider: { in: ["stripe", "Stripe", "STRIPE"] },
        status:   "Active",
      },
    });
    return fallback;
  }

  return gateway;
}

export async function getStripe() {
  const now = Date.now();

  // Recharger si pas encore chargé ou cache expiré
  if (!_stripeInstance || !_lastLoadedAt || now - _lastLoadedAt > CACHE_MS) {
    const gateway = await loadStripeGateway();

    const secretKey = gateway?.secretKey || process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      throw Object.assign(
        new Error("Aucune clé Stripe configurée (ni en DB ni dans .env)"),
        { status: 503 }
      );
    }

    _stripeInstance = new Stripe(secretKey);
    _lastLoadedAt   = now;

    console.log(`[stripe] Instance chargée depuis ${gateway ? "DB (gateway id=" + gateway.id + ")" : ".env"} — mode: ${gateway?.mode ?? "env"}`);
  }

  return _stripeInstance;
}


export async function getWebhookSecret() {
  const gateway = await loadStripeGateway();
  return gateway?.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET;
}


export async function getGatewayInfo() {
  const gateway = await loadStripeGateway();
  return {
    fromDb:    !!gateway,
    mode:      gateway?.mode ?? (process.env.STRIPE_SECRET_KEY?.startsWith("sk_live") ? "live" : "test"),
    provider:  "stripe",
    currencies: gateway?.currencies ?? "all",
    fees:       gateway?.fees ?? null,
  };
}

export function invalidateStripeCache() {
  _stripeInstance = null;
  _lastLoadedAt   = null;
  console.log("[stripe] Cache invalidé — sera rechargé au prochain appel");
}