// src/controllers/cart.controller.js
// ─────────────────────────────────────────────────────────────
// Deux types de produits supportés :
//
//   TYPE A — Avec packageTiers (cartes NFC, stickers, plaques...)
//     Body: { productId, packageTierId, cardTypeId? }
//     → Prix et quantité viennent du tier
//     → Design créé automatiquement avec les infos company
//
//   TYPE B — Sans packageTiers (add-ons, services, accès API...)
//     Body: { productId, quantity?, cardTypeId? }
//     → Prix vient directement du product.price
//     → quantity défaut = 1, modifiable via PUT
//     → Pas de design créé (produit non physique)
//
// La logique détecte le type selon la présence de packageTiers sur le produit
// ─────────────────────────────────────────────────────────────

import prisma from "../../config/database.js";

const CART_INCLUDE = {
  product: {
    include: {
      translations: { take: 1, orderBy: { langId: "asc" } },
      packageTiers: { orderBy: { qty: "asc" } },
    },
  },
  packageTier: true,
  design:      true,
  cardType:    true,
};

// ─── Format item ──────────────────────────────────────────────

function formatItem(item) {
  const title    = item.product?.translations?.[0]?.title ?? "Product";
  const hasTiers = (item.product?.packageTiers?.length ?? 0) > 0;

  return {
    id:          item.id,
    productId:   item.productId,
    productName: title,
    productType: hasTiers ? "tiered" : "simple",  // utile pour le front

    // ── Type A — avec tiers ──────────────────────────────────
    packageTier: item.packageTier
      ? { id: item.packageTier.id, qty: item.packageTier.qty, price: Number(item.packageTier.price) }
      : null,
    availableTiers: hasTiers
      ? item.product.packageTiers.map((t) => ({ id: t.id, qty: t.qty, price: Number(t.price) }))
      : [],

    // ── Type B — sans tiers ──────────────────────────────────
    quantity:   item.quantity   ?? 1,

    // ── Commun ───────────────────────────────────────────────
    totalCards: item.totalCards ?? 0,
    unitPrice:  Number(item.unitPrice),
    lineTotal:  Number(item.lineTotal),

    cardType: item.cardType
      ? { id: item.cardType.id, name: item.cardType.name, color: item.cardType.color }
      : null,

    // Design uniquement pour les produits physiques (Type A)
    design: item.design ? {
      id:           item.design.id,
      status:       item.design.status,
      businessName: item.design.businessName,
      cardModel:    item.design.cardModel,
      orientation:  item.design.orientation,
      version:      item.design.version,
      validatedAt:  item.design.validatedAt,
      isDefault:    item.design.status === "draft" && !item.design.validatedAt,
    } : null,

    createdAt: item.createdAt,
  };
}

function getCompanyId(req) {
  const id = req.user?.companyId;
  if (!id) throw Object.assign(new Error("Aucune company active"), { status: 403 });
  return parseInt(id);
}

// ─── Créer un design par défaut lié à la company ─────────────
// Uniquement pour les produits physiques (Type A)
async function createDefaultDesign(tx, { userId, companyId, productId, company }) {
  return tx.design.create({
    data: {
      userId, companyId, productId,
      businessName:    company?.name            ?? null,
      accentColor:     company?.primaryColor    ?? "#E10600",
      googlePlaceId:   company?.googlePlaceId   ?? null,
      googleReviewUrl: company?.googleReviewUrl ?? null,
    },
  });
}

// ─────────────────────────────────────────────────────────────
// GET /api/cart
// ─────────────────────────────────────────────────────────────

export const getCart = async (req, res, next) => {
  try {
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);

    const items = await prisma.cartItem.findMany({
      where: { userId, companyId }, include: CART_INCLUDE, orderBy: { createdAt: "asc" },
    });

    const formatted  = items.map(formatItem);
    const subtotal   = formatted.reduce((s, i) => s + i.lineTotal, 0);
    const totalCards = formatted.reduce((s, i) => s + (i.totalCards ?? 0), 0);

    res.json({
      success: true,
      data: { items: formatted, itemCount: items.length, totalCards, subtotal, companyId },
    });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// POST /api/cart
// ─────────────────────────────────────────────────────────────
// Type A : { productId, packageTierId, cardTypeId? }
// Type B : { productId, quantity?,     cardTypeId? }

export const addToCart = async (req, res, next) => {
  try {
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);
    const { productId, packageTierId, quantity, cardTypeId } = req.body;

    if (!productId) {
      return res.status(422).json({ success: false, error: "productId requis" });
    }

    // Charger le produit avec ses tiers
    const product = await prisma.product.findUnique({
      where:   { id: parseInt(productId) },
      include: { packageTiers: { orderBy: { qty: "asc" } } },
    });
    if (!product || !product.active) {
      return res.status(404).json({ success: false, error: "Produit introuvable ou inactif" });
    }

    const hasTiers = product.packageTiers.length > 0;

    // ── Validation ────────────────────────────────────────────
    if (hasTiers && !packageTierId) {
      // Produit tiered sans tier fourni → retourner les options
      return res.status(422).json({
        success: false,
        error:   "Ce produit requiert un packageTierId — choisissez un palier de quantité",
        availableTiers: product.packageTiers.map((t) => ({
          id: t.id, qty: t.qty, price: Number(t.price),
        })),
      });
    }

    if (!hasTiers && !product.price) {
      return res.status(422).json({ success: false, error: "Ce produit n'a pas de prix configuré" });
    }

    // ── Résoudre tier si applicable ───────────────────────────
    let tier = null;
    if (packageTierId) {
      tier = product.packageTiers.find((t) => t.id === parseInt(packageTierId));
      if (!tier) {
        return res.status(422).json({ success: false, error: "Palier de prix introuvable pour ce produit" });
      }
    }

    // ── Calculer prix / quantité / cartes ─────────────────────
    let unitPrice, lineTotal, totalCards, resolvedQty;

    if (tier) {
      // Type A
      unitPrice   = Number(tier.price);
      totalCards  = tier.qty;
      resolvedQty = tier.qty;
      lineTotal   = totalCards * unitPrice;
    } else {
      // Type B
      resolvedQty = Math.max(1, parseInt(quantity) || 1);
      unitPrice   = Number(product.price);
      totalCards  = 0;
      lineTotal   = resolvedQty * unitPrice;
    }

    // ── Transaction ───────────────────────────────────────────
    const item = await prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({
        where:  { id: companyId },
        select: { name: true, primaryColor: true, googlePlaceId: true, googleReviewUrl: true },
      });

      // Créer le CartItem
      const cartItem = await tx.cartItem.create({
        data: {
          userId, companyId,
          productId:     product.id,
          packageTierId: tier?.id   ?? null,
          totalCards,
          quantity:      resolvedQty,
          unitPrice,
          lineTotal,
          cardTypeId:    cardTypeId || null,
        },
      });

      // Type A uniquement → design par défaut
      if (tier) {
        const design = await createDefaultDesign(tx, {
          userId, companyId, productId: product.id, company,
        });
        await tx.cartItem.update({
          where: { id: cartItem.id },
          data:  { designId: design.id },
        });
      }

      return tx.cartItem.findUnique({ where: { id: cartItem.id }, include: CART_INCLUDE });
    });

    res.status(201).json({ success: true, data: formatItem(item) });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// POST /api/cart/sync
// Panier guest → DB après connexion
// ─────────────────────────────────────────────────────────────

export const syncCart = async (req, res, next) => {
  try {
    const userId    = req.user.userId;
    const companyId = req.user.companyId;
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, error: "Format de panier invalide" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({
        where:  { id: parseInt(companyId) },
        select: { name: true, primaryColor: true, googlePlaceId: true, googleReviewUrl: true },
      });

      const createdItems = [];

      for (const localItem of items) {
        const { productId, packageTierId, quantity, cardTypeId } = localItem;

        const product = await tx.product.findFirst({
          where:   { id: parseInt(productId), active: true },
          include: { packageTiers: true },
        });
        if (!product) continue;

        const hasTiers = product.packageTiers.length > 0;
        let tier = null;
        let unitPrice, lineTotal, totalCards, resolvedQty;

        if (hasTiers) {
          if (!packageTierId) continue; // requis pour ce type
          tier = product.packageTiers.find((t) => t.id === parseInt(packageTierId));
          if (!tier) continue;
          unitPrice   = Number(tier.price);
          totalCards  = tier.qty;
          resolvedQty = tier.qty;
          lineTotal   = totalCards * unitPrice;
        } else {
          if (!product.price) continue;
          resolvedQty = Math.max(1, parseInt(quantity) || 1);
          unitPrice   = Number(product.price);
          totalCards  = 0;
          lineTotal   = resolvedQty * unitPrice;
        }

        const cartItem = await tx.cartItem.create({
          data: {
            userId, companyId,
            productId:     product.id,
            packageTierId: tier?.id ?? null,
            totalCards,
            quantity:      resolvedQty,
            unitPrice, lineTotal,
            cardTypeId: cardTypeId || null,
          },
        });

        if (tier) {
          const design = await createDefaultDesign(tx, {
            userId, companyId, productId: product.id, company,
          });
          await tx.cartItem.update({ where: { id: cartItem.id }, data: { designId: design.id } });
        }

        createdItems.push(cartItem);
      }

      return createdItems;
    });

    res.status(201).json({ success: true, count: result.length, message: "Panier synchronisé avec succès" });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/cart/:id
// Type A : changer de tier | Type B : changer la quantité
// Les deux : changer le cardType
// ─────────────────────────────────────────────────────────────

export const updateCartItem = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);
    const { packageTierId, quantity, cardTypeId } = req.body;

    const existing = await prisma.cartItem.findFirst({
      where:   { id, userId, companyId },
      include: { packageTier: true, product: { include: { packageTiers: true } } },
    });
    if (!existing) return res.status(404).json({ success: false, error: "Item introuvable" });

    const hasTiers = existing.product?.packageTiers?.length > 0;
    let updateData = {};

    // Type A — changer de tier
    if (hasTiers && packageTierId && packageTierId !== existing.packageTierId) {
      const tier = existing.product.packageTiers.find((t) => t.id === parseInt(packageTierId));
      if (!tier) return res.status(422).json({ success: false, error: "Palier introuvable" });
      updateData = {
        packageTierId: tier.id,
        totalCards:    tier.qty,
        quantity:      tier.qty,
        unitPrice:     Number(tier.price),
        lineTotal:     tier.qty * Number(tier.price),
      };
    }

    // Type B — changer la quantité
    if (!hasTiers && quantity !== undefined) {
      const qty = Math.max(1, parseInt(quantity) || 1);
      updateData = {
        quantity: qty,
        lineTotal: qty * Number(existing.unitPrice),
      };
    }

    // Commun — changer le cardType
    if (cardTypeId !== undefined) {
      updateData.cardTypeId = cardTypeId || null;
    }

    if (!Object.keys(updateData).length) {
      return res.status(422).json({ success: false, error: "Aucun champ à modifier" });
    }

    const updated = await prisma.cartItem.update({
      where: { id }, data: updateData, include: CART_INCLUDE,
    });

    res.json({ success: true, data: formatItem(updated) });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/cart/:id
// Supprime l'item + le design draft associé (Type A uniquement)
// ─────────────────────────────────────────────────────────────

export const removeFromCart = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);

    const existing = await prisma.cartItem.findFirst({
      where: { id, userId, companyId }, include: { design: true },
    });
    if (!existing) return res.status(404).json({ success: false, error: "Item introuvable" });

    await prisma.$transaction(async (tx) => {
      await tx.cartItem.delete({ where: { id } });

      // Supprimer le design draft uniquement si aucun autre item ne l'utilise
      if (existing.designId && existing.design?.status === "draft") {
        const otherUses = await tx.cartItem.count({ where: { designId: existing.designId } });
        if (otherUses === 0) {
          await tx.design.delete({ where: { id: existing.designId } }).catch(() => {});
        }
      }
    });

    res.json({ success: true, message: "Item supprimé du panier" });
  } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/cart
// ─────────────────────────────────────────────────────────────

export const clearCart = async (req, res, next) => {
  try {
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);
    await prisma.cartItem.deleteMany({ where: { userId, companyId } });
    res.json({ success: true, message: "Panier vidé" });
  } catch (e) { next(e); }
};