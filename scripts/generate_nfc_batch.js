/**
 * backend/scripts/generate_nfc_batch.js
 *
 * Fully async NFC tag generator with concurrency limit.
 */

import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import QRCode from "qrcode";
import archiver from "archiver";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { PrismaClient } from "@prisma/client";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

async function writeCsv(rows, outPath) {
  if (!rows.length) return;
  const header = Object.keys(rows[0]).join(",") + "\n";
  const lines = rows
    .map((r) =>
      Object.values(r)
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");
  await fsp.writeFile(outPath, header + lines, "utf8");
}

async function zipFolder(sourceDir, outPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log(`Zip created at ${outPath} (${archive.pointer()} bytes)`);
      resolve();
    });

    archive.on("error", (err) => reject(err));

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

// Limit concurrency
async function asyncPool(poolLimit, array, iteratorFn) {
  const ret = [];
  const executing = [];
  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);

    if (poolLimit <= array.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
}

async function generateTag(tagData, qrfolder) {
  const { id, uid, payload, locationId, productId } = tagData;

  // Create DB record
  await prisma.nFCTag.create({
    data: {
      id,
      uid,
      payload,
      locationId: locationId || null,
      productId: productId || null,
      used: false,
    },
  });

  // Generate QR code
  const qrFile = `qr_${id}.png`;
  const qrPath = path.join(qrfolder, qrFile);
  await QRCode.toFile(qrPath, payload, { margin: 1, scale: 8 });

  return { ...tagData, qrFile };
}

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option("count", { type: "number", default: 100 })
    .option("locationId", { type: "string", default: null })
    .option("productId", { type: "string", default: null })
    .option("out", { type: "string", default: path.join(process.cwd(), "output_nfc") })
    .argv;

  const count = argv.count;
  const out = argv.out;

  await fsp.mkdir(out, { recursive: true });
  const qrfolder = path.join(out, "qrcodes");
  await fsp.mkdir(qrfolder, { recursive: true });

  const tags = Array.from({ length: count }).map(() => {
    const uid = uuidv4().replace(/-/g, "").slice(0, 16).toUpperCase();
    const id = uuidv4();
    const payload = `${process.env.PUBLIC_URL || process.env.FRONT_URL || "http://localhost:3000"}/r?uid=${uid}`;
    return { id, uid, payload, locationId: argv.locationId || "", productId: argv.productId || "" };
  });

  console.log(`Generating ${count} NFC tags into ${out} ...`);

  // Fully async with concurrency limit (e.g., 20)
  const rows = await asyncPool(20, tags, async (tag) => {
    const result = await generateTag(tag, qrfolder);
    console.log(`Created tag ${result.id}`);
    return result;
  });

  // Write CSV
  const csvPath = path.join(out, `nfc_tags_${Date.now()}.csv`);
  await writeCsv(rows, csvPath);

  // Zip QR codes
  const zipPath = path.join(out, "qrcodes.zip");
  await zipFolder(qrfolder, zipPath);

  console.log("Done:");
  console.log("  CSV:", csvPath);
  console.log("  QR folder:", qrfolder);
  console.log("  ZIP:", zipPath);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
