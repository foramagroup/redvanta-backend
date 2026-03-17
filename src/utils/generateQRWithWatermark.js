import QRCode from "qrcode";
import sharp from "sharp";

export async function generateQRWithWatermark(url, outputFile) {
  const qrBuffer = await QRCode.toBuffer(url, {
    scale: 6,
    margin: 1
  });

  const wm = Buffer.from(`
    <svg width="400" height="400">
      <text x="50%" y="50%" text-anchor="middle" opacity="0.15" font-size="48">KROOTAL</text>
    </svg>
  `);

  await sharp(qrBuffer)
    .composite([{ input: wm, gravity: "center" }])
    .toFile(outputFile);
}
