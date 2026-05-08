import prisma from "../../config/database.js";



function formatProductForClient(product, langId) {
  // Construire les maps title/slug/etc par code langue
  const titleMap       = {};
  const slugMap        = {};
  const seoTitleMap    = {};
  const metaDescMap    = {};
  const metaImageMap   = {};
 
  for (const t of product.translations) {
    const code = t.language?.code ?? String(t.langId);
    titleMap[code]     = t.title;
    slugMap[code]      = t.slug;
    seoTitleMap[code]  = t.seoTitle       ?? null;
    metaDescMap[code]  = t.metaDescription ?? null;
    metaImageMap[code] = t.metaImage       ?? null;
  }
 
  const tpl = product.defaultTemplate;

  return {
    id:              product.id,
    price:           Number(product.price),
    active:          product.active,
    image:           product.image ?? null,
    cardSettings:    product.cardSettings ?? {},

    // Template par défaut (visuel)
    defaultTemplate: tpl ? {
      id:              tpl.id,
      name:            tpl.name,
      colorMode:       tpl.colorMode,
      gradient:        Array.isArray(tpl.gradient) ? tpl.gradient : JSON.parse(tpl.gradient || "[]"),
      accentColor:     tpl.accentColor,
      textColor:       tpl.textColor,
      bandColor1:      tpl.bandColor1,
      bandColor2:      tpl.bandColor2,
      qrColor:         tpl.qrColor,
      starsColor:      tpl.starsColor,
      iconsColor:      tpl.iconsColor,
      pattern:         tpl.pattern,
      bandPosition:    tpl.bandPosition,
      frontBandHeight: tpl.frontBandHeight,
      backBandHeight:  tpl.backBandHeight,
      showNfcIcon:     tpl.showNfcIcon,
      showGoogleIcon:  tpl.showGoogleIcon,
      nfcIconSize:     tpl.nfcIconSize,
      googleIconSize:  tpl.googleIconSize,
      checkStrokeWidth: tpl.checkStrokeWidth / 10,
      ctaPaddingTop:   tpl.ctaPaddingTop,
      textShadow:      tpl.textShadow,
      nameFontSize:    tpl.nameFontSize,
      nameFontWeight:  tpl.nameFontWeight,
      nameLetterSpacing: tpl.nameLetterSpacing,
      nameTextTransform: tpl.nameTextTransform,
      nameLineHeight:  tpl.nameLineHeight,
      nameTextAlign:   tpl.nameTextAlign,
      sloganFontSize:  tpl.sloganFontSize,
      sloganFontWeight: tpl.sloganFontWeight,
      instructionFontSize:   tpl.instructionFontSize,
      instructionFontWeight: tpl.instructionFontWeight,
      frontLine1: tpl.frontLine1,
      frontLine2: tpl.frontLine2,
      backLine1:  tpl.backLine1,
      backLine2:  tpl.backLine2,
      qrSize:      tpl.qrSize,
      qrPosition:  tpl.qrPosition,
      logoPosition: tpl.logoPosition,
      logoSize:     tpl.logoSize,
    } : null,

    // Maps par code langue (ex: { en: "Smart Card", fr: "Carte NFC" })
    title:           titleMap,
    slug:            slugMap,
    seoTitle:        seoTitleMap,
    metaDescription: metaDescMap,
    metaImage:       metaImageMap,

    // Paliers de prix (qty → price/carte)
    packageTiers: product.packageTiers.map((t) => ({
      id:    t.id,
      qty:   t.qty,
      price: Number(t.price),
    })),

    // Galerie (images/vidéos)
    gallery: product.galleryItems.map((g) => ({
      url:    g.url,
      type:   g.type,
      poster: g.poster ?? null,
    })),

    // Prix supplémentaires par type de carte
    cardTypePrices: product.cardTypePrices.map((c) => ({
      cardTypeId: c.cardTypeId,
      cardType:   c.cardType ? { id: c.cardType.id, name: c.cardType.name, color: c.cardType.color } : null,
      price:      Number(c.price),
    })),

    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

const PRODUCT_INCLUDE = {
  translations: {
    include: { language: { select: { code: true } } },
  },
  galleryItems: { orderBy: { position: "asc" } },
  packageTiers: { orderBy: { qty: "asc" } },
  cardTypePrices: {
    include: { cardType: true },
  },
  defaultTemplate: {
    select: {
      id: true,
      name: true,
      colorMode: true,
      gradient: true,
      accentColor: true,
      textColor: true,
      bandColor1: true,
      bandColor2: true,
      qrColor: true,
      starsColor: true,
      iconsColor: true,
      pattern: true,
      bandPosition: true,
      frontBandHeight: true,
      backBandHeight: true,
      showNfcIcon: true,
      showGoogleIcon: true,
      nfcIconSize: true,
      googleIconSize: true,
      checkStrokeWidth: true,
      ctaPaddingTop: true,
      textShadow: true,
      nameFontSize: true,
      nameFontWeight: true,
      nameLetterSpacing: true,
      nameTextTransform: true,
      nameLineHeight: true,
      nameTextAlign: true,
      sloganFontSize: true,
      sloganFontWeight: true,
      instructionFontSize: true,
      instructionFontWeight: true,
      frontLine1: true,
      frontLine2: true,
      backLine1: true,
      backLine2: true,
      qrSize: true,
      qrPosition: true,
      logoPosition: true,
      logoSize: true,
    },
  },
};


export const getShopProduct = async (req, res) => {
  try {
    const product = await prisma.product.findFirst({
      where: { active: true },
      include: {
        translations: true,
        packageTiers: {
          orderBy: {
            qty: 'asc' 
          }
        }
      }
    });

    if (!product) {
      return res.status(404).json({ message: req.t("cart.product_not_found") });
    }
    const bundles = product.packageTiers.map(tier => {
      const basePrice = product.packageTiers[0].price;
      const regularTotal = basePrice * tier.qty;
      const savings = regularTotal - tier.price;
      return {
        id: tier.id,
        qty: tier.qty,
        label: tier.qty === 1 ? "1 Card" : `${tier.qty} Cards`,
        price: tier.price,
        savingsUsd: savings > 0 ? Math.round(savings) : 0
      };
    });
    res.json({
      productId: product.id,
      image: product.image,
      bundles: bundles
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: req.t("errors.server_error") });
  }
};

export const listShopProducts = async (req, res, next) => {
  try {
    const limit  = Math.min(100, parseInt(req.query.limit) || 50);
    const products = await prisma.product.findMany({
      where:   { active: true },
      include: PRODUCT_INCLUDE,
      orderBy: { createdAt: "asc" },
      take:    limit,
    });
    res.json({
      success: true,
      data:    products.map((p) => formatProductForClient(p)),
    });
  } catch (e) { next(e); }
};

// ─── GET /api/shop/products/:slug ─────────────────────────────
// Détail d'un produit par son slug (pour la page /products/[slug])
// Le slug est unique par langue → on cherche dans les traductions
//
// Cette route permet au front de faire :
//   <Link href={`/products/${product.slug}`} />
// et d'arriver sur la page de détail
 
export const getShopProductBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    // Chercher la traduction avec ce slug
    const translation = await prisma.productTranslation.findFirst({
      where:   { slug },
      include: {
        product: { include: PRODUCT_INCLUDE },
        language: { select: { code: true } },
      },
    });
 
    if (!translation || !translation.product.active) {
      return res.status(404).json({ success: false, error: req.t("cart.product_not_found") });
    }
 
    res.json({
      success: true,
      data:    formatProductForClient(translation.product),
    });
  } catch (e) { next(e); }
};


// ─── GET /api/shop/products/:id/package-tiers ─────────────────
// Retourne les paliers de prix d'un produit
// Utilisé lors de l'ajout au panier pour choisir la quantité
//
// Exemple de retour :
// [
//   { id:1, qty:1,   price:29, lineTotal:29 },
//   { id:2, qty:10,  price:24, lineTotal:240 },
//   { id:3, qty:50,  price:19, lineTotal:950 },
//   { id:4, qty:100, price:15, lineTotal:1500 },
// ]
 
export const getProductPackageTiers = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
 
    const product = await prisma.product.findFirst({
      where:   { id, active: true },
      include: { packageTiers: { orderBy: { qty: "asc" } } },
    });
 
    if (!product) return res.status(404).json({ success: false, error: req.t("cart.product_not_found") });
 
    const tiers = product.packageTiers.map((t) => ({
      id:        t.id,
      qty:       t.qty,
      price:     Number(t.price),      // prix unitaire par carte
      lineTotal: Number(t.price) * t.qty, // total pour ce palier
    }));
 
    res.json({ success: true, data: tiers });
  } catch (e) { next(e); }
};


// ─── GET /api/shop/products/:id/card-types ────────────────────
// Retourne les types de cartes disponibles pour un produit
// avec leur prix additionnel
// Utilisé dans la sélection du type de carte lors de l'ajout au panier
export const getProductCardTypes = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
 
    const product = await prisma.product.findFirst({
      where: { id, active: true },
      include: {
        cardTypePrices: {
          include: { cardType: true },
          orderBy: { cardType: { name: "asc" } },
        },
      },
    });
 
    if (!product) return res.status(404).json({ success: false, error: req.t("cart.product_not_found") });
 
    const cardTypes = product.cardTypePrices
      .filter((c) => c.cardType?.active)
      .map((c) => ({
        id:           c.cardType.id,
        name:         c.cardType.name,
        color:        c.cardType.color,
        image:        c.cardType.image ?? null,
        extraPrice:   Number(c.price), 
      }));
 
    res.json({ success: true, data: cardTypes });
  } catch (e) { next(e); }
};

