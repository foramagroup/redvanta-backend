// src/services/logo.service.js
// Upload et compression du logo company (base64 → WebP local)

import fs   from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

const BASE_DIR    = path.resolve(process.env.UPLOAD_DIR || "uploads");
const LOGOS_DIR   = path.join(BASE_DIR, "logos");
const MAX_SIZE    = 5 * 1024 * 1024;   // 5 Mo
const MAX_DIM     = 400;               // px — logos sont petits
const QUALITY     = 85;

fs.mkdirSync(LOGOS_DIR, { recursive: true });

function randomFilename() {
  return `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.webp`;
}

function toPublicUrl(absPath) {
  const rel = path.relative(BASE_DIR, absPath);
  return `/uploads/${rel.split(path.sep).join("/")}`;
}

export function isBase64(v) {
  return typeof v === "string" && v.startsWith("data:");
}

export function isUploadUrl(v) {
  return typeof v === "string" && v.startsWith("/uploads/");
}

// Supprimer un logo existant du disque
export function deleteLogo(logoUrl) {
  if (!logoUrl || !isUploadUrl(logoUrl)) return;
  try {
    const absPath = path.join(BASE_DIR, logoUrl.replace(/^\/uploads\//, ""));
    if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
  } catch (e) {
    console.error("[logo] Erreur suppression:", e.message);
  }
}

// Traiter un logo : base64 → WebP compressé sur disque
export async function processLogo(value) {
  if (!value || value === "/placeholder.svg") return null;
  // Déjà une URL serveur → pas de re-upload
  if (isUploadUrl(value)) return { url: value };

  if (!isBase64(value)) return null;

  const m = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;

  const [, mimeType, base64Data] = m;
  if (!mimeType.startsWith("image/")) throw new Error("Seules les images sont acceptées pour le logo");

  const buffer = Buffer.from(base64Data, "base64");
  if (buffer.length > MAX_SIZE) throw new Error(`Logo trop volumineux (max ${MAX_SIZE / 1024 / 1024} Mo)`);

  const filename = randomFilename();
  const destPath = path.join(LOGOS_DIR, filename);

  await sharp(buffer)
    .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(destPath);
  return { url: toPublicUrl(destPath) };
}