// backend/src/i18n/emailFallbacks.js
// Résolveur de templates email par langue.
// Priorité dans sendTemplatedMail : DB → fichier i18n (ici) → fallbackFn hardcodé.

import en from './emails/en.js';
import fr from './emails/fr.js';
import ro from './emails/ro.js';

const locales = { en, fr, ro };

/**
 * Retourne le payload { subject, html, text } traduit pour un slug et une langue.
 * Tente la langue demandée, puis "en" en dernier recours.
 * @param {string} slug      - ex. "order_pending_payment"
 * @param {string} langCode  - ex. "fr", "ro", "en"
 * @param {object} vars      - variables de substitution (même objet que passé à sendTemplatedMail)
 * @returns {{ subject: string, html: string, text: string } | null}
 */
export function getEmailFallback(slug, langCode, vars = {}) {
  const code   = langCode ?? 'en';
  const locale = locales[code] ?? null;

  // Tenter la langue demandée
  const fn = locale?.[slug] ?? null;
  if (fn) return fn(vars);

  // Fallback sur l'anglais
  const enFn = locales.en?.[slug] ?? null;
  if (enFn) return enFn(vars);

  return null;
}
