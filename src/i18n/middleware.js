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

    // 1. Langue depuis le header custom X-App-Language (choix explicite de l'app)
    // On utilise X-App-Language et non Accept-Language car le navigateur envoie
    // Accept-Language automatiquement selon sa propre locale, pas celle choisie dans l'app.
    const appLang = req.headers["x-app-language"]?.split("-")[0]?.toLowerCase();
    if (appLang) {
      locale = appLang;
    }

    // 2. Langue de la company (si user connecté et aucun header app reçu)
    if (req.user?.companyId && !appLang) {
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
    console.log(locale);
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