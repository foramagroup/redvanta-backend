import prisma from "../../config/database.js";

import {
  processProductFiles,
  deleteProductFiles,
  deleteLocalFile,
} from "../../services/uploadeService.js";

const INCLUDE = {
  translations:  { include: { language: true } },
  galleryItems: { orderBy: { position: "asc" } },
  packageTiers: { orderBy: { qty: "asc" } },
  cardTypePrices: { include: { cardType: true } },
};



function format(p) {
  const title = {}, slug = {}, seoTitle = {}, metaDesc = {}, metaImage = {};
  for (const t of p.translations) {
    const code      = t.language.code;
    title[code]     = t.title;
    slug[code]      = t.slug;
    seoTitle[code]  = t.seoTitle        ?? "";
    metaDesc[code]  = t.metaDescription ?? "";
    metaImage[code] = t.metaImage       ?? "/placeholder.svg";
  }
  return {
    id: p.id, price: Number(p.price), active: p.active,
    image: p.image ?? "/placeholder.svg",
    title, slug, seoTitle, metaDescription: metaDesc, metaImage,
    gallery: p.galleryItems.map((g) => ({ url: g.url, type: g.type, poster: g.poster ?? undefined })),
    packageTiers:   p.packageTiers.map((t)   => ({ qty: t.qty, price: Number(t.price) })),
    cardTypePrices: p.cardTypePrices.map((c) => ({ typeId: c.cardTypeId, price: Number(c.price) })),
    createdAt: p.createdAt, updatedAt: p.updatedAt,
  };
}

async function validateLangIds(langIds) {
  const langs = await prisma.language.findMany({
    where: { id: { in: langIds } }, select: { id: true, code: true, status: true },
  });
  const found = new Map(langs.map((l) => [l.id, l]));
  for (const id of langIds) {
    if (!found.has(id))
      return { ok: false, message: `Langue introuvable (langId: ${id})` };
    if (found.get(id).status !== "Active")
      return { ok: false, message: `La langue "${found.get(id).code}" n'est pas active` };
  }
  return { ok: true };
}
 
async function enrichWithLangCode(body) {
  const langIds = (body.translations || []).map((t) => t.langId);
  if (!langIds.length) return body;
  const langs = await prisma.language.findMany({
    where: { id: { in: langIds } }, select: { id: true, code: true },
  });
  const map = new Map(langs.map((l) => [l.id, l.code]));
  return {
    ...body,
    translations: (body.translations || []).map((t) => ({
      ...t, lang: map.get(t.langId) ?? String(t.langId),
    })),
  };
}


export const listProducts = async (req, res, next) => {
  try {
    const data = await prisma.product.findMany({ include: INCLUDE, orderBy: { id: "asc" } });
    res.json({ success: true, data: data.map(format) });
  } catch (e) { next(e); }
};

export const getProduct = async (req, res, next) => {
  try {
    const id = +req.params.id;
    const p  = await prisma.product.findUnique({ where: { id }, include: INCLUDE });
    if (!p) return res.status(404).json({ success: false, message: "Produit introuvable" });
    res.json({ success: true, data: format(p) });
  } catch (e) { next(e); }
};

export const createProduct = async (req, res, next) => {
  try {
    const body = req.validatedBody;
 
    const langCheck = await validateLangIds(body.translations.map((t) => t.langId));
    if (!langCheck.ok) return res.status(422).json({ success: false, message: langCheck.message });
 
    for (const t of body.translations) {
      const exist = await prisma.productTranslation.findUnique({
        where: { langId_slug: { langId: t.langId, slug: t.slug } },
      });
      if (exist) return res.status(409).json({
        success: false, message: `Slug "${t.slug}" déjà utilisé (langId: ${t.langId})`,
      });
    }
 
    const enriched = await enrichWithLangCode(body);
    const { mainImage, gallery, metaImages } = await processProductFiles(enriched);
 
    const p = await prisma.product.create({
      data: {
        price: body.price, active: body.active, image: mainImage?.url ?? null,
        translations: {
          create: body.translations.map((t) => {
            const code = enriched.translations.find((u) => u.langId === t.langId)?.lang;
            return {
              langId: t.langId, title: t.title, slug: t.slug,
              seoTitle: t.seoTitle ?? null, metaDescription: t.metaDescription ?? null,
              metaImage: metaImages[code] ?? null,
            };
          }),
        },
        galleryItems:   { create: gallery.map((g) => ({ url: g.url, type: g.type, poster: g.posterUrl ?? null, position: g.position })) },
        packageTiers:   { create: body.packageTiers },
        cardTypePrices: { create: body.cardTypePrices.map((c) => ({ cardTypeId: c.cardTypeId, price: c.price })) },
      },
      include: INCLUDE,
    });
 
    res.status(201).json({ success: true, data: format(p) });
  } catch (e) {
    if (e.code === "P2002") return res.status(409).json({ success: false, message: "Slug ou entrée dupliqué" });
    if (e.code === "P2003") return res.status(422).json({ success: false, message: "Référence de langue invalide" });
    next(e);
  }
};


export const updateProduct = async (req, res, next) => {
  try {
    const id   = +req.params.id;
    const body = req.validatedBody;
 
    const existing = await prisma.product.findUnique({ where: { id }, include: INCLUDE });
    if (!existing) return res.status(404).json({ success: false, message: "Produit introuvable" });
 
    if (body.translations) {
      const langCheck = await validateLangIds(body.translations.map((t) => t.langId));
      if (!langCheck.ok) return res.status(422).json({ success: false, message: langCheck.message });
 
      for (const t of body.translations) {
        const conflict = await prisma.productTranslation.findFirst({
          where: { langId: t.langId, slug: t.slug, NOT: { productId: id } },
        });
        if (conflict) return res.status(409).json({
          success: false, message: `Slug "${t.slug}" déjà utilisé (langId: ${t.langId})`,
        });
      }
    }
 
    const enriched = body.translations ? await enrichWithLangCode(body) : body;
    const { mainImage, gallery, metaImages } = await processProductFiles(enriched);
 
    if (mainImage?.url && mainImage.url !== existing.image) deleteLocalFile(existing.image);
 
    const updated = await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          ...(body.price  !== undefined && { price:    body.price }),
          ...(body.active !== undefined && { active:   body.active }),
          ...(mainImage?.url            && { image: mainImage.url }),
        },
      });
 
      if (body.translations) {
        existing.translations.forEach((t) => deleteLocalFile(t.metaImage));
        await tx.productTranslation.deleteMany({ where: { productId: id } });
        await tx.productTranslation.createMany({
          data: body.translations.map((t) => {
            const code = enriched.translations.find((u) => u.langId === t.langId)?.lang;
            return {
              productId: id, langId: t.langId, title: t.title, slug: t.slug,
              seoTitle: t.seoTitle ?? null, metaDescription: t.metaDescription ?? null,
              metaImage: metaImages[code] ?? null,
            };
          }),
        });
      }
 
      if (body.gallery !== undefined) {
        existing.galleryItems.forEach((g) => { if (g.type !== "youtube") deleteLocalFile(g.url); deleteLocalFile(g.poster); });
        await tx.productGalleryItem.deleteMany({ where: { productId: id } });
        await tx.productGalleryItem.createMany({
          data: gallery.map((g) => ({ productId: id, url: g.url, type: g.type, poster: g.posterUrl ?? null, position: g.position })),
        });
      }
 
      if (body.packageTiers !== undefined) {
        await tx.productPackageTier.deleteMany({ where: { productId: id } });
        await tx.productPackageTier.createMany({ data: body.packageTiers.map((t) => ({ productId: id, ...t })) });
      }
 
      if (body.cardTypePrices !== undefined) {
        await tx.cardTypePrice.deleteMany({ where: { productId: id } });
        await tx.cardTypePrice.createMany({
          data: body.cardTypePrices.map((c) => ({ productId: id, cardTypeId: c.cardTypeId, price: c.price })),
        });
      }
 
      return tx.product.findUnique({ where: { id }, include: INCLUDE });
    });
 
    res.json({ success: true, data: format(updated) });
  } catch (e) {
    if (e.code === "P2002") return res.status(409).json({ success: false, message: "Slug ou entrée dupliqué" });
    if (e.code === "P2003") return res.status(422).json({ success: false, message: "Référence de langue invalide" });
    next(e);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const id       = +req.params.id;
    const existing = await prisma.product.findUnique({ where: { id }, include: INCLUDE });
    if (!existing) return res.status(404).json({ success: false, message: "Produit introuvable" });
    deleteProductFiles(existing);
    await prisma.product.delete({ where: { id } });
    res.json({ success: true, message: "Produit supprimé" });
  } catch (e) { next(e); }
};

export const toggleProduct = async (req, res, next) => {
  try {
    const id = +req.params.id;
    const p  = await prisma.product.findUnique({ where: { id } });
    if (!p) return res.status(404).json({ success: false, message: "Produit introuvable" });
    const updated = await prisma.product.update({ where: { id }, data: { active: !p.active }, include: INCLUDE });
    res.json({ success: true, data: format(updated) });
  } catch (e) { next(e); }
};

