/**
 * FULL NFC GENERATOR (ESM)
 *
 * 1) Generate NFC tags in DB
 * 2) Generate QR PNG
 * 3) Generate CSV
 * 4) Zip QR folder
 * 5) Generate PDF print sheet (A4 grid)
 *
 * Usage :
 * node scripts/generate_nfc_full.js \
 *   --count=100 \
 *   --locationId=xxx \
 *   --productId=yyy \
 *   --out=./output_nfc \
 *   --cols=3 \
 *   --rows=3 \
 *   --size=180
 */

import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import QRCode from "qrcode";
import archiver from "archiver";
import PDFDocument from "pdfkit";
import { v4 as uuidv4 } from "uuid";
import { PrismaClient } from "@prisma/client";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* -----------------------------------------------------
 * CSV WRITER
 * --------------------------------------------------- */
async function writeCsv(rows, outPath) {
  const header = Object.keys(rows[0]).join(",") + "\n";
  const lines = rows
    .map(r =>
      Object.values(r)
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");

  await fsp.writeFile(outPath, header + lines, "utf8");
}

/* -----------------------------------------------------
 * ZIP FOLDER
 * --------------------------------------------------- */
async function zipFolder(sourceDir, outPath) {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const output = fs.createWriteStream(outPath);

    output.on("close", resolve);
    archive.on("error", reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

/* -----------------------------------------------------
 * LIST IMAGES FOR PDF
 * --------------------------------------------------- */
async function listImages(folder) {
  const files = await fsp.readdir(folder);
  return files.filter(f => /\.(png|jpg|jpeg)$/i.test(f)).map(f => path.join(folder, f));
}

/* -----------------------------------------------------
 * GENERATE PDF
 * --------------------------------------------------- */
async function generatePdf({ qrfolder, out, cols, rows, size }) {
  const images = await listImages(qrfolder);

  if (!images.length) throw new Error("No images found for PDF.");

  await fsp.mkdir(path.dirname(out), { recursive: true });

  const doc = new PDFDocument({ autoFirstPage: false });
  const stream = fs.createWriteStream(out);
  doc.pipe(stream);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 36;

  const cellW = (pageWidth - margin * 2) / cols;
  const cellH = (pageHeight - margin * 2) / rows;

  let i = 0;
  while (i < images.length) {
    doc.addPage({ size: "A4", margin: 0 });

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (i >= images.length) break;

        const file = images[i];
        const x = margin + c * cellW;
        const y = margin + r * cellH;

        doc.image(file, x + (cellW - size) / 2, y + (cellH - size) / 2, {
          width: size,
          height: size,
        });

        doc
          .fontSize(8)
          .fillColor("black")
          .text(path.basename(file), x, y + cellH - 14, {
            align: "center",
            width: cellW,
          });

        i++;
      }
    }
  }

  doc.end();
  await new Promise(res => stream.on("finish", res));

  console.log("📄 PDF generated →", out);
}

/* -----------------------------------------------------
 * MAIN
 * --------------------------------------------------- */
async function main() {
  const argv = yargs(hideBin(process.argv))
    .option("count", { type: "number", default: 100 })
    .option("locationId", { type: "string" })
    .option("productId", { type: "string" })
    .option("out", { type: "string", required: true })
    .option("cols", { type: "number", default: 3 })
    .option("rows", { type: "number", default: 3 })
    .option("size", { type: "number", default: 180 })
    .strict()
    .argv;

  const OUT = argv.out;
  const QR_DIR = path.join(OUT, "qrcodes");

  await fsp.mkdir(OUT, { recursive: true });
  await fsp.mkdir(QR_DIR, { recursive: true });

  console.log(`🚀 Generating ${argv.count} NFC tags...`);

  const rows = [];

  for (let i = 0; i < argv.count; i++) {
    const uid = uuidv4().replace(/-/g, "").slice(0, 16).toUpperCase();
    const id = uuidv4();

    const payload = `${process.env.PUBLIC_URL || "http://localhost:3000"}/r?uid=${uid}`;

    const tag = await prisma.nFCTag.create({
      data: {
        id,
        uid,
        payload,
        locationId: argv.locationId || null,
        productId: argv.productId || null,
        used: false,
      },
    });

    const qrFile = `qr_${id}.png`;
    const qrPath = path.join(QR_DIR, qrFile);
    await QRCode.toFile(qrPath, payload, { scale: 8 });

    rows.push({
      id,
      uid,
      payload,
      qrFile,
      locationId: argv.locationId || "",
      productId: argv.productId || "",
    });

    if ((i + 1) % 50 === 0) console.log(`   → ${i + 1}/${argv.count}`);
  }

  const CSV = path.join(OUT, `nfc_tags_${Date.now()}.csv`);
  await writeCsv(rows, CSV);

  const ZIP = path.join(OUT, "qrcodes.zip");
  await zipFolder(QR_DIR, ZIP);

  const PDF = path.join(OUT, "qrcodes_print.pdf");
  await generatePdf({
    qrfolder: QR_DIR,
    out: PDF,
    cols: argv.cols,
    rows: argv.rows,
    size: argv.size,
  });

  console.log("🎉 Done!");
  console.log("CSV:", CSV);
  console.log("ZIP:", ZIP);
  console.log("PDF:", PDF);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error("❌ ERROR:", err);
  process.exit(1);
});
