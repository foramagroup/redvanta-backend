// src/routes/shop.routes.js

import { Router } from "express";
import { authenticateAdmin, requireAdmin } from "../../middleware/auth.middleware.js";

import {
  getCart, addToCart, updateCartItem, removeFromCart, clearCart, syncCart, updateCartItemLocations,
} from "../../controllers/client/CartController.js";

import {
  getDesignById, getDesignByCartItem, createDesign,
  saveStep1, saveStep2, validateDesign,
  getVersions, restoreVersion,
} from "../../controllers/client/DesignController.js";

import {
  getShippingRates, createOrder, listOrders, getOrder, stripeWebhook, getPaymentMethods
} from "../../controllers/client/Order.controller.js";

import express from "express";

const router = Router();

const auth = [authenticateAdmin, requireAdmin];

// ── Panier ────────────────────────────────────────────────────
// GET    /api/cart              → afficher le panier
// POST   /api/cart              → ajouter un produit
// PUT    /api/cart/:id          → modifier quantité / cardType
// DELETE /api/cart/:id          → supprimer un item
// DELETE /api/cart              → vider le panier

router.get   ("/cart",     ...auth, getCart);
router.post  ("/cart",     ...auth, addToCart);
router.post  ("/sync",     ...auth, syncCart);
router.put   ("/cart/:id", ...auth, updateCartItem);
router.put("/cart/:id/locations", ...auth, updateCartItemLocations);
router.delete("/cart/:id", ...auth, removeFromCart);
router.delete("/cart",     ...auth, clearCart);

// ── Design / Customize ────────────────────────────────────────
// GET  /api/designs/cart-item/:cartItemId → design associé à un item panier
// POST /api/designs                       → créer un nouveau design
// PUT  /api/designs/:id/step1             → sauvegarder étape 1 (Business)
// PUT  /api/designs/:id/step2             → sauvegarder étape 2 (Design)
// PUT  /api/designs/:id/validate          → valider le design (étape 3)
// GET  /api/designs/:id/versions          → historique des versions
// POST /api/designs/:id/restore/:vId      → restaurer une version

router.get  ("/designs/:id",                        ...auth, getDesignById);
router.get  ("/designs/cart-item/:cartItemId",     ...auth, getDesignByCartItem);
router.post ("/designs",                           ...auth, createDesign);
router.put  ("/designs/:id/step1",                 ...auth, saveStep1);
router.put  ("/designs/:id/step2",                 ...auth, saveStep2);
router.put  ("/designs/:id/validate",              ...auth, validateDesign);
router.get  ("/designs/:id/versions",              ...auth, getVersions);
router.post ("/designs/:id/restore/:versionId",    ...auth, restoreVersion);

// ── Commandes ─────────────────────────────────────────────────
// GET  /api/orders/shipping-rates → tarifs d'expédition actifs
// POST /api/orders                → créer une commande (depuis le panier)
// GET  /api/orders                → liste des commandes du user
// GET  /api/orders/:id            → détail d'une commande
router.get  ("/orders/shipping-rates", ...auth, getShippingRates);
router.post ("/orders",                ...auth, createOrder);
router.get  ("/orders",                ...auth, listOrders);
router.get  ("/orders/:id",            ...auth, getOrder);



// GET /api/payment-methods
router.get("/payment-methods", ...auth, getPaymentMethods);

export default router;