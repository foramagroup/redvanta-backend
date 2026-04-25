// src/controllers/cart.controller.js — v2
// ─────────────────────────────────────────────────────────────
// Deux types de produits supportés :
//
//   TYPE A — Avec packageTiers (cartes NFC, stickers, plaques...)
//     Body: { productId, packageTierId, cardTypeId?, locations[] }
//     → Prix et quantité viennent du tier
//
//   TYPE B — Sans packageTiers (add-ons, services...)
//     Body: { productId, quantity?, cardTypeId?, locations[] }
//     → Prix vient directement du product.price
//
// ── locations[] (nouveau champ v2) ──────────────────────────
//   Chaque location : {
//     quantity    : Int          // nb de cartes pour cette location
//     platform    : String       // "google"|"facebook"|"instagram"|"custom"
//     data        : {
//       businessName? : String   // google
//       handle?       : String   // instagram
//       url?          : String   // facebook / custom
//     }
//     cardColor   : String       // hex, ex: "#0A0A0A"
//   }
//   Contrainte : somme des quantity == totalCards
//   Chaque location reçoit son propre Design en base.
//
//   Si locations[] absent → comportement legacy (1 design global depuis template)
// ─────────────────────────────────────────────────────────────

import prisma from "../../config/database.js";
import { productNeedsDesign } from "../../helpers/designResolver.helpers.js";

// ─────────────────────────────────────────────────────────────
// INCLUDES
// ─────────────────────────────────────────────────────────────

const CART_INCLUDE = {
  product: {
    include: {
      translations: { take: 1, orderBy: { langId: "asc" } },
      packageTiers: { orderBy: { qty: "asc" } },
      defaultTemplate: true,
    },
  },
  packageTier: true,
  design: true,           // legacy single design
  cardType: true,
  locations: {            // v2 multi-location
    include: { design: true },
    orderBy: { sortOrder: "asc" },
  },
};

// ─────────────────────────────────────────────────────────────
// HELPERS — FORMAT
// ─────────────────────────────────────────────────────────────

function formatLocation(loc) {
  return {
    id: loc.id,
    quantity: loc.quantity,
    platform: loc.platform,
    businessName: loc.businessName,
    handle: loc.handle,
    url: loc.url,
    cardColor: loc.cardColor || "#0A0A0A",
    sortOrder: loc.sortOrder,
    design: loc.design
      ? {
          id: loc.design.id,
          status: loc.design.status,
          businessName: loc.design.businessName,
          platform: loc.design.platform,
          cardModel: loc.design.cardModel,
          orientation: loc.design.orientation,
          version: loc.design.version,
          validatedAt: loc.design.validatedAt,
        }
      : null,
  };
}

function formatItem(item) {
  const title = item.product?.translations?.[0]?.title ?? "Product";
  const hasTiers = (item.product?.packageTiers?.length ?? 0) > 0;
  const hasLocations = (item.locations?.length ?? 0) > 0;

  return {
    id: item.id,
    productId: item.productId,
    productName: title,
    productType: hasTiers ? "tiered" : "simple",

    // ── Type A — avec tiers ──────────────────────────────────
    packageTier: item.packageTier
      ? { id: item.packageTier.id, qty: item.packageTier.qty, price: Number(item.packageTier.price) }
      : null,
    availableTiers: hasTiers
      ? item.product.packageTiers.map((t) => ({ id: t.id, qty: t.qty, price: Number(t.price) }))
      : [],

    // ── Type B — sans tiers ──────────────────────────────────
    quantity: item.quantity ?? 1,

    // ── Commun ───────────────────────────────────────────────
    totalCards: item.totalCards ?? 0,
    unitPrice: Number(item.unitPrice),
    lineTotal: Number(item.lineTotal),

    cardType: item.cardType
      ? { id: item.cardType.id, name: item.cardType.name, color: item.cardType.color }
      : null,

    // ── v2 : Locations multiples ──────────────────────────────
    // "hasLocations" indique au front s'il doit afficher le nouveau mode
    hasLocations,
    locations: hasLocations ? item.locations.map(formatLocation) : [],

    // ── Legacy : Design unique (compat v1) ────────────────────
    design:
      !hasLocations && item.design
        ? {
            id: item.design.id,
            status: item.design.status,
            businessName: item.design.businessName,
            cardModel: item.design.cardModel,
            orientation: item.design.orientation,
            version: item.design.version,
            validatedAt: item.design.validatedAt,
            isDefault: item.design.status === "draft" && !item.design.validatedAt,
          }
        : null,

    createdAt: item.createdAt,
  };
}

function getCompanyId(req) {
  const id = req.user?.companyId;
  if (!id) throw Object.assign(new Error("Aucune company active"), { status: 403 });
  return parseInt(id);
}

// ─────────────────────────────────────────────────────────────
// HELPERS — DESIGN
// ─────────────────────────────────────────────────────────────

/**
 * Résout les valeurs par défaut depuis le template DB du produit.
 * Utilisé aussi bien pour le design legacy que pour chaque location.
 */
async function resolveDesignDefaultsFromTemplate(product, company) {
  try {
    let template = null;

    if (product.defaultTemplateId) {
      template =
        product.defaultTemplate ||
        (await prisma.cardTemplate.findUnique({
          where: { id: product.defaultTemplateId },
        }));
    }

    if (!template && product.reviewPlatform) {
      template = await prisma.cardTemplate.findFirst({
        where: {
          platform: product.reviewPlatform,
          isActive: true,
          isDefault: true,
          isCardSetting: true,
        },
      });
    }

    if (!template) {
      console.warn(`⚠️ No template found for product ${product.id} - using generic defaults`);
      return {
        platform: product.reviewPlatform || "google",
        orientation: "landscape",
        templateName: null,
        colorMode: "template",
        gradient1: "#0D0D0D",
        gradient2: "#1A1A1A",
        textColor: "#FFFFFF",
        accentBand1: company?.primaryColor || "#E10600",
        accentBand2: company?.primaryColor || "#E10600",
        bandPosition: "bottom",
        frontBandHeight: 22,
        backBandHeight: 12,
        frontInstruction1: "Approach your phone to the card",
        frontInstruction2: "Tap to leave a review",
        backInstruction1: "Scan the QR code with your camera",
        backInstruction2: "Write a review on our profile page",
      };
    }

    const gradientArray = Array.isArray(template.gradient)
      ? template.gradient
      : JSON.parse(template.gradient || '["#0D0D0D", "#1A1A1A"]');

    const cardModel =
      template?.model && template.model.trim() !== "" ? template.model : "classic";

    return {
      platform: product.reviewPlatform || template.platform || "google",
      orientation: template.orientation || "landscape",
      templateName: template.name,
      colorMode: template.colorMode || "template",
      gradient1: gradientArray[0] || "#0D0D0D",
      gradient2: gradientArray[1] || "#1A1A1A",
      textColor: template.textColor || "#FFFFFF",
      accentColor: template.qrColor || company?.primaryColor || "#E10600",
      accentBand1: template.bandColor1 || "#E10600",
      accentBand2: template.bandColor2 || "#FF4444",
      bandPosition: template.bandPosition || "bottom",
      frontBandHeight: template.frontBandHeight || 22,
      backBandHeight: template.backBandHeight || 12,
      frontInstruction1: template.frontLine1 || "Approach your phone to the card",
      frontInstruction2: template.frontLine2 || "Tap to leave a review",
      backInstruction1: template.backLine1 || "Scan the QR code with your camera",
      backInstruction2: template.backLine2 || "Write a review on our profile page",
      businessFont: template.nameFont || "Space Grotesk",
      businessFontSize: template.nameFontSize || 16,
      businessFontWeight: template.nameFontWeight || "Bold",
      businessFontSpacing: template.nameLetterSpacing || "Normal",
      businessLineHeight: template.nameLineHeight || "1.2",
      businessAlign: template.nameTextAlign || "Left",
      businessTextTransform: template.nameTextTransform || "none",
      sloganFont: template.sloganFont || "Inter",
      slogan: template.slogan || "slogan",
      sloganFontSize: template.sloganFontSize || 12,
      sloganFontWeight: template.sloganFontWeight || "Regular",
      sloganFontSpacing: template.sloganLetterSpacing || "Normal",
      sloganLineHeight: template.sloganLineHeight || "1.4",
      sloganAlign: template.sloganTextAlign || "Left",
      sloganTextTransform: template.sloganTextTransform || "none",
      instrFont: template.instructionFont || "Space Grotesk",
      instrFontSize: template.instructionFontSize || 10,
      instrFontWeight: template.instructionFontWeight || "Regular",
      instrFontSpacing: template.instructionLetterSpacing || "Normal",
      instrLineHeight: template.instructionLineHeight || "1.4",
      instrAlign: template.instructionTextAlign || "Left",
      checkStrokeWidth: template.checkStrokeWidth
        ? parseFloat((template.checkStrokeWidth / 10).toFixed(1))
        : 3.5,
      showNfcIcon: template.showNfcIcon ?? true,
      showGoogleIcon: template.showGoogleIcon ?? true,
      nfcIconSize: template.nfcIconSize || 16,
      googleLogoSize: template.googleIconSize || 20,
      textShadow: template.textShadow || "None",
      logoPosition: template.logoPosition || "left",
      logoSize: template.logoSize || 32,
      qrCodeStyle: template.qrPosition || "Left",
      qrCodeSize: template.qrSize || 60,
      cardModel,
      elementOffsets: template.elementOffsets || null,
    };
  } catch (error) {
    console.error("❌ Error resolving design defaults from template:", error);
    return {
      platform: product.reviewPlatform || "google",
      orientation: "landscape",
      colorMode: "single",
      gradient1: "#0D0D0D",
      gradient2: "#1A1A1A",
      textColor: "#FFFFFF",
      accentColor: company?.primaryColor || "#E10600",
      frontInstruction1: "Approach your phone to the card",
      frontInstruction2: "Tap to leave a review",
    };
  }
}

/**
 * Crée un Design pour une location spécifique du ConfiguratorModal.
 * Fusionne les valeurs du template DB avec les données saisies par l'utilisateur.
 *
 * @param {Object} loc - { quantity, platform, data: {businessName?,handle?,url?}, cardColor }
 */
async function createLocationDesign(tx, { userId, companyId, productId, company, product, location }) {
  const defaults = await resolveDesignDefaultsFromTemplate(product, company);
  const { platform, data = {}, cardColor } = location;

  // ── Résoudre les données métier de la location ────────────
  const businessName = data.businessName || company?.name || null;
  const handle = data.handle || null;
  const rawUrl = data.url || null;

  // URL canonique selon la plateforme
  const googlePlaceId = platform === "google" ? (data.placeId || company?.googlePlaceId || null) : null;
  const googleReviewUrl = platform === "google" ? (rawUrl || company?.googleReviewUrl || null) : null;
  const platformUrl =
    platform === "instagram" && handle
      ? `https://instagram.com/${handle.replace(/^@/, "")}`
      : platform !== "google"
      ? rawUrl
      : null;

  // ── Card color : si l'user a choisi une couleur dans le modal ──
  // cardColor remplace le gradient du template et force colorMode = "single"
  const hasCustomColor = Boolean(cardColor && cardColor !== "#0A0A0A");

  const designData = {
    userId,
    companyId,
    productId,

    // Template defaults (base)
    ...defaults,

    // Données métier de la location (override)
    businessName,
    platform,
    googlePlaceId,
    googleReviewUrl,
    platformUrl,

    // Couleur de carte choisie dans le modal (override)
    ...(hasCustomColor
      ? {
          colorMode: "single",
          gradient1: cardColor,
          gradient2: cardColor,
          bgColor: cardColor,
        }
      : {}),

    // Couleur accent depuis la company
    accentColor: company?.primaryColor || defaults.accentColor,
    callToAction: "Powered by RedVanta",
  };

  const design = await tx.design.create({ data: designData });

  console.log("✅ Location design created:", {
    designId: design.id,
    platform,
    businessName,
    cardColor,
    productId,
  });

  return design;
}

/**
 * Crée un Design global (legacy v1) lié à la company.
 * Utilisé quand aucune location n'est fournie.
 */
async function createDefaultDesign(tx, { userId, companyId, productId, company, product }) {
  const defaults = await resolveDesignDefaultsFromTemplate(product, company);

  return tx.design.create({
    data: {
      userId,
      companyId,
      productId,
      businessName: company?.name ?? null,
      googlePlaceId: company?.googlePlaceId ?? null,
      googleReviewUrl: company?.googleReviewUrl ?? null,
      ...defaults,
      accentColor: company?.primaryColor || defaults.accentColor,
      callToAction: "Powered by RedVanta",
    },
  });
}

/**
 * Valide le tableau de locations reçu depuis le front.
 * Retourne { valid: true } ou { valid: false, error: String }
 */
function validateLocations(locations, expectedTotal) {
  if (!Array.isArray(locations) || locations.length === 0) {
    return { valid: false, error: "Le tableau locations[] est vide ou invalide" };
  }

  const locTotal = locations.reduce((s, l) => s + (parseInt(l.quantity) || 0), 0);
  if (locTotal !== expectedTotal) {
    return {
      valid: false,
      error: `La somme des quantités des locations (${locTotal}) doit être égale au total (${expectedTotal})`,
    };
  }

  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i];
    if (!loc.platform) {
      return { valid: false, error: `Location #${i + 1} : plateforme manquante` };
    }
    const hasData = loc.data?.businessName?.trim() || loc.data?.handle?.trim() || loc.data?.url?.trim();
    if (!hasData) {
      return { valid: false, error: `Location #${i + 1} : données de plateforme manquantes` };
    }
    if ((parseInt(loc.quantity) || 0) < 1) {
      return { valid: false, error: `Location #${i + 1} : quantité invalide` };
    }
  }

  return { valid: true };
}

/**
 * Crée toutes les CartItemLocations + leur Design pour un CartItem donné.
 * Utilisé dans addToCart ET dans updateCartItem (remplacement complet).
 */
async function createLocations(tx, { cartItemId, locations, userId, companyId, product, company }) {
  const created = [];

  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i];

    const design = await createLocationDesign(tx, {
      userId,
      companyId,
      productId: product.id,
      company,
      product,
      location: loc,
    });

    const cartItemLocation = await tx.cartItemLocation.create({
      data: {
        cartItemId,
        quantity: parseInt(loc.quantity),
        platform: loc.platform,
        businessName: loc.data?.businessName || null,
        handle: loc.data?.handle || null,
        url: loc.data?.url || null,
        cardColor: loc.cardColor || "#0A0A0A",
        designId: design.id,
        sortOrder: i,
      },
      include: { design: true },
    });

    created.push(cartItemLocation);
  }

  return created;
}

/**
 * Supprime toutes les locations (+ leurs designs draft) d'un CartItem.
 */
async function deleteLocations(tx, cartItemId) {
  const existingLocations = await tx.cartItemLocation.findMany({
    where: { cartItemId },
    include: { design: true },
  });

  // Collecter les designIds à supprimer (seulement les drafts)
  const draftDesignIds = existingLocations
    .filter((l) => l.designId && l.design?.status === "draft")
    .map((l) => l.designId);

  // Supprimer les locations (cascade depuis CartItem, mais on le fait explicitement)
  await tx.cartItemLocation.deleteMany({ where: { cartItemId } });

  // Supprimer les designs orphelins
  for (const designId of draftDesignIds) {
    await tx.design.delete({ where: { id: designId } }).catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/cart
// ─────────────────────────────────────────────────────────────

export const getCart = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const companyId = getCompanyId(req);

    const items = await prisma.cartItem.findMany({
      where: { userId, companyId },
      include: CART_INCLUDE,
      orderBy: { createdAt: "asc" },
    });

    const formatted = items.map(formatItem);
    const subtotal = formatted.reduce((s, i) => s + i.lineTotal, 0);
    const totalCards = formatted.reduce((s, i) => s + (i.totalCards ?? 0), 0);

    res.json({
      success: true,
      data: { items: formatted, itemCount: items.length, totalCards, subtotal, companyId },
    });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/cart
// ─────────────────────────────────────────────────────────────
// Type A : { productId, packageTierId, cardTypeId?, locations? }
// Type B : { productId, quantity?,     cardTypeId?, locations? }
//
// locations[] — obligatoire si le produit a été configuré via le modal
// Si absent, comportement legacy : 1 design global depuis le template

export const addToCart = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const companyId = getCompanyId(req);
    const { productId, packageTierId, quantity, cardTypeId, locations } = req.body;

    if (!productId) {
      return res.status(422).json({ success: false, error: "productId requis" });
    }

    // ── Charger le produit ─────────────────────────────────────
    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) },
      include: {
        packageTiers: { orderBy: { qty: "asc" } },
        defaultTemplate: true,
      },
    });

    if (!product || !product.active) {
      return res.status(404).json({ success: false, error: "Produit introuvable ou inactif" });
    }

    const hasTiers = product.packageTiers.length > 0;

    // ── Validation du tier ─────────────────────────────────────
    if (hasTiers && !packageTierId) {
      return res.status(422).json({
        success: false,
        error: "Ce produit requiert un packageTierId",
        availableTiers: product.packageTiers.map((t) => ({
          id: t.id,
          qty: t.qty,
          price: Number(t.price),
        })),
      });
    }

    if (!hasTiers && !product.price) {
      return res.status(422).json({ success: false, error: "Ce produit n'a pas de prix configuré" });
    }

    // ── Résoudre le tier ───────────────────────────────────────
    let tier = null;
    if (packageTierId) {
      tier = product.packageTiers.find((t) => t.id === parseInt(packageTierId));
      if (!tier) {
        return res.status(422).json({ success: false, error: "Palier de prix introuvable pour ce produit" });
      }
    }

    // ── Calculer prix / quantité ───────────────────────────────
    let unitPrice, lineTotal, totalCards, resolvedQty;

    if (tier) {
      unitPrice = Number(tier.price);
      totalCards = tier.qty;
      resolvedQty = tier.qty;
      lineTotal = totalCards * unitPrice;
    } else {
      resolvedQty = Math.max(1, parseInt(quantity) || 1);
      unitPrice = Number(product.price);
      totalCards = 0;
      lineTotal = resolvedQty * unitPrice;
    }

    // ── Valider les locations si fournies ──────────────────────
    const hasLocations = Array.isArray(locations) && locations.length > 0;

    if (hasLocations) {
      const expectedTotal = totalCards || resolvedQty;
      const validation = validateLocations(locations, expectedTotal);
      if (!validation.valid) {
        return res.status(422).json({ success: false, error: validation.error });
      }
    }

    // ── Transaction ────────────────────────────────────────────
    const item = await prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { name: true, primaryColor: true, googlePlaceId: true, googleReviewUrl: true },
      });

      // Créer le CartItem (sans designId si on utilise les locations)
      const cartItem = await tx.cartItem.create({
        data: {
          userId,
          companyId,
          productId: product.id,
          packageTierId: tier?.id ?? null,
          totalCards,
          quantity: resolvedQty,
          unitPrice,
          lineTotal,
          cardTypeId: cardTypeId || null,
          // designId null → sera rempli uniquement en mode legacy
        },
      });

      if (hasLocations) {
        // ── v2 : créer une location + un design par location ────
        await createLocations(tx, {
          cartItemId: cartItem.id,
          locations,
          userId,
          companyId,
          product,
          company,
        });

        console.log("✅ CartItem created with locations:", {
          cartItemId: cartItem.id,
          locationCount: locations.length,
        });
      } else {
        // ── Legacy v1 : 1 design global ─────────────────────────
        if (productNeedsDesign(product)) {
          const design = await createDefaultDesign(tx, {
            userId,
            companyId,
            productId: product.id,
            company,
            product,
          });
          await tx.cartItem.update({
            where: { id: cartItem.id },
            data: { designId: design.id },
          });

          console.log("✅ CartItem created with legacy design:", {
            cartItemId: cartItem.id,
            designId: design.id,
          });
        }
      }

      return tx.cartItem.findUnique({ where: { id: cartItem.id }, include: CART_INCLUDE });
    });

    res.status(201).json({ success: true, data: formatItem(item) });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/cart/sync
// Panier guest → DB après connexion (supporte le nouveau format locations[])
// ─────────────────────────────────────────────────────────────

export const syncCart = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const companyId = req.user.companyId;
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, error: "Format de panier invalide" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({
        where: { id: parseInt(companyId) },
        select: { name: true, primaryColor: true, googlePlaceId: true, googleReviewUrl: true },
      });

      const createdItems = [];

      for (const localItem of items) {
        const { productId, packageTierId, quantity, cardTypeId, locations } = localItem;

        const product = await tx.product.findFirst({
          where: { id: parseInt(productId), active: true },
          include: {
            packageTiers: true,
            defaultTemplate: true,
          },
        });
        if (!product) continue;

        const hasTiers = product.packageTiers.length > 0;
        let tier = null;
        let unitPrice, lineTotal, totalCards, resolvedQty;

        if (hasTiers) {
          if (!packageTierId) continue;
          tier = product.packageTiers.find((t) => t.id === parseInt(packageTierId));
          if (!tier) continue;
          unitPrice = Number(tier.price);
          totalCards = tier.qty;
          resolvedQty = tier.qty;
          lineTotal = totalCards * unitPrice;
        } else {
          if (!product.price) continue;
          resolvedQty = Math.max(1, parseInt(quantity) || 1);
          unitPrice = Number(product.price);
          totalCards = 0;
          lineTotal = resolvedQty * unitPrice;
        }

        const hasLocations = Array.isArray(locations) && locations.length > 0;

        // Validation rapide des locations
        if (hasLocations) {
          const expectedTotal = totalCards || resolvedQty;
          const validation = validateLocations(locations, expectedTotal);
          if (!validation.valid) {
            console.warn(`⚠️ Sync: locations invalides pour produit ${productId} - skipped:`, validation.error);
            continue;
          }
        }

        const cartItem = await tx.cartItem.create({
          data: {
            userId,
            companyId,
            productId: product.id,
            packageTierId: tier?.id ?? null,
            totalCards,
            quantity: resolvedQty,
            unitPrice,
            lineTotal,
            cardTypeId: cardTypeId || null,
          },
        });

        if (hasLocations) {
          await createLocations(tx, {
            cartItemId: cartItem.id,
            locations,
            userId,
            companyId,
            product,
            company,
          });

          console.log("✅ Sync: CartItem with locations:", {
            cartItemId: cartItem.id,
            locationCount: locations.length,
          });
        } else if (productNeedsDesign(product)) {
          const design = await createDefaultDesign(tx, {
            userId,
            companyId,
            productId: product.id,
            company,
            product,
          });
          await tx.cartItem.update({
            where: { id: cartItem.id },
            data: { designId: design.id },
          });

          console.log("✅ Sync: CartItem with legacy design:", {
            cartItemId: cartItem.id,
            designId: design.id,
          });
        }

        createdItems.push(cartItem);
      }

      return createdItems;
    });

    res.status(201).json({
      success: true,
      count: result.length,
      message: "Panier synchronisé avec succès",
    });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/cart/:id
// Champs généraux : tier, quantity, cardType
// ─────────────────────────────────────────────────────────────

export const updateCartItem = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user.userId;
    const companyId = getCompanyId(req);
    const { packageTierId, quantity, cardTypeId } = req.body;

    const existing = await prisma.cartItem.findFirst({
      where: { id, userId, companyId },
      include: {
        packageTier: true,
        product: { include: { packageTiers: true } },
      },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Item introuvable" });
    }

    const hasTiers = existing.product?.packageTiers?.length > 0;
    let updateData = {};

    // Type A — changer de tier
    if (hasTiers && packageTierId && packageTierId !== existing.packageTierId) {
      const tier = existing.product.packageTiers.find((t) => t.id === parseInt(packageTierId));
      if (!tier) {
        return res.status(422).json({ success: false, error: "Palier introuvable" });
      }
      updateData = {
        packageTierId: tier.id,
        totalCards: tier.qty,
        quantity: tier.qty,
        unitPrice: Number(tier.price),
        lineTotal: tier.qty * Number(tier.price),
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
      where: { id },
      data: updateData,
      include: CART_INCLUDE,
    });

    res.json({ success: true, data: formatItem(updated) });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/cart/:id/locations
// Remplace toutes les locations d'un CartItem (après édition dans le modal)
//
// Body: { locations: [...] }  ← même format que POST /api/cart
// ─────────────────────────────────────────────────────────────

export const updateCartItemLocations = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user.userId;
    const companyId = getCompanyId(req);
    const { locations } = req.body;

    if (!Array.isArray(locations) || locations.length === 0) {
      return res.status(422).json({ success: false, error: "locations[] requis et non vide" });
    }

    // Charger le CartItem avec ses données
    const existing = await prisma.cartItem.findFirst({
      where: { id, userId, companyId },
      include: {
        product: { include: { packageTiers: true, defaultTemplate: true } },
        locations: { include: { design: true } },
      },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Item introuvable" });
    }

    // Total de cartes attendu
    const expectedTotal = existing.totalCards || existing.quantity;

    // Valider les nouvelles locations
    const validation = validateLocations(locations, expectedTotal);
    if (!validation.valid) {
      return res.status(422).json({ success: false, error: validation.error });
    }

    const updatedItem = await prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { name: true, primaryColor: true, googlePlaceId: true, googleReviewUrl: true },
      });

      // 1. Supprimer les anciennes locations + leurs designs draft
      await deleteLocations(tx, id);

      // 2. Créer les nouvelles locations + designs
      await createLocations(tx, {
        cartItemId: id,
        locations,
        userId,
        companyId,
        product: existing.product,
        company,
      });

      console.log("✅ CartItem locations updated:", {
        cartItemId: id,
        newLocationCount: locations.length,
      });

      return tx.cartItem.findUnique({ where: { id }, include: CART_INCLUDE });
    });

    res.json({ success: true, data: formatItem(updatedItem) });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/cart/:id
// Supprime l'item + toutes ses locations + leurs designs draft
// ─────────────────────────────────────────────────────────────

export const removeFromCart = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user.userId;
    const companyId = getCompanyId(req);

    const existing = await prisma.cartItem.findFirst({
      where: { id, userId, companyId },
      include: {
        design: true,                               // legacy design
        locations: { include: { design: true } },  // location designs v2
      },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Item introuvable" });
    }

    await prisma.$transaction(async (tx) => {
      // Collecter tous les designIds à supprimer (locations v2)
      const locationDraftDesignIds = (existing.locations || [])
        .filter((l) => l.designId && l.design?.status === "draft")
        .map((l) => l.designId);

      // Supprimer le CartItem → cascade sur les CartItemLocations
      await tx.cartItem.delete({ where: { id } });

      // Supprimer les designs des locations (devenus orphelins après cascade)
      for (const designId of locationDraftDesignIds) {
        await tx.design.delete({ where: { id: designId } }).catch(() => {});
      }

      // Supprimer le legacy design si draft et non utilisé ailleurs
      if (existing.designId && existing.design?.status === "draft") {
        const otherUses = await tx.cartItem.count({ where: { designId: existing.designId } });
        if (otherUses === 0) {
          await tx.design.delete({ where: { id: existing.designId } }).catch(() => {});
        }
      }
    });

    res.json({ success: true, message: "Item supprimé du panier" });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/cart
// ─────────────────────────────────────────────────────────────

export const clearCart = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const companyId = getCompanyId(req);

    // Récupérer tous les designs à supprimer avant de vider le panier
    const items = await prisma.cartItem.findMany({
      where: { userId, companyId },
      include: {
        design: true,
        locations: { include: { design: true } },
      },
    });

    await prisma.$transaction(async (tx) => {
      // Supprimer tous les items (cascade sur locations)
      await tx.cartItem.deleteMany({ where: { userId, companyId } });

      // Supprimer les designs orphelins
      for (const item of items) {
        // Legacy design
        if (item.designId && item.design?.status === "draft") {
          await tx.design.delete({ where: { id: item.designId } }).catch(() => {});
        }

        // Location designs
        for (const loc of item.locations || []) {
          if (loc.designId && loc.design?.status === "draft") {
            await tx.design.delete({ where: { id: loc.designId } }).catch(() => {});
          }
        }
      }
    });

    res.json({ success: true, message: "Panier vidé" });
  } catch (e) {
    next(e);
  }
};