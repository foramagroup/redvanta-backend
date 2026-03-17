import prisma from "../config/prisma.js";
import { v4 as uuidv4 } from "uuid";
import QRCode from "qrcode";
import path from "path";
import fs from "fs/promises";
import geoip from "geoip-lite";
import { Parser } from "json2csv";

/* ------------------------
   UTIL: generate QR code
------------------------ */
async function generateQrFile(tagId, url) {
  const folder = path.join(process.cwd(), "uploads", "qrcodes");
  await fs.mkdir(folder, { recursive: true });
  const file = `qr_${tagId}.png`;
  const filepath = path.join(folder, file);
  await QRCode.toFile(filepath, url, { margin: 1, scale: 6 });
  return file;
}

/* ------------------------
   NEW CONTROLLERS
------------------------ */
export async function createTag(req, res) {
  try {
    const { userId, designId, payloadUrl } = req.body;
    const uid = uuidv4().replace(/-/g, "").slice(0, 16).toUpperCase();
    const payload = payloadUrl || `${process.env.FRONT_URL || "http://localhost:3000"}/r?uid=${uid}`;

    const tag = await prisma.nFCTag.create({
      data: {
        id: uuidv4(),
        uid,
        payload,
        designId: designId || null,
        userId: userId || (req.user ? req.user.id : null),
      },
    });

    const qrFile = await generateQrFile(tag.id, payload);
    await prisma.nFCTag.update({ where: { id: tag.id }, data: { qrCodeFile: qrFile } });

    res.json({ ok: true, tag });
  } catch (err) {
    console.error("createTag", err);
    res.status(500).json({ ok: false, error: "create failed" });
  }
}

export async function listTags(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(10, parseInt(req.query.limit || "20", 10));
    const q = (req.query.q || "").trim();

    const where = q ? { OR: [{ uid: { contains: q } }, { payload: { contains: q } }] } : {};

    const [items, total] = await Promise.all([
      prisma.nFCTag.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, email: true, name: true } }, design: true },
      }),
      prisma.nFCTag.count({ where }),
    ]);

    res.json({ ok: true, data: items, meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (err) {
    console.error("listTags", err);
    res.status(500).json({ ok: false, error: "list failed" });
  }
}

export async function getTag(req, res) {
  try {
    const id = req.params.id;
    const tag = await prisma.nFCTag.findUnique({
      where: { id },
      include: { user: { select: { id, email, name } }, design: true, scans: { orderBy: { createdAt: "desc" }, take: 200 } },
    });
    if (!tag) return res.status(404).json({ ok: false, error: "not found" });
    res.json({ ok: true, data: tag });
  } catch (err) {
    console.error("getTag", err);
    res.status(500).json({ ok: false, error: "get failed" });
  }
}

export async function updateTag(req, res) {
  try {
    const id = req.params.id;
    const data = {};
    if (req.body.designId !== undefined) data.designId = req.body.designId;
    if (req.body.payload !== undefined) data.payload = req.body.payload;

    const updated = await prisma.nFCTag.update({ where: { id }, data });
    res.json({ ok: true, data: updated });
  } catch (err) {
    console.error("updateTag", err);
    res.status(500).json({ ok: false, error: "update failed" });
  }
}

export async function deleteTag(req, res) {
  try {
    await prisma.nFCTag.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error("deleteTag", err);
    res.status(500).json({ ok: false, error: "delete failed" });
  }
}

export async function logScan(req, res) {
  try {
    const uid = req.body.uid || req.query.uid || req.params.uid;
    if (!uid) return res.status(400).json({ ok: false, error: "Missing uid" });

    const tag = await prisma.nFCTag.findUnique({ where: { uid } });
    if (!tag) return res.status(404).json({ ok: false, error: "Tag not found" });

    const ip = (req.headers['x-forwarded-for'] || req.connection?.remoteAddress || req.ip || '').toString();
    const geo = geoip.lookup(ip) || {};

    await prisma.scanLog.create({
      data: {
        id: uuidv4(),
        nfcTagId: tag.id,
        ip,
        agent: req.headers['user-agent'] || null,
        city: geo.city || null,
        country: geo.country || null,
        lat: geo.ll ? geo.ll[0] : null,
        lon: geo.ll ? geo.ll[1] : null,
      },
    });

    const redirectUrl = tag.payload || (tag.designId ? `${process.env.FRONT_URL}/design/${tag.designId}` : process.env.FRONT_URL || "/");
    if (req.headers.accept?.includes("application/json")) return res.json({ ok: true, redirect: redirectUrl });

    res.redirect(302, redirectUrl);
  } catch (err) {
    console.error("logScan", err);
    res.status(500).json({ ok: false, error: "log failed" });
  }
}

export async function getQrFile(req, res) {
  try {
    const id = req.params.id;
    const tag = await prisma.nFCTag.findUnique({ where: { id } });
    if (!tag || !tag.qrCodeFile) return res.status(404).send("QR not found");

    const file = path.join(process.cwd(), "uploads", "qrcodes", tag.qrCodeFile);
    res.sendFile(file);
  } catch (err) {
    console.error("getQrFile", err);
    res.status(500).send("error");
  }
}

export async function exportTagsCsv(req, res) {
  try {
    const tags = await prisma.nFCTag.findMany({ orderBy: { createdAt: "desc" } });
    const parser = new Parser({ fields: ["id", "uid", "payload", "designId", "userId", "createdAt"] });
    const csv = parser.parse(tags);

    res.header("Content-Type", "text/csv");
    res.attachment(`nfc_tags_${Date.now()}.csv`);
    res.send(csv);
  } catch (err) {
    console.error("exportTagsCsv", err);
    res.status(500).json({ ok: false, error: "export failed" });
  }
}

/* ------------------------
   OLD / LEGACY CONTROLLERS
------------------------ */
export async function create(req, res) {
  try {
    const { designId } = req.body;
    const userId = req.user.id;
    const tag = await prisma.nFCTag.create({ data: { designId, userId } });
    const qrUrl = `${process.env.FRONT_URL}/nfc/${tag.id}`;
    const qrFile = await generateQrFile(tag.id, qrUrl);
    await prisma.nFCTag.update({ where: { id: tag.id }, data: { qrCodeFile: qrFile } });
    res.json({ ok: true, tagId: tag.id });
  } catch (err) {
    console.error("create", err);
    res.status(500).json({ error: "Failed to create tag" });
  }
}

export async function mine(req, res) {
  try {
    const list = await prisma.nFCTag.findMany({ where: { userId: req.user.id }, include: { design: true } });
    res.json(list);
  } catch (err) {
    console.error("mine", err);
    res.status(500).json({ error: "Unable to load tags" });
  }
}

export async function updateDesign(req, res) {
  try {
    const id = req.params.id;
    const { designId } = req.body;
    const tag = await prisma.nFCTag.findUnique({ where: { id } });
    if (!tag || tag.userId !== req.user.id) return res.status(403).json({ error: "Forbidden" });
    const updated = await prisma.nFCTag.update({ where: { id }, data: { designId } });
    res.json(updated);
  } catch (err) {
    console.error("updateDesign", err);
    res.status(500).json({ error: "Update failed" });
  }
}

export async function adminList(req, res) {
  try {
    const items = await prisma.nFCTag.findMany({ include: { design: true, user: true } });
    res.json(items);
  } catch (err) {
    console.error("adminList", err);
    res.status(500).json({ error: "Unable to load tags" });
  }
}

export async function scanRedirect(req, res) {
  try {
    const tagId = req.params.tagId;
    const tag = await prisma.nFCTag.findUnique({ where: { id: tagId }, include: { design: true } });
    if (!tag) return res.status(404).send("Invalid tag");
    await prisma.scanLog.create({ data: { nfcTagId: tag.id, ip: req.ip, agent: req.headers['user-agent'] } });
    if (!tag.designId) return res.redirect("/not-assigned");
    res.redirect(`/design/view/${tag.designId}`);
  } catch (err) {
    console.error("scanRedirect", err);
    res.status(500).send("Scan failed");
  }
}

/* ------------------------
   EXPORT ALIAS FOR DASHBOARD
------------------------ */
export { getTag as getNfcTagDetail };
