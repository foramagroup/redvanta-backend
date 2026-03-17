// backend/src/lib/s3.js
import fs from "fs/promises";
import path from "path";

let useS3 = Boolean(process.env.AWS_S3_BUCKET && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

export async function uploadToS3(file) {
  // si AWS configuré -> implémentation S3
  if (useS3) {
    // lazy import to avoid dependency if not used
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    const key = `products/${Date.now()}_${Math.random().toString(36).slice(2,8)}${path.extname(file.originalname)}`;
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Body: file.buffer || await fs.readFile(file.path),
      ContentType: file.mimetype || "application/octet-stream",
      ACL: "public-read"
    };

    await client.send(new PutObjectCommand(params));
    const url = `${process.env.S3_PUBLIC_URL || `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com`}/${key}`;
    return url;
  }

  // fallback local disk storage into uploads/products
  const uploadsDir = path.join(process.cwd(), "uploads", "products");
  await fs.mkdir(uploadsDir, { recursive: true });

  const filename = `${Date.now()}_${Math.random().toString(36).slice(2,8)}${path.extname(file.originalname || "bin")}`;
  const dest = path.join(uploadsDir, filename);

  if (file.buffer) {
    await fs.writeFile(dest, file.buffer);
  } else if (file.path) {
    const read = await fs.readFile(file.path);
    await fs.writeFile(dest, read);
  } else {
    throw new Error("No file data");
  }

  // retourne l'URL locale (exposed via app.use('/uploads/products', express.static(...)))
  return `${process.env.PUBLIC_URL || ""}/uploads/products/${filename}`;
}

export default { uploadToS3 };
