import prisma from "../config/prisma.js";
import JSZip from "jszip";
import fs from "fs/promises";
import path from "path";

export async function listBatches(req, res) {
  if (req.user.role !== "ADMIN") return res.status(403).json({ error: "forbidden" });

  const items = await prisma.nfcBatch.findMany({
    orderBy: { createdAt: "desc" },
  });

  res.json(items);
}

export async function downloadBatchZip(req, res) {
  if (req.user.role !== "ADMIN") return res.status(403).json({ error: "forbidden" });

  const { batchId } = req.params;
  const batch = await prisma.nfcBatch.findUnique({ where: { id: batchId } });

  if (!batch) return res.status(404).json({ error: "Batch not found" });

  const zip = new JSZip();
  const folderPath = path.join(process.cwd(), "uploads", "qr-batches", batchId);

  const files = await fs.readdir(folderPath);
  for (const f of files) {
    const filePath = path.join(folderPath, f);
    const content = await fs.readFile(filePath);
    zip.file(f, content);
  }

  const zipContent = await zip.generateAsync({ type: "nodebuffer" });

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="batch_${batchId}.zip"`);
  res.send(zipContent);
}
