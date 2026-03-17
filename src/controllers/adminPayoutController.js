// backend/src/controllers/adminPayoutController.js
import express from "express";
import {
  createPayoutRequest,
  approveAndProcessPayout,
  declinePayout,
  listPayoutRequests,
  getPayoutDetail
} from "../services/payoutService.js";
import { ok, fail } from "../utils/responses.js";

const router = express.Router();

/**
 * POST /api/admin/payouts/request
 * body: { affiliateId, amountCents, currency, note }
 * (admin can create on behalf of affiliate OR affiliate can create via public endpoint)
 */
router.post("/request", async (req, res) => {
  try {
    const { affiliateId, amountCents, currency, note } = req.body;
    const r = await createPayoutRequest({ affiliateId, amountCents, currency, note });
    return ok(res, { payout: r });
  } catch (err) { console.error(err); return fail(res, 500, err.message); }
});

/**
 * GET /api/admin/payouts
 */
router.get("/", async (req, res) => {
  try {
    const skip = Number(req.query.skip || 0);
    const take = Number(req.query.take || 50);
    const list = await listPayoutRequests({ skip, take });
    return ok(res, { items: list });
  } catch (err) { console.error(err); return fail(res, 500, err.message); }
});

/**
 * GET /api/admin/payouts/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const p = await getPayoutDetail(id);
    if (!p) return fail(res, 404, "Not found");
    return ok(res, { payout: p });
  } catch (err) { console.error(err); return fail(res, 500, err.message); }
});

/**
 * POST /api/admin/payouts/:id/approve
 */
router.post("/:id/approve", async (req, res) => {
  try {
    const id = req.params.id;
    const result = await approveAndProcessPayout(id, req.user);
    return ok(res, { result });
  } catch (err) { console.error(err); return fail(res, 500, err.message); }
});

/**
 * POST /api/admin/payouts/:id/decline
 * body: { reason }
 */
router.post("/:id/decline", async (req, res) => {
  try {
    const id = req.params.id;
    const reason = req.body.reason || null;
    await declinePayout(id, reason);
    return ok(res, { declined: true });
  } catch (err) { console.error(err); return fail(res, 500, err.message); }
});

/**
 * GET /api/admin/payouts/export
 * export all payouts as CSV
 */
router.get("/export", async (req, res) => {
  try {
    const items = await (await import("../prismaClient.js")).default.payoutRequest.findMany({ include: { affiliate: true } });
    const rows = items.map(p => ({
      id: p.id,
      affiliateId: p.affiliateId,
      affiliateCode: p.affiliate ? p.affiliate.code : "",
      amountCents: p.amountCents,
      currency: p.currency,
      status: p.status,
      stripeTransferId: p.stripeTransferId || "",
      requestedAt: p.requestedAt.toISOString(),
      processedAt: p.processedAt ? p.processedAt.toISOString() : ""
    }));

    const { Parser } = await import("json2csv");
    const csv = new Parser().parse(rows);
    res.header("Content-Type", "text/csv");
    res.attachment("payouts.csv");
    return res.send(csv);
  } catch (err) { console.error(err); return fail(res, 500, err.message); }
});

export default router;
