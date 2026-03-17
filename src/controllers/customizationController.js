/**
 * customizationController.js
 * Controller for handling user and admin customization actions
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import sharp from "sharp";

import prisma from "../config/prisma.js";
import { saveBase64Image } from "../utils/saveBase64Image.js";
import { createPdfFromImages } from "../utils/pdfExport.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Multer setup for file uploads (memory storage)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

/**
 * Save a design (front/back)
 */
export async function saveDesign(req, res) {
  try {
    const { front, back } = req.body;
    const userId = req.user.id;

    if (!front) return res.status(400).json({ error: "Front design missing" });

    const frontFile = `front_${Date.now()}.png`;
    const backFile = back ? `back_${Date.now()}.png` : null;

    const uploadsDir = path.join(process.cwd(), "uploads", "designs");
    await fs.mkdir(uploadsDir, { recursive: true });

    await fs.writeFile(path.join(uploadsDir, frontFile), Buffer.from(front.replace(/^data:image\/png;base64,/, ""), "base64"));
    if (back && backFile) {
      await fs.writeFile(path.join(uploadsDir, backFile), Buffer.from(back.replace(/^data:image\/png;base64,/, ""), "base64"));
    }

    const design = await prisma.design.create({
      data: {
        id: uuidv4(),
        userId,
        file: frontFile,
        backImage: backFile,
        createdAt: new Date()
      }
    });

    res.json({ success: true, design });
  } catch (err) {
    console.error("saveDesign error:", err);
    res.status(500).json({ error: "Failed to save design" });
  }
}

/**
 * List designs for the logged-in user
 */
export async function listMyDesigns(req, res) {
  try {
    const userId = req.user.id;
    const designs = await prisma.design.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });
    res.json({ designs });
  } catch (err) {
    console.error("listMyDesigns error:", err);
    res.status(500).json({ error: "Failed to list designs" });
  }
}

/**
 * Download a design with watermark
 */
export async function downloadDesign(req, res) {
  try {
    const id = req.params.id;
    const userId = req.user.id;

    const design = await prisma.design.findUnique({ where: { id } });
    if (!design) return res.status(404).json({ error: "Design not found" });
    if (design.userId !== userId) return res.status(403).json({ error: "Not authorized" });

    const filePath = path.join(process.cwd(), "uploads", "designs", design.file);
    const watermarkedFile = path.join(process.cwd(), "uploads", "designs", `wm_${design.file}`);

    await sharp(filePath)
      .composite([{ 
        input: Buffer.from(`<svg width="600" height="200"><text x="50" y="100" font-size="48" fill="rgba(255,255,255,0.5)">KROOTAL</text></svg>`), 
        gravity: "center" 
      }])
      .png()
      .toFile(watermarkedFile);

    res.download(watermarkedFile, design.file, (err) => {
      if (err) console.error(err);
      // Cleanup temporary watermarked file
      setTimeout(() => fs.unlink(watermarkedFile).catch(() => {}), 3000);
    });
  } catch (err) {
    console.error("downloadDesign error:", err);
    res.status(500).json({ error: "Failed to download design" });
  }
}

/**
 * Admin: List all designs
 */
export async function adminGetAllDesigns(req, res) {
  try {
    const designs = await prisma.design.findMany({
      orderBy: { createdAt: "desc" }
    });
    res.json({ designs });
  } catch (err) {
    console.error("adminGetAllDesigns error:", err);
    res.status(500).json({ error: "Failed to list all designs" });
  }
}

/**
 * Upload a front/back image (multipart/form-data)
 */
export const uploadImageMiddleware = upload.single("image");

export async function uploadImage(req, res) {
  try {
    const { orderId } = req.params;
    const side = (req.body.side || req.query.side || "front").toLowerCase();

    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const ext = req.file.mimetype.includes("png") ? "png" : "jpg";
    const filename = `custom_${orderId}_${side}_${Date.now()}.${ext}`;
    const uploadsDir = path.join(process.cwd(), "uploads", "customizations");

    await fs.mkdir(uploadsDir, { recursive: true });
    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, req.file.buffer);

    const update = side === "front" ? { frontImage: filename } : { backImage: filename };
    const customization = await prisma.customization.upsert({
      where: { orderId },
      create: { id: uuidv4(), orderId, frontImage: update.frontImage || null, backImage: update.backImage || null },
      update
    });

    res.json({ ok: true, filename, customization });
  } catch (err) {
    console.error("uploadImage error:", err);
    res.status(500).json({ error: "Failed to upload image" });
  }
}

export default {
  saveDesign,
  listMyDesigns,
  downloadDesign,
  adminGetAllDesigns,
  uploadImage,
  uploadImageMiddleware
};
