import prisma from "../../config/database.js";

const INCLUDE = {
  translations: {
    include: { language: { select: { id: true, code: true } } },
    orderBy: { languageId: "asc" },
  },
};

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

  const primaryLang = "en";
  const name = nameTranslations[primaryLang] ?? Object.values(nameTranslations)[0] ?? "";
  const path = slugTranslations[primaryLang] ?? Object.values(slugTranslations)[0] ?? "/";

  return {
    id: p.id, key: p.key, name, path,
    nameTranslations, slugTranslations, seoTitles, seoDescriptions,
    metaImage:   p.metaImage ?? "",
    isPublished: p.isPublished,
  };
}

// ─── GET /api/client/seo ─────────────────────────────────────
export const listPublicPages = async (req, res, next) => {
  try {
    const pages = await prisma.frontPageSeo.findMany({
      where:   { isPublished: true },
      include: INCLUDE,
      orderBy: { id: "asc" },
    });
    res.json({ success: true, data: pages.map(formatPage) });
  } catch (e) { next(e); }
};

// ─── GET /api/client/seo/:key ────────────────────────────────
export const getPublicPageSeo = async (req, res, next) => {
  try {
    const page = await prisma.frontPageSeo.findFirst({
      where:   { key: req.params.key, isPublished: true },
      include: INCLUDE,
    });
    if (!page) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data: formatPage(page) });
  } catch (e) { next(e); }
};
