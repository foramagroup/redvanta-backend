

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



function formatItem(item) {
  const title = item.product?.translations?.[0]?.title ?? "Product";
  return {
    id:          item.id,
    productId:   item.productId,
    productName: title,
    // Package tier info
    packageTier: item.packageTier
      ? { id: item.packageTier.id, qty: item.packageTier.qty, price: Number(item.packageTier.price) }
      : null,
    totalCards: item.totalCards,
    unitPrice:  Number(item.unitPrice),
    lineTotal:  Number(item.lineTotal),
    cardType:   item.cardType
      ? { id: item.cardType.id, name: item.cardType.name, color: item.cardType.color }
      : null,
    design: item.design ? {
      id:           item.design.id,
      status:       item.design.status,
      businessName: item.design.businessName,
      cardModel:    item.design.cardModel,
      orientation:  item.design.orientation,
      version:      item.design.version,
      validatedAt:  item.design.validatedAt,
    } : null,
    createdAt: item.createdAt,
  };
}


function getCompanyId(req) {
  const id = req.user?.companyId;
  if (!id) throw Object.assign(new Error("Aucune company active"), { status: 403 });
  return parseInt(id);
}



// GET /api/cart
export const getCart = async (req, res, next) => {
  try {
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);
    const items    = await prisma.cartItem.findMany({
      where: { userId, companyId }, include: CART_INCLUDE, orderBy: { createdAt: "asc" },
    });
    const formatted  = items.map(formatItem);
    const subtotal   = formatted.reduce((s, i) => s + i.lineTotal, 0);
    const totalCards = formatted.reduce((s, i) => s + i.totalCards, 0);
    res.json({ success: true, data: { items: formatted, itemCount: items.length, totalCards, subtotal, companyId } });
  } catch (e) { next(e); }
};

// POST /api/cart
// Body : { productId, packageTierId, cardTypeId? }
export const addToCart = async (req, res, next) => {
  try {
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);
    const { productId, packageTierId, cardTypeId } = req.body;

    if (!productId || !packageTierId) {
      return res.status(422).json({ success: false, error: "productId et packageTierId requis" });
    }

    // Vérifier que le produit existe et est actif
    const product = await prisma.product.findUnique({ where: { id: parseInt(productId) } });
    if (!product || !product.active) {
      return res.status(404).json({ success: false, error: "Produit introuvable ou inactif" });
    }

    // Vérifier que le tier appartient bien à ce produit
    const tier = await prisma.productPackageTier.findFirst({
      where: { id: parseInt(packageTierId), productId: parseInt(productId) },
    });
    if (!tier) {
      return res.status(422).json({ success: false, error: "Palier de prix introuvable pour ce produit" });
    }

    // Calculer le prix total de la ligne
    const unitPrice = Number(tier.price);
    const lineTotal = tier.qty * unitPrice;

    const item = await prisma.cartItem.create({
      data: {
        userId, companyId,
        productId:    product.id,
        packageTierId: tier.id,
        totalCards:   tier.qty,
        unitPrice,
        lineTotal,
        cardTypeId:   cardTypeId || null,
      },
      include: CART_INCLUDE,
    });

    res.status(201).json({ success: true, data: formatItem(item) });
  } catch (e) { next(e); }
};


// POST /api/cart/sync
export const syncCart = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const companyId = req.user.companyId; 
    const { items } = req.body; 

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, error: "Format de panier invalide" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const createdItems = [];

      for (const localItem of items) {
        const { productId, packageTierId, cardTypeId } = localItem;

        const tier = await tx.productPackageTier.findFirst({
          where: { 
            id: parseInt(packageTierId), 
            productId: parseInt(productId),
            product: { active: true } 
          },
          include: { product: true }
        });

        if (!tier) continue; 

        // 2. Calcul du snapshot (comme dans ton addToCart)
        const unitPrice = Number(tier.price);
        const lineTotal = tier.qty * unitPrice;

        // 3. Création dans la base
        const newItem = await tx.cartItem.create({
          data: {
            userId,
            companyId,
            productId: tier.productId,
            packageTierId: tier.id,
            totalCards: tier.qty,
            unitPrice,
            lineTotal,
            cardTypeId: cardTypeId || null,
          }
        });
        
        createdItems.push(newItem);
      }
      return createdItems;
    });

    res.status(201).json({ 
      success: true, 
      count: result.length,
      message: "Panier synchronisé avec succès" 
    });

  } catch (e) {
    next(e);
  }
};

// PUT /api/cart/:id
// Permet de changer le packageTier ou le cardType
export const updateCartItem = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);
    const { packageTierId, cardTypeId } = req.body;

    const existing = await prisma.cartItem.findFirst({
      where: { id, userId, companyId }, include: { packageTier: true },
    });
    if (!existing) return res.status(404).json({ success: false, error: "Item introuvable" });

    let updateData = {};

    // Changer de palier de prix
    if (packageTierId && packageTierId !== existing.packageTierId) {
      const tier = await prisma.productPackageTier.findFirst({
        where: { id: parseInt(packageTierId), productId: existing.productId },
      });
      if (!tier) return res.status(422).json({ success: false, error: "Palier introuvable" });

      updateData = {
        packageTierId: tier.id,
        totalCards:    tier.qty,
        unitPrice:     Number(tier.price),
        lineTotal:     tier.qty * Number(tier.price),
      };
    }

    // Changer le type de carte
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



// DELETE /api/cart/:id
export const removeFromCart = async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);

    const existing = await prisma.cartItem.findFirst({ where: { id, userId, companyId } });
    if (!existing) return res.status(404).json({ success: false, error: "Item introuvable" });

    await prisma.cartItem.delete({ where: { id } });
    res.json({ success: true, message: "Item supprimé du panier" });
  } catch (e) { next(e); }
};

// DELETE /api/cart
export const clearCart = async (req, res, next) => {
  try {
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);
    await prisma.cartItem.deleteMany({ where: { userId, companyId } });
    res.json({ success: true, message: "Panier vidé" });
  } catch (e) { next(e); }
};