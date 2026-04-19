// src/i18n/middleware.js
import prisma from "../config/database.js";
import i18n from "./index.js";

/**
 * Middleware pour déterminer la langue à utiliser
 * Priorité:
 * 1. Header Accept-Language (frontend dropdown)
 * 2. Langue par défaut de la company (si user connecté)
 * 3. Langue par défaut du système (en)
 */
export async function languageMiddleware(req, res, next) {
  try {
    let locale = "en"; // Langue par défaut du système

    // 1. Langue depuis le header (priorité max)
    const headerLang = req.headers["accept-language"]?.split(",")[0]?.split("-")[0];
    if (headerLang && i18n.hasLocale(headerLang)) {
      locale = headerLang;
    }

    // 2. Langue de la company (si user connecté)
    if (req.user?.companyId && !headerLang) {
      const company = await prisma.company.findUnique({
        where: { id: req.user.companyId },
        include: {
          defaulLanguage: {
            select: { code: true },
          },
        },
      });

      if (company?.defaulLanguage?.code) {
        locale = company.defaulLanguage.code;
      }
    }

    // Attacher la locale et la fonction de traduction à req
    req.locale = locale;
    req.t = (key, vars) => i18n.t(locale, key, vars);

    next();
  } catch (error) {
    console.error("[languageMiddleware] Error:", error);
    // En cas d'erreur, continuer avec la langue par défaut
    req.locale = "en";
    req.t = (key, vars) => i18n.t("en", key, vars);
    next();
  }
}