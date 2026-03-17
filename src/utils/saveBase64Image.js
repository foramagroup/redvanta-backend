import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export async function saveBase64Image(dataUrl, entityId, name = "img") {
  if (!dataUrl) throw new Error("Invalid base64");
  const matches = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!matches) throw new Error("Invalid data URL");
  const mime = matches[1];
  const ext = mime.split("/")[1] === "jpeg" ? "jpg" : mime.split("/")[1];
  const base64 = matches[2];
  const buffer = Buffer.from(base64, "base64");
  const filename = `${name}_${entityId}_${Date.now()}_${uuidv4()}.${ext}`;
  const uploadsDir = path.join(process.cwd(), "uploads", "customizations");
  await fs.mkdir(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, filename);
  await fs.writeFile(filePath, buffer);
  return filename;
}
