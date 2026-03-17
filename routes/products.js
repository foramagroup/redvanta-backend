// backend/routes/products.js
import express from "express";
import { prisma } from "../lib/prisma.js";
import multer from "multer";
import { uploadToS3 } from "../lib/s3.js";
import { exportProductsCSV } from "../lib/exportCsv.js";
import { syncStripeProduct } from "../lib/stripe.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * GET /api/products
 * Query: search, sort, order, page, limit, category
 */
router.get("/", async (req, res) => {
  const {
    search = "",
    sort = "createdAt",
    order = "desc",
    page = 1,
    limit = 20,
    category
  } = req.query;

  const where = {
    AND: [
      search ? { title: { contains: search, mode: "insensitive" } } : {},
      category ? { category } : {}
    ]
  };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { [sort]: order },
      skip: (page - 1) * limit,
      take: Number(limit),
      include: { designs: true, tags: true }
    }),
    prisma.product.count({ where })
  ]);

  res.json({ items, total });
});


/**
 * GET /api/products/:id
 */
router.get("/:id", async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: { designs: true, tags: true, bundles: true }
  });
  if (!product) return res.status(404).json({ error: "Not found" });
  res.json(product);
});


/**
 * POST /api/products
 * Supports image upload
 */
router.post("/", upload.single("image"), async (req, res) => {
  let imageUrl = null;

  if (req.file) {
    imageUrl = await uploadToS3(req.file);
  }

  const data = JSON.parse(req.body.data);

  const product = await prisma.product.create({
    data: {
      ...data,
      image: imageUrl,
    }
  });

  await syncStripeProduct(product);

  res.json(product);
});


/**
 * PUT /api/products/:id
 */
router.put("/:id", upload.single("image"), async (req, res) => {
  let imageUrl = null;

  if (req.file) {
    imageUrl = await uploadToS3(req.file);
  }

  const data = JSON.parse(req.body.data);

  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: {
      ...data,
      ...(imageUrl ? { image: imageUrl } : {})
    }
  });

  await syncStripeProduct(product);

  res.json(product);
});


/**
 * DELETE /api/products/:id
 */
router.delete("/:id", async (req, res) => {
  await prisma.product.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});


/**
 * POST /api/products/bulk-delete
 */
router.post("/bulk-delete", async (req, res) => {
  const { ids } = req.body;
  await prisma.product.deleteMany({ where: { id: { in: ids } } });
  res.json({ success: true });
});


/**
 * GET /api/products/export/csv
 */
router.get("/export/csv", async (req, res) => {
  const csv = await exportProductsCSV();
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=products.csv");
  res.send(csv);
});


/**
 * GET /api/products/stats
 */
router.get("/stats", async (req, res) => {
  const total = await prisma.product.count();
  const avgPrice = await prisma.product.aggregate({ _avg: { price: true } });
  const categories = await prisma.product.groupBy({
    by: ["category"],
    _count: { _all: true }
  });

  res.json({ total, avgPrice, categories });
});


/**
 * POST /api/products/:id/upsell
 * Génère auto upsell basé sur catégorie + best sellers
 */
router.post("/:id/upsell", async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ error: "Not found" });

  const suggestions = await prisma.product.findMany({
    where: {
      category: product.category,
      id: { not: product.id }
    },
    orderBy: { sales: "desc" },
    take: 5
  });

  await prisma.product.update({
    where: { id: product.id },
    data: { upsell: suggestions.map(s => s.id) }
  });

  res.json({ upsell: suggestions });
});


/**
 * POST /api/products/bundle
 * Génération de bundle dynamique
 */
router.post("/bundle", async (req, res) => {
  const { title, products } = req.body;

  const bundle = await prisma.bundle.create({
    data: {
      title,
      products: { connect: products.map(id => ({ id })) }
    }
  });

  res.json(bundle);
});

router.post("/:id/recompute-crosssell", async (req, res) => {
  const ids = await computeCrossSell(req.params.id, 6);
  await prisma.product.update({ where: { id: req.params.id }, data: { crossSell: ids } });
  res.json({ crossSell: ids });
});

export default router;
