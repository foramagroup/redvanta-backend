// backend/src/utils/pdfExport.js
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

/**
 * savedFiles: array of absolute image paths (png)
 * options: { dpi, bleedMm, orderId }
 * returns filename (relative to uploads)
 */
export async function createPdfFromImages(savedFiles, { dpi = 300, bleedMm = 3, orderId = "o" } = {}) {
  // convert bleed mm to px at dpi
  const bleedPx = Math.round((dpi / 25.4) * bleedMm);

  // create temporary resized images to target DPI and add bleed background
  const tmpPaths = [];
  for (const f of savedFiles) {
    const img = sharp(f);
    const metadata = await img.metadata();
    // scale factor multiplier to reach desired DPI relative to 72
    const multiplier = dpi / 72;
    const outPath = path.join(process.cwd(), "uploads", "tmp", `pdf_${uuidv4()}.png`);
    await fs.mkdir(path.dirname(outPath), { recursive: true });

    // resize image based on multiplier and add bleed (extend)
    const w = Math.round((metadata.width || 1000) * multiplier) + bleedPx * 2;
    const h = Math.round((metadata.height || 1000) * multiplier) + bleedPx * 2;

    await img
      .resize(Math.round((metadata.width || 1000) * multiplier))
      .extend({ top: bleedPx, bottom: bleedPx, left: bleedPx, right: bleedPx, background: { r: 255, g: 255, b: 255 } })
      .png()
      .toFile(outPath);

    tmpPaths.push(outPath);
  }

  // assemble PDF pages
  const pdfDoc = await PDFDocument.create();
  for (const imgPath of tmpPaths) {
    const imgBytes = await fs.readFile(imgPath);
    const img = await pdfDoc.embedPng(imgBytes);
    const page = pdfDoc.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }

  const pdfBytes = await pdfDoc.save();
  const filename = `export_${orderId}_${Date.now()}.pdf`;
  const saveDir = path.join(process.cwd(), "uploads", "pdfs");
  await fs.mkdir(saveDir, { recursive: true });
  await fs.writeFile(path.join(saveDir, filename), pdfBytes);

  // cleanup tmp files
  for (const t of tmpPaths) {
    try { await fs.unlink(t); } catch(e){ console.warn("tmp cleanup", e.message); }
  }

  return filename;
}
