import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// GET /download/:filename
router.get("/:filename", (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(__dirname, "../uploads/", filename);

    res.download(filePath, filename, (err) => {
        if (err) {
            console.error("Download error:", err);
            return res.status(404).json({ error: "File not found" });
        }
    });
});

export default router;
