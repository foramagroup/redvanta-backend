// backend/src/controllers/adminAffiliateController.js
import express from "express";
import { ok, fail } from "../utils/responses.js";
import {
  listAffiliates,
  createAffiliate,
  updateAffiliate,
  deleteAffiliate,
  getAffiliateDetail,
  exportAffiliatesCSV
} from "../services/affiliateAdminService.js";

const router = express.Router();

/**
 * GET /api/admin/affiliates
 * Query: ?skip=0&take=50
 */
router.get("/", async (req, res) => {
  try {
    const skip = Number(req.query.skip || 0);
    const take = Number(req.query.take || 50);
    const items = await listAffiliates({ skip, take });
    return ok(res, { items });
  } catch (err) {
    console.error(err);
    return fail(res, 500, err.message);
  }
});

/**
 * POST /api/admin/affiliates
 * body: { name, email, ownerId? }
 */
router.post("/", async (req, res) => {
  try {
    const { name, email, ownerId } = req.body;
    const item = await createAffiliate({ name, email, ownerId });
    return ok(res, { affiliate: item });
  } catch (err) { console.error(err); return fail(res, 500, err.message); }
});

/**
 * GET /api/admin/affiliates/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const detail = await getAffiliateDetail(id);
    if (!detail) return fail(res, 404, "Affiliate not found");
    return ok(res, { ...detail });
  } catch (err) { console.error(err); return fail(res, 500, err.message); }
});

/**
 * PUT /api/admin/affiliates/:id
 */
router.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const data = req.body;
    const updated = await updateAffiliate(id, data);
    return ok(res, { affiliate: updated });
  } catch (err) { console.error(err); return fail(res, 500, err.message); }
});

/**
 * DELETE /api/admin/affiliates/:id
 */
router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await deleteAffiliate(id);
    return ok(res, { deleted: true });
  } catch (err) { console.error(err); return fail(res, 500, err.message); }
});

/**
 * GET /api/admin/affiliates/:id/export-clicks
 * export clicks CSV for affiliate
 */
router.get("/:id/export-clicks", async (req, res) => {
  try {
    const id = req.params.id;
    // reuse prisma directly for CSV rows
    const clicks = await (await import("../prismaClient.js")).default.click.findMany({ where: { affiliateId: id } });
    // simple csv building:
    const rows = clicks.map(c => ({
      id: c.id, ip: c.ip || "", userAgent: c.userAgent ? c.userAgent.substring(0, 300) : "", referer: c.referer || "", cookie: c.cookie || "", createdAt: c.createdAt.toISOString()
    }));
    // convert to CSV string
    const { Parser } = await import("json2csv");
    const csv = new Parser().parse(rows);
    res.header("Content-Type", "text/csv");
    res.attachment(`clicks_${id}.csv`);
    return res.send(csv);
  } catch (err) { console.error(err); return fail(res, 500, err.message); }
});

/**
 * GET /api/admin/affiliates/export
 * export all affiliates CSV
 */
router.get("/export/all", async (req, res) => {
  try {
    const csv = await exportAffiliatesCSV();
    res.header("Content-Type", "text/csv");
    res.attachment("affiliates.csv");
    return res.send(csv);
  } catch (err) { console.error(err); return fail(res, 500, err.message); }
});

export default router;
