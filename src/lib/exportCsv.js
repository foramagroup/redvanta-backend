// backend/src/lib/exportCsv.js
import prisma from "../config/prisma.js";
import { Parser } from "json2csv";

export async function exportProductsCSV() {
  const products = await prisma.product.findMany({
    include: { designs: true, tags: true }
  });

  const fields = [
    "id",
    "title",
    "slug",
    "price",
    "currency",
    "category",
    "sales",
    "createdAt",
    "updatedAt"
  ];

  const parser = new Parser({ fields });
  const csv = parser.parse(products);
  return csv;
}

export default exportProductsCSV;
