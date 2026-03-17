// backend/src/controllers/stripeConnectController.js
import express from "express";
import stripe from "../config/stripe.js";
import prisma from "../prismaClient.js";
import { v4 as uuidv4 } from "uuid";
import { ok, fail } from "../utils/responses.js";

const router = express.Router();

/**
 * POST /api/affiliate/connect/create
 * body: { country, type }  (type: express | standard)
 * Retourne : { accountId, url } -> rediriger l'utilisateur vers url
 */
router.post("/create", async (req, res) => {
  try {
    const { country = "FR", type = "express", refresh_url, return_url } = req.body;
    // create Stripe account
    const account = await stripe.accounts.create({
      type,
      country,
      business_type: "individual",
      capabilities: { transfers: { requested: true } }
    });

    // create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: refresh_url || `${process.env.URL_DEV_FRONTEND || "http://localhost:3000"}/affiliate/onboard/retry`,
      return_url: return_url || `${process.env.URL_DEV_FRONTEND || "http://localhost:3000"}/affiliate/onboard/complete`,
      type: "account_onboarding"
    });

    // optionally save stripeAccountId to affiliate when affiliate is authenticated
    const ownerId = req.user ? req.user.id : null;
    // If user has affiliate record we store it; else return accountId to frontend to attach later
    if (ownerId) {
      // try to find affiliate by ownerId
      const aff = await prisma.affiliate.findFirst({ where: { ownerId } });
      if (aff) {
        await prisma.affiliate.update({ where: { id: aff.id }, data: { stripeAccountId: account.id } });
      }
    }

    return ok(res, { accountId: account.id, url: accountLink.url });
  } catch (err) {
    console.error("stripe connect create error", err);
    return fail(res, 500, err.message);
  }
});

/**
 * POST /api/affiliate/connect/attach
 * body: { affiliateId, stripeAccountId }
 * Permet d'attacher un accountId manuellement (par ex après OAuth)
 */
router.post("/attach", async (req, res) => {
  try {
    const { affiliateId, stripeAccountId } = req.body;
    if (!affiliateId || !stripeAccountId) return fail(res, 400, "affiliateId & stripeAccountId required");
    const aff = await prisma.affiliate.update({ where: { id: affiliateId }, data: { stripeAccountId } });
    return ok(res, { affiliate: aff });
  } catch (err) { console.error(err); return fail(res, 500, err.message); }
});

/**
 * GET /api/affiliate/connect/status/:affiliateId
 * Retourne les informations Stripe account (charges_enabled, payouts_enabled)
 */
router.get("/status/:affiliateId", async (req, res) => {
  try {
    const { affiliateId } = req.params;
    const aff = await prisma.affiliate.findUnique({ where: { id: affiliateId } });
    if (!aff || !aff.stripeAccountId) return fail(res, 404, "Affiliate or stripeAccountId not found");
    const account = await stripe.accounts.retrieve(aff.stripeAccountId);
    return ok(res, { account: { id: account.id, charges_enabled: account.charges_enabled, payouts_enabled: account.payouts_enabled } });
  } catch (err) { console.error(err); return fail(res, 500, err.message); }
});

export default router;
