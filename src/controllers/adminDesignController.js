// backend/src/controllers/adminDesignController.js
import prisma from "../config/prisma.js";
import { createPdfFromImages } from "../utils/pdfExport.js";
import { saveBase64Image } from "../utils/saveBase64Image.js";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";

/**
 * Admin controller for designs:
 * - list
 * - get
 * - update (patch)
 * - remove
 * - exportPdf
 */

const pageSize = 50;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ----- LIST -----
async function list(req, res) {
  const designs = await prisma.design.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });

  res.json({ designs });
}

// ----- DOWNLOAD -----
async function download(req, res) {
  const id = parseInt(req.params.id);
  const design = await prisma.design.findUnique({ where: { id } });

  if (!design) return res.status(404).json({ error: "Not found" });

  const filePath = path.join(__dirname, "../uploads/", design.file);
  const watermarked = path.join(
    __dirname,
    "../uploads/",
    `admin_wm_${design.file}`
  );

  await sharp(filePath)
    .composite([
      {
        input: Buffer.from(`
          <svg width="600" height="200">
            <text x="10" y="150" font-size="80" fill="rgba(255,0,0,0.3)">
              ADMIN EXPORT
            </text>
          </svg>
        `),
        gravity: "center",
      },
    ])
    .png()
    .toFile(watermarked);

  res.download(watermarked, design.file, () => {
    setTimeout(() => fs.unlinkSync(watermarked), 2000);
  });
}

// ----- REMOVE -----
async function remove(req, res) {
  const id = parseInt(req.params.id);

  const design = await prisma.design.findUnique({ where: { id } });
  if (!design) return res.status(404).json({ error: "Not found" });

  const filePath = path.join(__dirname, "../uploads/", design.file);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  await prisma.design.delete({ where: { id } });

  res.json({ success: true });
}

export default {
  // GET /api/admin/designs?skip=0&take=50&search=
  list: async (req, res) => {
    try {
      const skip = Number(req.query.skip || 0);
      const take = Math.min(Number(req.query.take || pageSize), 200);
      const where = {};
      if (req.query.search) {
        where.OR = [
          { title: { contains: req.query.search } },
          { id: { contains: req.query.search } }
        ];
      }
      const [items, total] = await Promise.all([
        prisma.design.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
        prisma.design.count({ where })
      ]);
      res.json({ items, total, skip, take });
    } catch (err) {
      console.error("adminDesign.list", err);
      res.status(500).json({ error: "server error" });
    }
  },

  get: async (req, res) => {
    try {
      const id = req.params.id;
      const design = await prisma.design.findUnique({ where: { id }});
      if (!design) return res.status(404).json({ error: "Design not found" });
      res.json({ design });
    } catch (err) {
      console.error("adminDesign.get", err);
      res.status(500).json({ error: "server error" });
    }
  },

  update: async (req, res) => {
    try {
      const id = req.params.id;
      const payload = {};
      const allowed = ["title", "jsonFront", "jsonBack", "frontFile", "backFile", "thumbnail", "costCents", "upsellEnabled", "upsellPriceCents"];
      for (const k of allowed) if (k in req.body) payload[k] = req.body[k];

      const updated = await prisma.design.update({ where: { id }, data: { ...payload, updatedAt: new Date() } });
      res.json({ ok: true, design: updated });
    } catch (err) {
      console.error("adminDesign.update", err);
      res.status(500).json({ error: "update failed" });
    }
  },

  remove: async (req, res) => {
    try {
      const id = req.params.id;
      // remove files if present
      const d = await prisma.design.findUnique({ where: { id }});
      if (!d) return res.status(404).json({ error: "Design not found" });

      // delete DB record
      await prisma.design.delete({ where: { id }});

      // delete files
      const files = [d.frontFile, d.backFile, d.thumbnail].filter(Boolean);
      for (const f of files) {
        const full = path.join(process.cwd(), "uploads", "customizations", f);
        try { await fs.unlink(full); } catch (e) { /* ignore */ }
      }

      res.json({ ok: true });
    } catch (err) {
      console.error("adminDesign.remove", err);
      res.status(500).json({ error: "remove failed" });
    }
  },

  exportPdf: async (req, res) => {
    try {
      const id = req.params.id;
      const design = await prisma.design.findUnique({ where: { id }});
      if (!design) return res.status(404).json({ error: "Design not found" });

      // produce two images: either from stored frontFile/backFile or from json saved
      const tmpSaved = [];
      if (design.frontFile) tmpSaved.push(path.join(process.cwd(), "uploads", "customizations", design.frontFile));
      if (design.backFile) tmpSaved.push(path.join(process.cwd(), "uploads", "customizations", design.backFile));

      if (tmpSaved.length === 0 && (design.jsonFront || design.jsonBack)) {
        // If only JSON exists, cannot render images server-side easily without headless fabric,
        // but if previously we saved image previews (thumbnail) we can use them.
        if (design.thumbnail) tmpSaved.push(path.join(process.cwd(), "uploads", "customizations", design.thumbnail));
      }

      if (tmpSaved.length === 0) return res.status(400).json({ error: "No images to export" });

      const pdfFilename = await createPdfFromImages(tmpSaved, { dpi: 300, bleedMm: 3, orderId: id });
      res.json({ ok: true, filename: pdfFilename });
    } catch (err) {
      console.error("adminDesign.exportPdf", err);
      res.status(500).json({ error: "export failed" });
    }
  }
};

export default { list, download, remove };
