// src/services/productService.js
import db from "../config/db.js";

export const createProduct = (data) =>
  db.product.create({ data });

export const getProducts = () =>
  db.product.findMany();
