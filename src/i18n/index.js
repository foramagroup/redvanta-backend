
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class I18n {
  constructor() {
    this.translations = {};
    this.defaultLocale = "en";
    this.loadTranslations();
  }

  loadTranslations() {
    const localesDir = path.join(__dirname, "locales");
    const files = fs.readdirSync(localesDir);

    files.forEach((file) => {
      if (file.endsWith(".json")) {
        const locale = file.replace(".json", "");
        const content = fs.readFileSync(path.join(localesDir, file), "utf-8");
        this.translations[locale] = JSON.parse(content);
      }
    });

    console.log(`[i18n] Loaded translations for: ${Object.keys(this.translations).join(", ")}`);
  }

  /**
   * Translate a key with optional variable interpolation
   * @param {string} locale - Language code (en, fr, es, etc.)
   * @param {string} key - Translation key (e.g., "auth.login_success")
   * @param {object} vars - Variables for interpolation (e.g., {field: "Email", min: 5})
   * @returns {string} - Translated text
   */
  t(locale, key, vars = {}) {
    // Fallback to default locale if locale not found
    if (!this.translations[locale]) {
      console.warn(`[i18n] Locale "${locale}" not found, using default "${this.defaultLocale}"`);
      locale = this.defaultLocale;
    }

    // Navigate nested keys (e.g., "auth.login_success")
    const keys = key.split(".");
    let translation = this.translations[locale];

    for (const k of keys) {
      if (translation && typeof translation === "object") {
        translation = translation[k];
      } else {
        break;
      }
    }

    // Fallback to key if translation not found
    if (typeof translation !== "string") {
      console.warn(`[i18n] Translation key "${key}" not found for locale "${locale}"`);
      return key;
    }

    // Interpolate variables (e.g., {{field}} -> "Email")
    return translation.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
      return vars[variable] !== undefined ? vars[variable] : match;
    });
  }

  /**
   * Get all available locales
   */
  getAvailableLocales() {
    return Object.keys(this.translations);
  }

  /**
   * Check if locale exists
   */
  hasLocale(locale) {
    return this.translations.hasOwnProperty(locale);
  }
}

export default new I18n();