import prisma from "../config/prisma.js";
import Stripe from "stripe";
import fs from "fs";
import path from "path";

const stripe = new Stripe(process.env.STRIPE_SECRET);

/* Pagination + Search */
export async function list({ page, limit, search }) {
  const skip = (Number(page) - 1) * Number(limit);

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where: {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } }
        ]
      },
      skip,
      take: Number(limit),
      orderBy: { createdAt: "desc" }
    }),
    prisma.product.count()
  ]);

  return {
    items,
    page: Number(page),
    pages: Math.ceil(total / limit),
    total
  };
}

export async function get(id) {
  return prisma.product.findUnique({ where: { id } });
}

export async function create(data, file) {
  let image = null;

  if (file) {
    image = `/uploads/products/${file.filename}`;
  }

  return prisma.product.create({
    data: {
      ...data,
      price: Number(data.price),
      image
    }
  });
}

export async function update(id, data, file) {
  let updateData = {
    ...data,
    price: Number(data.price)
  };

  if (file) updateData.image = `/uploads/products/${file.filename}`;

  return prisma.product.update({
    where: { id },
    data: updateData
  });
}

export async function remove(id) {
  return prisma.product.delete({ where: { id } });
}

/* Stripe price sync */
export async function syncStripe(productId) {
  const product = await prisma.product.findUnique({ where: { id: productId } });

  if (!product) throw new Error("Product not found");

  const stripeProduct = await stripe.products.create({
    name: product.title,
    description: product.description
  });

  const stripePrice = await stripe.prices.create({
    product: stripeProduct.id,
    unit_amount: product.price * 100,
    currency: "eur"
  });

  return prisma.product.update({
    where: { id: productId },
    data: {
      stripeProductId: stripeProduct.id,
      stripePriceId: stripePrice.id
    }
  });
}
