import prisma from "../../config/database.js";

const INCLUDE = {
  translations: {
    include: { language: { select: { id: true, code: true } } },
    orderBy: { languageId: "asc" },
  },
};

// Convertit un enregistrement DB vers la forme JSON attendue par le frontend.
function formatPage(p) {
  const nameTranslations = {};
  const slugTranslations = {};
  const seoTitles        = {};
  const seoDescriptions  = {};

  (p.translations ?? []).forEach((t) => {
    const code = t.language?.code ?? String(t.languageId);
    nameTranslations[code] = t.name;
    slugTranslations[code] = t.slug;
    seoTitles[code]        = t.seoTitle ?? "";
    seoDescriptions[code]  = t.seoDesc  ?? "";
  });

  // name / path dérivés de la première traduction disponible (fallback "en")
  const primaryLang = "en";
  const name = nameTranslations[primaryLang] ?? Object.values(nameTranslations)[0] ?? "";
  const path = slugTranslations[primaryLang] ?? Object.values(slugTranslations)[0] ?? "/";

  return {
    id:               p.id,
    key:              p.key,
    name,
    path,
    nameTranslations,
    slugTranslations,
    seoTitles,
    seoDescriptions,
    metaImage:   p.metaImage  ?? "",
    isPublished: p.isPublished,
    createdAt:   p.createdAt,
    updatedAt:   p.updatedAt,
  };
}

// Résout code → languageId pour les codes fournis dans le body.
async function resolveLanguageIds(codes) {
  const langs = await prisma.language.findMany({ where: { code: { in: codes } } });
  const map   = {};
  langs.forEach((l) => { map[l.code] = l.id; });
  return map;
}

// Upsert les traductions pour une page (dans une transaction ou directement).
async function upsertTranslations(client, pageId, { nameTranslations = {}, slugTranslations = {}, seoTitles = {}, seoDescriptions = {} }) {
  const codes   = [...new Set([
    ...Object.keys(nameTranslations),
    ...Object.keys(slugTranslations),
    ...Object.keys(seoTitles),
    ...Object.keys(seoDescriptions),
  ])];

  if (!codes.length) return;

  const codeToId = await resolveLanguageIds(codes);

  for (const code of codes) {
    const languageId = codeToId[code];
    if (!languageId) continue; // code inconnu — ignoré proprement

    await client.frontPageSeoTranslation.upsert({
      where:  { pageId_languageId: { pageId, languageId } },
      create: {
        pageId, languageId,
        name:     nameTranslations[code] || "",
        slug:     slugTranslations[code] || "/",
        seoTitle: seoTitles[code]        || null,
        seoDesc:  seoDescriptions[code]  || null,
      },
      update: {
        ...(nameTranslations[code] !== undefined && { name:     nameTranslations[code] }),
        ...(slugTranslations[code] !== undefined && { slug:     slugTranslations[code] }),
        ...(seoTitles[code]        !== undefined && { seoTitle: seoTitles[code] || null }),
        ...(seoDescriptions[code]  !== undefined && { seoDesc:  seoDescriptions[code] || null }),
      },
    });
  }
}

// ─── GET /superadmin/front-pages-seo ────────────────────────
export const listPages = async (req, res, next) => {
  try {
    const pages = await prisma.frontPageSeo.findMany({
      include:  INCLUDE,
      orderBy:  { id: "asc" },
    });
    res.json({ success: true, data: pages.map(formatPage) });
  } catch (e) { next(e); }
};

// ─── GET /superadmin/front-pages-seo/:id ────────────────────
export const getPage = async (req, res, next) => {
  try {
    const id   = parseInt(req.params.id);
    const page = await prisma.frontPageSeo.findUnique({ where: { id }, include: INCLUDE });
    if (!page) return res.status(404).json({ success: false, error: "Page not found" });
    res.json({ success: true, data: formatPage(page) });
  } catch (e) { next(e); }
};

// ─── POST /superadmin/front-pages-seo ───────────────────────
export const createPage = async (req, res, next) => {
  try {
    const {
      nameTranslations = {}, slugTranslations = {},
      seoTitles = {}, seoDescriptions = {},
      metaImage = "", isPublished = true,
    } = req.body;

    const firstSlug = Object.values(slugTranslations).find(Boolean) || "/";
    const key = firstSlug
      .replace(/^\/+|\/+$/g, "")
      .replace(/[^a-z0-9]/gi, "-")
      .toLowerCase()
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || `page-${Date.now()}`;

    const conflict = await prisma.frontPageSeo.findUnique({ where: { key } });
    if (conflict) return res.status(409).json({ success: false, error: "A page with this slug already exists" });

    const page = await prisma.$transaction(async (tx) => {
      const created = await tx.frontPageSeo.create({
        data: { key, metaImage: metaImage || null, isPublished: Boolean(isPublished) },
      });
      await upsertTranslations(tx, created.id, { nameTranslations, slugTranslations, seoTitles, seoDescriptions });
      return tx.frontPageSeo.findUnique({ where: { id: created.id }, include: INCLUDE });
    });

    res.status(201).json({ success: true, data: formatPage(page) });
  } catch (e) { next(e); }
};

// ─── PUT /superadmin/front-pages-seo/:id ────────────────────
export const updatePage = async (req, res, next) => {
  try {
    const id       = parseInt(req.params.id);
    const existing = await prisma.frontPageSeo.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: "Page not found" });

    const {
      nameTranslations, slugTranslations,
      seoTitles, seoDescriptions,
      metaImage, isPublished,
    } = req.body;

    const page = await prisma.$transaction(async (tx) => {
      await tx.frontPageSeo.update({
        where: { id },
        data: {
          ...(metaImage   !== undefined && { metaImage:   metaImage || null }),
          ...(isPublished !== undefined && { isPublished: Boolean(isPublished) }),
        },
      });
      await upsertTranslations(tx, id, {
        nameTranslations:  nameTranslations  ?? {},
        slugTranslations:  slugTranslations  ?? {},
        seoTitles:         seoTitles         ?? {},
        seoDescriptions:   seoDescriptions   ?? {},
      });
      return tx.frontPageSeo.findUnique({ where: { id }, include: INCLUDE });
    });

    res.json({ success: true, data: formatPage(page) });
  } catch (e) { next(e); }
};

// ─── PUT /superadmin/front-pages-seo/key/:key (upsert) ──────
// Pour les scripts de seed et la synchro des pages par défaut.
export const upsertByKey = async (req, res, next) => {
  try {
    const { key } = req.params;
    const {
      nameTranslations = {}, slugTranslations = {},
      seoTitles = {}, seoDescriptions = {},
      metaImage, isPublished,
    } = req.body;

    const page = await prisma.$transaction(async (tx) => {
      const record = await tx.frontPageSeo.upsert({
        where:  { key },
        create: { key, metaImage: metaImage || null, isPublished: Boolean(isPublished ?? true) },
        update: {
          ...(metaImage   !== undefined && { metaImage:   metaImage || null }),
          ...(isPublished !== undefined && { isPublished: Boolean(isPublished) }),
        },
      });
      await upsertTranslations(tx, record.id, { nameTranslations, slugTranslations, seoTitles, seoDescriptions });
      return tx.frontPageSeo.findUnique({ where: { id: record.id }, include: INCLUDE });
    });

    res.json({ success: true, data: formatPage(page) });
  } catch (e) { next(e); }
};

// ─── DELETE /superadmin/front-pages-seo/:id ─────────────────
export const deletePage = async (req, res, next) => {
  try {
    const id       = parseInt(req.params.id);
    const existing = await prisma.frontPageSeo.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: "Page not found" });
    await prisma.frontPageSeo.delete({ where: { id } }); // translations supprimées par Cascade
    res.json({ success: true });
  } catch (e) { next(e); }
};
