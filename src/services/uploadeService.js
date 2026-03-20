import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

const BASE_UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "uploads");

export const DIRS = {
  product_image: path.join(BASE_UPLOAD_DIR, "products", "images"),
  product_gallery: path.join(BASE_UPLOAD_DIR, "products", "gallery"),
  product_video: path.join(BASE_UPLOAD_DIR, "products", "videos"),
  product_meta: path.join(BASE_UPLOAD_DIR, "products", "meta"),
  card_type: path.join(BASE_UPLOAD_DIR, "card-types"),
};

Object.values(DIRS).forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
const MAX_DIMENSION = 2000;
const WEBP_QUALITY = 82;

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const ALLOWED_VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/ogg",
]);

function randomFilename(ext) {
  return `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
}

function toPublicUrl(absPath) {
  const rel = path.relative(BASE_UPLOAD_DIR, absPath);
  return `/uploads/${rel.split(path.sep).join("/")}`;
}

export function isBase64(value) {
  return typeof value === "string" && value.startsWith("data:");
}

export function isHttpUrl(value) {
  return typeof value === "string" && (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("/uploads/")
  );
}

function parseBase64(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Format base64 invalide");
  }

  return {
    mimeType: match[1].toLowerCase(),
    buffer: Buffer.from(match[2], "base64"),
  };
}

export function deleteLocalFile(fileUrl) {
  if (!fileUrl || fileUrl === "/placeholder.svg") {
    return;
  }

  try {
    const absPath = path.join(BASE_UPLOAD_DIR, fileUrl.replace(/^\/uploads\//, ""));
    if (fs.existsSync(absPath)) {
      fs.unlinkSync(absPath);
    }
  } catch (err) {
    console.error("[upload] File delete error:", err.message);
  }
}

async function saveImage(dataUrl, destDir) {
  const { mimeType, buffer } = parseBase64(dataUrl);

  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error(`Type d'image non supporte: ${mimeType}`);
  }

  if (buffer.length > MAX_IMAGE_SIZE) {
    throw new Error(`Image trop volumineuse (max ${MAX_IMAGE_SIZE / 1024 / 1024} Mo)`);
  }

  let metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw new Error("Le fichier envoye n'est pas une image valide");
  }

  if (!metadata?.format) {
    throw new Error("Impossible d'identifier le format de l'image");
  }

  const filename = randomFilename(".webp");
  const destPath = path.join(destDir, filename);

  await sharp(buffer)
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toFile(destPath);

  return { filePath: destPath, url: toPublicUrl(destPath) };
}

async function saveVideo(dataUrl, destDir) {
  const { mimeType, buffer } = parseBase64(dataUrl);

  if (!ALLOWED_VIDEO_MIME_TYPES.has(mimeType)) {
    throw new Error(`Type video non supporte: ${mimeType}`);
  }

  if (buffer.length > MAX_VIDEO_SIZE) {
    throw new Error(`Video trop volumineuse (max ${MAX_VIDEO_SIZE / 1024 / 1024} Mo)`);
  }

  const extMap = {
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
    "video/ogg": ".ogg",
  };

  const filename = randomFilename(extMap[mimeType] || ".mp4");
  const destPath = path.join(destDir, filename);

  fs.writeFileSync(destPath, buffer);

  return { filePath: destPath, url: toPublicUrl(destPath) };
}

export async function processFile(value, destDir, type = "image") {
  if (!value || value === "/placeholder.svg") {
    return null;
  }

  if (isHttpUrl(value)) {
    return { url: value };
  }

  if (!isBase64(value)) {
    return null;
  }

  if (type === "video") {
    return saveVideo(value, destDir);
  }

  return saveImage(value, destDir);
}

export async function processProductFiles(body) {
  const mainImage = await processFile(body.image, DIRS.product_image, "image");

  const gallery = await Promise.all(
    (body.gallery || []).map(async (item, index) => {
      if (item.type === "youtube") {
        return {
          url: item.url,
          type: "youtube",
          posterUrl: item.poster ?? null,
          position: index,
        };
      }

      const dir = item.type === "video" ? DIRS.product_video : DIRS.product_gallery;
      const uploaded = await processFile(item.url, dir, item.type);

      let posterResult = null;
      if (item.poster) {
        posterResult = await processFile(item.poster, DIRS.product_gallery, "image");
      }

      return {
        url: uploaded?.url ?? item.url,
        type: item.type,
        posterUrl: posterResult?.url ?? item.poster ?? null,
        position: index,
      };
    })
  );

  const metaImages = {};
  for (const translation of body.translations || []) {
    if (translation.metaImage) {
      const result = await processFile(translation.metaImage, DIRS.product_meta, "image");
      if (result) {
        metaImages[translation.lang] = result.url;
      }
    }
  }

  return { mainImage, gallery, metaImages };
}

export function deleteProductFiles(product) {
  if (product.imageUrl) {
    deleteLocalFile(product.imageUrl);
  }

  for (const galleryItem of product.galleryItems ?? []) {
    if (galleryItem.type !== "youtube") {
      deleteLocalFile(galleryItem.url);
    }
    if (galleryItem.posterUrl) {
      deleteLocalFile(galleryItem.posterUrl);
    }
  }

  for (const translation of product.translations ?? []) {
    if (translation.metaImageUrl) {
      deleteLocalFile(translation.metaImageUrl);
    }
  }
}
