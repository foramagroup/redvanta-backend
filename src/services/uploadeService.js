// src/services/upload.service.js
// Stockage LOCAL des fichiers (images + vidéos)
// Images  → compressées et converties en WebP via sharp
// Vidéos  → sauvegardées telles quelles
// YouTube → pas d'upload, juste l'URL embed YouTube

import fs from "fs";
import path    from"path";
import crypto  from "crypto";
import sharp   from "sharp";

// ─── Dossiers de stockage ─────────────────────────────────────
// Tout est dans /uploads (servi en static par Express)
const BASE_UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "uploads");

export const DIRS = {
  product_image:   path.join(BASE_UPLOAD_DIR, "products", "images"),
  product_gallery: path.join(BASE_UPLOAD_DIR, "products", "gallery"),
  product_video:   path.join(BASE_UPLOAD_DIR, "products", "videos"),
  product_meta:    path.join(BASE_UPLOAD_DIR, "products", "meta"),
  card_type:       path.join(BASE_UPLOAD_DIR, "card-types"),
};

// Créer tous les dossiers au démarrage
Object.values(DIRS).forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

// ─── Config ───────────────────────────────────────────────────
const MAX_IMAGE_SIZE  = 5  * 1024 * 1024;  // 5 Mo
const MAX_VIDEO_SIZE  = 50 * 1024 * 1024;  // 50 Mo
const MAX_DIMENSION   = 2000;               // px
const WEBP_QUALITY    = 82;

// ─── Helpers ─────────────────────────────────────────────────

function randomFilename(ext) {
  return `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
}

// Retourne l'URL publique à partir du chemin absolu
function toPublicUrl(absPath) {
  // absPath = /chemin/vers/uploads/products/images/xyz.webp
  // url     = /uploads/products/images/xyz.webp
  const rel = path.relative(BASE_UPLOAD_DIR, absPath);
  return `/uploads/${rel.split(path.sep).join("/")}`;
}

export function isBase64(value) {
  return typeof value === "string" && value.startsWith("data:");
}

export function isHttpUrl(value) {
  return typeof value === "string" && (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/uploads/"));
}

// Extraire le buffer et le mimeType d'un dataURL base64
function parseBase64(dataUrl) {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("Format base64 invalide");
  return { mimeType: m[1], buffer: Buffer.from(m[2], "base64") };
}

// ─── Supprimer un fichier local ───────────────────────────────
export function deleteLocalFile(fileUrl) {
  if (!fileUrl || fileUrl === "/placeholder.svg") return;
  try {
    // fileUrl = "/uploads/products/images/xxx.webp"
    const absPath = path.join(BASE_UPLOAD_DIR, fileUrl.replace(/^\/uploads\//, ""));
    if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
  } catch (err) {
    console.error("[upload] Erreur suppression fichier:", err.message);
  }
}

// ─── Sauvegarder une IMAGE (base64 → WebP compressé) ─────────
async function saveImage(dataUrl, destDir) {
  const { mimeType, buffer } = parseBase64(dataUrl);

  if (!mimeType.startsWith("image/")) {
    throw new Error(`Type non supporté: ${mimeType}`);
  }
  if (buffer.length > MAX_IMAGE_SIZE) {
    throw new Error(`Image trop volumineuse (max ${MAX_IMAGE_SIZE / 1024 / 1024} Mo)`);
  }

  const filename = randomFilename(".webp");
  const destPath = path.join(destDir, filename);

  await sharp(buffer)
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toFile(destPath);

  return { filePath: destPath, url: toPublicUrl(destPath) };
}

// ─── Sauvegarder une VIDÉO (base64 → fichier brut) ───────────
async function saveVideo(dataUrl, destDir) {
  const { mimeType, buffer } = parseBase64(dataUrl);

  if (!mimeType.startsWith("video/")) {
    throw new Error(`Type non supporté: ${mimeType}`);
  }
  if (buffer.length > MAX_VIDEO_SIZE) {
    throw new Error(`Vidéo trop volumineuse (max ${MAX_VIDEO_SIZE / 1024 / 1024} Mo)`);
  }

  // Conserver l'extension d'origine
  const extMap = {
    "video/mp4":       ".mp4",
    "video/webm":      ".webm",
    "video/quicktime": ".mov",
    "video/ogg":       ".ogg",
  };
  const ext      = extMap[mimeType] || ".mp4";
  const filename = randomFilename(ext);
  const destPath = path.join(destDir, filename);

  fs.writeFileSync(destPath, buffer);

  return { filePath: destPath, url: toPublicUrl(destPath) };
}

// ─── API principale ───────────────────────────────────────────
// Traite une valeur qui peut être :
//   - un base64 image  → saveImage
//   - un base64 vidéo  → saveVideo
//   - une URL /uploads → déjà stocké, on garde tel quel
//   - null/placeholder → on retourne null

export async function processFile(value, destDir, type = "image") {
  if (!value || value === "/placeholder.svg") return null;

  // Déjà une URL serveur (pas besoin de re-uploader)
  if (isHttpUrl(value)) return { url: value };

  if (!isBase64(value)) return null;

  if (type === "video") {
    return saveVideo(value, destDir);
  }
  return saveImage(value, destDir);
}

// ─── Traiter tous les fichiers d'un formulaire produit ────────
export async function processProductFiles(body) {
  // 1. Image principale
  const mainImage = await processFile(body.image, DIRS.product_image, "image");

  // 2. Galerie
  const gallery = await Promise.all(
    (body.gallery || []).map(async (item, i) => {
      if (item.type === "youtube") {
        // Rien à uploader, l'URL embed YouTube est stockée directement
        return {
          url:      item.url,
          type:     "youtube",
          posterUrl: item.poster ?? null,  // URL CDN YouTube (pas besoin de stocker)
          position: i,
        };
      }

      const dir      = item.type === "video" ? DIRS.product_video : DIRS.product_gallery;
      const uploaded = await processFile(item.url, dir, item.type);

      // Poster pour les vidéos
      let posterResult = null;
      if (item.poster) {
        posterResult = await processFile(item.poster, DIRS.product_gallery, "image");
      }

      return {
        url:       uploaded?.url  ?? item.url,
        type:      item.type,
        posterUrl: posterResult?.url ?? item.poster ?? null,
        position:  i,
      };
    })
  );

  // 3. Meta images par langue
  const metaImages = {};
  for (const t of body.translations || []) {
    if (t.metaImage) {
      const r = await processFile(t.metaImage, DIRS.product_meta, "image");
      if (r) metaImages[t.lang] = r.url;
    }
  }

  return { mainImage, gallery, metaImages };
}

// ─── Supprimer tous les fichiers d'un produit ────────────────
export function deleteProductFiles(product) {
  if (product.imageUrl) deleteLocalFile(product.imageUrl);

  for (const g of product.galleryItems ?? []) {
    if (g.type !== "youtube") deleteLocalFile(g.url);
    if (g.posterUrl)          deleteLocalFile(g.posterUrl);
  }

  for (const t of product.translations ?? []) {
    if (t.metaImageUrl) deleteLocalFile(t.metaImageUrl);
  }
}

