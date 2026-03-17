import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export default async function generateReviewPDF(review) {
  const filename = `review-${review.id}.pdf`;
  const filePath = path.join("uploads/reviews", filename);

  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(filePath));

  doc.fontSize(22).text("Review Summary", { underline: true });
  doc.moveDown();

  doc.fontSize(14).text(`User: ${review.user.email}`);
  doc.text(`Order ID: ${review.orderId}`);
  doc.text(`Rating: ${review.rating}/5`);
  doc.text(`Comment: ${review.comment}`);
  doc.text(`Date: ${review.createdAt}`);

  doc.end();

  return filePath;
}
