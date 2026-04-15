

import crypto from 'crypto';

/**
 * Générer un code OTP à 6 chiffres
 * @returns {string} Code à 6 chiffres
 */
export function generateOtpCode() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Calculer l'expiration du code (3 jours par défaut)
 * @param {number} days - Nombre de jours
 * @returns {Date}
 */
export function getOtpExpiration(days = 3) {
  const exp = new Date();
  exp.setDate(exp.getDate() + days);
  return exp;
}

/**
 * Vérifier si le code est expiré
 * @param {Date} expirationDate
 * @returns {boolean}
 */
export function isOtpExpired(expirationDate) {
  if (!expirationDate) return true;
  return new Date() > new Date(expirationDate);
}

/**
 * Formater le code pour l'affichage (XXX XXX)
 * @param {string} code
 * @returns {string}
 */
export function formatOtpCode(code) {
  if (code.length !== 6) return code;
  return `${code.substring(0, 3)} ${code.substring(3)}`;
}