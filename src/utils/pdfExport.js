// backend/src/utils/pdfExport.js
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// NFC card physical dimensions in mm (ISO/IEC 7810 ID-1)
// ISO/IEC 7810 ID-1 exact standard
const CARD_DIMS_MM = {
  landscape: { w: 85.60, h: 53.98 },
  portrait:  { w: 53.98, h: 85.60 },
  square:    { w: 54,    h: 54    },
  circle:    { w: 54,    h: 54    },
};
const MM_TO_PT = 72 / 25.4; // 1 mm = 2.8346 PDF points

/**
 * savedFiles: array of absolute image paths (png)
 * options: { dpi, bleedMm, orderId, orientation }
 * returns filename (relative to uploads/pdfs)
 *
 * Page size is set to the real physical NFC card dimensions so the PDF
 * prints at the correct 85.6 × 54 mm (landscape) or 54 × 85.6 mm (portrait).
 */
export async function createPdfFromImages(savedFiles, { dpi = 300, bleedMm = 3, orderId = "o", orientation = "landscape" } = {}) {
  const dims = CARD_DIMS_MM[orientation] ?? CARD_DIMS_MM.landscape;

  // Physical page dimensions including bleed, in PDF points
  const pageW = (dims.w + bleedMm * 2) * MM_TO_PT;
  const pageH = (dims.h + bleedMm * 2) * MM_TO_PT;

  // Target pixel dimensions at given DPI (card + bleed on all sides)
  const targetPxW = Math.round((dims.w + bleedMm * 2) * dpi / 25.4);
  const targetPxH = Math.round((dims.h + bleedMm * 2) * dpi / 25.4);

  const tmpPaths = [];
  for (const f of savedFiles) {
    const outPath = path.join(process.cwd(), "uploads", "tmp", `pdf_${uuidv4()}.png`);
    await fs.mkdir(path.dirname(outPath), { recursive: true });

    // Resize to exact card+bleed pixel dimensions (fill — card aspect already matches)
    await sharp(f)
      .resize(targetPxW, targetPxH, { fit: "fill" })
      .png()
      .toFile(outPath);

    tmpPaths.push(outPath);
  }

  // Assemble PDF with correct physical page size
  const pdfDoc = await PDFDocument.create();
  for (const imgPath of tmpPaths) {
    const imgBytes = await fs.readFile(imgPath);
    const img = await pdfDoc.embedPng(imgBytes);
    const page = pdfDoc.addPage([pageW, pageH]);
    page.drawImage(img, { x: 0, y: 0, width: pageW, height: pageH });
  }

  const pdfBytes = await pdfDoc.save();
  const filename = `export_${orderId}_${Date.now()}.pdf`;
  const saveDir = path.join(process.cwd(), "uploads", "pdfs");
  await fs.mkdir(saveDir, { recursive: true });
  await fs.writeFile(path.join(saveDir, filename), pdfBytes);

  for (const t of tmpPaths) {
    try { await fs.unlink(t); } catch (e) { console.warn("tmp cleanup", e.message); }
  }

  return filename;
}
