import fs from "fs/promises";
import path from "path";
import ftp from "basic-ftp";

async function sendToPrinter(batchId) {
  const folder = path.join(process.cwd(), "uploads", "qr-batches", batchId);
  const files = await fs.readdir(folder);

  const client = new ftp.Client();
  await client.access({
    host: process.env.PRINTER_HOST,
    user: process.env.PRINTER_USER,
    password: process.env.PRINTER_PASS,
    secure: false,
  });

  for (const img of files) {
    const filepath = path.join(folder, img);
    console.log("Uploading:", img);
    await client.uploadFrom(filepath, img);
  }

  client.close();
}

const batchId = process.argv[2];
if (!batchId) throw new Error("Usage: node printQrBatch.js <batchId>");

sendToPrinter(batchId);
