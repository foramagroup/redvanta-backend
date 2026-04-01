import express from 'express';
import {getShopProduct, listShopProducts, getShopProductBySlug, getProductPackageTiers, getProductCardTypes} from '../../controllers/client/productViewController.js';

const router = express.Router();
router.get('/shop-details', getShopProduct);


router.get("/", listShopProducts);


 
// ─── GET /api/shop/products/:slug ────────────────────────────
// Détail produit par slug (page /products/[slug])
router.get("/by-slug/:slug", getShopProductBySlug);



 
// ─── GET /api/shop/products/:id/package-tiers ────────────────
// Paliers de prix pour un produit (choix quantité dans panier)
router.get("/:id/package-tiers",  getProductPackageTiers);


 
// ─── GET /api/shop/products/:id/card-types ───────────────────
// Types de cartes disponibles pour un produit
router.get("/:id/card-types", getProductCardTypes);
export default router;