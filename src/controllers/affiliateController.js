/**
 * affiliateController.js
 */

import { ok, fail } from '../utils/responses.js';
import express from "express";
import { createAffiliate, getAffiliateByCode, recordClick, getAffiliateStats, recordConversion } from "../services/affiliateService.js";
import prisma from "../prismaClient.js";

const router = express.Router();

export const affiliateController = {
  async registerAffiliate(req, res) {
    try {
      const { email, name } = req.body;

      const affiliate = await prisma.affiliate.create({
        data: {
          email,
          name,
          referralCode: Math.random().toString(36).substring(2, 10)
        }
      });

      return ok(res, { affiliate });
    } catch (err) {
      return fail(res, 500, err.message);
    }
  },

  async trackClick(req, res) {
    try {
      const { code } = req.params;

      await prisma.affiliateClick.create({
        data: { code }
      });

      res.redirect(process.env.URL_DEV_FRONTEND);
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }
};

// Apply to become affiliate (public)

router.post("/register", async (req, res) => {
  try {
    const { firstname, lastname, email, phone, address, country, iban } = req.body;
    const aff = await prisma.affiliate.create({ data: { code: `AFF${Math.random().toString(36).slice(2,8).toUpperCase()}`, name: `${firstname} ${lastname}`, email, iban, createdAt: new Date() }});
    return ok(res, { affiliate: aff });
  } catch (err) { console.error(err); return fail(res, 500, err.message); }
});

router.post("/apply", async (req, res) => {
  try {
    const { name, email, ownerId } = req.body;
    const aff = await createAffiliate({ name, email, ownerId });
    res.json({ ok: true, affiliate: aff });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// Tracking route to be used in QR / NFC redirect or affiliate links.
// Example: GET /api/affiliate/track?code=AFFXYZ&redirect=/somewhere
router.get("/track", async (req, res) => {
  try {
    const { code, redirect: redirectTo } = req.query;
    const aff = await getAffiliateByCode(code);
    if (!aff) return res.redirect(redirectTo || (process.env.URL_DEV_FRONTEND || "/"));
    // set cookie for 30 days
    res.cookie("krootal_aff", code, { maxAge: 30*24*60*60*1000, httpOnly: false });
    // record click
    await recordClick({ affiliateId: aff.id, ip: req.ip, userAgent: req.get("user-agent"), referer: req.get("referer"), cookie: req.headers.cookie || null });
    return res.redirect(redirectTo || (process.env.URL_DEV_FRONTEND || "/"));
  } catch (err) { console.error(err); return res.redirect(process.env.URL_DEV_FRONTEND || "/"); }
});

// Simple route used by /r/:code redirect (legacy)
router.get("/:code", async (req, res) => {
  try {
    const code = req.params.code;
    const aff = await getAffiliateByCode(code);
    if (!aff) return res.redirect(process.env.URL_DEV_FRONTEND || "/");
    await recordClick({ affiliateId: aff.id, ip: req.ip, userAgent: req.get("user-agent"), referer: req.get("referer"), cookie: req.headers.cookie || null });
    res.cookie("krootal_aff", code, { maxAge: 30*24*60*60*1000, httpOnly: false });
    res.redirect(process.env.URL_DEV_FRONTEND || "/");
  } catch (err) { console.error(err); res.redirect(process.env.URL_DEV_FRONTEND || "/"); }
});

router.get("/status/:affiliateId", async (req, res) => {
  try {
    const aff = await prisma.affiliate.findUnique({ where: { id: req.params.affiliateId }});
    if (!aff) return fail(res, 404, "affiliate not found");
    return ok(res, { affiliate: aff });
  } catch (err) { console.error(err); return fail(res, 500, err.message); }
});

// Affiliate dashboard data (protected for owner/admin)
router.get("/:code/dashboard", async (req, res) => {
  try {
    const code = req.params.code;
    const aff = await getAffiliateByCode(code);
    if (!aff) return res.status(404).json({ error: "Affiliate not found" });
    const stats = await getAffiliateStats(aff.id);
    res.json({ affiliate: aff, stats });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

export default router;