// backend/src/controllers/downloadController.js
import path from "path";
import fs from "fs";
import { requireAuth } from "../middleware/requireAuth.js";

export async function downloadFile(req, res) {
  try {
    const filename = req.params.filename;
    const filePath = path.join(process.cwd(), "uploads", "customizations", filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "not found" });

    // Option: check owner via customization table if you saved mapping between filename and order/design
    // Example: const record = await prisma.customization.findFirst({ where: { frontImage: filename } });
    // if (record && record.order.userId !== req.user.id) return res.status(403).json({ error: "forbidden" });

    return res.download(filePath);
  } catch (err) {
    console.error("download failed", err);
    res.status(500).json({ error: "download failed" });
  }
}
