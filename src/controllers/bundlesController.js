// backend/src/controllers/bundlesController.js
import prisma from "../config/prisma.js";
import { v4 as uuidv4 } from "uuid";

export async function listBundles(req, res) {
  const items = await prisma.bundle.findMany({ include: { products: true } });
  return res.json(items);
}

export async function getBundle(req, res) {
  const id = req.params.id;
  const b = await prisma.bundle.findUnique({ where: { id }, include: { products: true } });
  if (!b) return res.status(404).json({ error: "Not found" });
  return res.json(b);
}

export async function createBundle(req, res) {
  const { title, products } = req.body;
  const b = await prisma.bundle.create({
    data: {
      id: uuidv4(),
      title,
      products: { connect: products.map(id => ({ id })) }
    },
    include: { products: true }
  });
  return res.status(201).json(b);
}

export async function deleteBundle(req, res) {
  const id = req.params.id;
  await prisma.bundle.delete({ where: { id } });
  return res.json({ ok: true });
}
