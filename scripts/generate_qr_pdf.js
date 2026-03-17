/**
 * backend/scripts/generate_qr_pdf.js
 *
 * Generate a printable PDF for Avery L7163 (A4, 2 columns × 7 rows)
 *
 * Usage:
 * node scripts/generate_qr_pdf.js \
 *   --qrfolder=./output_nfc/qrcodes \
 *   --out=./output_nfc/qrcodes_print.pdf \
 *   --logo=./assets/logo.png
 *
 * Options:
 * --qrfolder  Folder with QR PNGs
 * --out       Output PDF path
 * --logo      Optional logo PNG to draw under QR
 * --fontsize  Caption font size (default: 9)
 */

import fs from "fs/promises";
import fsc from "fs"; // createWriteStream
import path from "path";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------
   AVERY L7163 — SPEC SHEET
   ------------------------------------------------------
   Page size: A4 — 210 × 297 mm
   Avery uses mm => convert to points (1 mm = 2.83465 pt)

   Label size:     99.1 × 38.1 mm
   Rows: 7
   Cols: 2

   Left margin:    4.0 mm
   Top margin:     15.1 mm
   Horizontal pitch:  99.1 mm
   Vertical pitch:    38.1 mm
------------------------------------------------------ */

const mm = (value) => value * 2.83465;

const L7163 = {
  page: { width: mm(210), height: mm(297) },
  cols: 2,
  rows: 7,
  labelW: mm(99.1),
  labelH: mm(38.1),
  marginLeft: mm(4.0),
  marginTop: mm(15.1),
  horizontalPitch: mm(99.1),
  verticalPitch: mm(38.1)
};

async function listImages(folder) {
  const files = await fs.readdir(folder);
  return files
    .filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
    .sort()
    .map((f) => path.join(folder, f));
}

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option("qrfolder", { type: "string", demandOption: true })
    .option("out", { type: "string", default: path.join(process.cwd(), "qrcodes_print.pdf") })
    .option("logo", { type: "string", default: null })
    .option("fontsize", { type: "number", default: 9 })
    .argv;

  const images = await listImages(argv.qrfolder);
  if (!images.length) throw new Error("No images found in qrfolder.");

  console.log(`Found ${images.length} QR images.`);

  const doc = new PDFDocument({ autoFirstPage: false });
  const outStream = fsc.createWriteStream(argv.out);
  doc.pipe(outStream);

  const {
    page,
    rows,
    cols,
    labelW,
    labelH,
    marginLeft,
    marginTop,
    horizontalPitch,
    verticalPitch
  } = L7163;

  let idx = 0;
  const logo = argv.logo ? argv.logo : null;

  while (idx < images.length) {
    // Create new A4 page
    doc.addPage({
      size: [page.width, page.height],
      margin: 0
    });

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (idx >= images.length) break;

        const img = images[idx];
        const base = path.basename(img);

        const x = marginLeft + c * horizontalPitch;
        const y = marginTop + r * verticalPitch;

        // Draw label border (optional)
        doc.strokeColor("#cccccc").lineWidth(0.5).rect(x, y, labelW, labelH).stroke();

        // QR size smaller than label height
        const qrSize = labelH * 0.70;

        // Center QR inside the label
        const qrX = x + (labelW - qrSize) / 2;
        const qrY = y + 4;

        try {
          doc.image(img, qrX, qrY, { width: qrSize, height: qrSize });
        } catch (e) {
          console.error("Cannot draw image:", img, e.message);
        }

        // Optional logo UNDER QR
        if (logo) {
          try {
            const logoW = qrSize * 0.35;
            const logoX = x + (labelW - logoW) / 2;
            const logoY = qrY + qrSize + 2;
            doc.image(logo, logoX, logoY, { width: logoW });
          } catch (e) {
            console.warn("Logo draw error:", e.message);
          }
        }

        // Caption: file name (UID)
        doc
          .fillColor("black")
          .fontSize(argv.fontsize)
          .text(base.replace(".png", ""), x, y + labelH - argv.fontsize - 4, {
            width: labelW,
            align: "center"
          });

        idx++;
      }
    }
  }

  doc.end();

  await new Promise((resolve) => outStream.on("close", resolve));
  console.log(`✅ PDF generated at: ${argv.out}`);
}

main().catch((err) => {
  console.error("❌ ERROR:", err);
  process.exit(1);
});
