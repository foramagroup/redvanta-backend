
import bcrypt from "bcryptjs";
import crypto from "crypto";

const SALT_ROUNDS = 12;

// Génère un mot de passe aléatoire lisible (12 caractères)
// Format : 2 majuscules + 4 minuscules + 4 chiffres + 2 spéciaux
export function generatePassword() {
  const upper   = "ABCDEFGHJKLMNPQRSTUVWXYZ";   // sans I, O ambigus
  const lower   = "abcdefghjkmnpqrstuvwxyz";     // sans i, l, o ambigus
  const digits  = "23456789";                    // sans 0, 1 ambigus
  const special = "@#$!%*?&";

  const pick = (chars, n) =>
    Array.from({ length: n }, () => chars[crypto.randomInt(chars.length)]);

  const parts = [
    ...pick(upper,   2),
    ...pick(lower,   4),
    ...pick(digits,  4),
    ...pick(special, 2),
  ];

  // Mélanger pour ne pas avoir de pattern prévisible
  for (let i = parts.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [parts[i], parts[j]] = [parts[j], parts[i]];
  }

  return parts.join("");
}

// Hasher un mot de passe
export async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

// Vérifier un mot de passe
export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// Générer un token de bienvenue (lien email première connexion)
export function generateWelcomeToken() {
  return crypto.randomBytes(32).toString("hex");
}