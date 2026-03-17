import path from "path";
import fs from "fs";
import PDFDocument from "pdfkit";
import sharp from "sharp";

export const exportPNG = async (req, res) => {
  try {
    const { imageBase64, dpi = 72, filename } = req.body;

    const buffer = Buffer.from(imageBase64.replace(/^data:image\/png;base64,/, ""), "base64");

    const outName = `${filename || "design"}_${dpi}dpi.png`;
    const outPath = path.join("uploads/exports", outName);

    await sharp(buffer)
      .png()
      .resize({
        width: Math.round((3508 * dpi) / 300), // scale 300dpi → target DPI dynamically
      })
      .toFile(outPath);

    return res.json({
      ok: true,
      url: `/uploads/exports/${outName}`,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Export PNG failed" });
  }
};

export const exportPDF = async (req, res) => {
  try {
    const { front, back, filename = "design" } = req.body;

    const pdfName = `${filename}.pdf`;
    const pdfPath = path.join("uploads/exports", pdfName);

    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
    });

    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // FRONT PAGE
    const frontBuffer = Buffer.from(front.replace(/^data:image\/png;base64,/, ""), "base64");
    const frontImg = await sharp(frontBuffer).png().toBuffer();
    doc.image(frontImg, 0, 0, { width: 595 });

    doc.addPage();

    // BACK PAGE
    const backBuffer = Buffer.from(back.replace(/^data:image\/png;base64,/, ""), "base64");
    const backImg = await sharp(backBuffer).png().toBuffer();
    doc.image(backImg, 0, 0, { width: 595 });

    doc.end();

    stream.on("finish", () => {
      return res.json({
        ok: true,
        url: `/uploads/exports/${pdfName}`,
      });
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Export PDF failed" });
  }
};
