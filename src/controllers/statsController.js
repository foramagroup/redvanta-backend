// backend/src/controllers/statsController.js
import * as statsService from "../services/statsService.js";
import prisma from "../config/prisma.js";

export async function scanRedirect(req, res) {
  const tagId = req.params.tagId;
  try {
    const tag = await prisma.nFCTag.findUnique({ where: { id: tagId }});
    if (!tag) return res.status(404).send("Tag not found");

    // log scan (async)
    await statsService.logScan(tagId, req);

    // redirect to design view if assigned
    if (!tag.designId) return res.redirect(`${process.env.FRONT_URL}/nfc/not-assigned`);
    return res.redirect(`${process.env.FRONT_URL}/design/view/${tag.designId}`);
  } catch (err) {
    console.error("scanRedirect", err);
    res.status(500).send("error");
  }
}

export async function tagStats(req, res) {
  try {
    const tagId = req.params.tagId;
    const days = req.query.days || 30;
    const data = await statsService.getScansSummary(tagId, days);
    res.json(data);
  } catch (err) {
    console.error("tagStats", err);
    res.status(500).json({ error: "server error" });
  }
}

export async function myTopTags(req, res) {
  try {
    const rows = await statsService.getTopTagsByClicks(req.user.id);
    res.json({ items: rows });
  } catch (err) {
    console.error("myTopTags", err);
    res.status(500).json({ error: "server error" });
  }
}

export async function exportCsv(req, res) {
  try {
    const tagId = req.params.tagId;
    const csv = await statsService.exportScansCsv(tagId);
    res.setHeader("Content-disposition", `attachment; filename=scanlog_${tagId}.csv`);
    res.setHeader("Content-Type", "text/csv");
    res.send(csv);
  } catch (err) {
    console.error("exportCsv", err);
    res.status(500).json({ error: "export failed" });
  }
}
