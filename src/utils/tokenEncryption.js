import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const PREFIX    = "enc:";

// Dérive une clé 32 octets depuis la variable d'environnement
function getKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY or JWT_SECRET must be set");
  return crypto.createHash("sha256").update(raw).digest();
}

/**
 * Chiffre une chaîne.
 * Format de sortie : "enc:<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */
export function encrypt(plaintext) {
  if (!plaintext) return plaintext;
  const key = getKey();
  const iv  = crypto.randomBytes(12); // 96-bit IV pour GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag   = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Déchiffre une chaîne produite par encrypt().
 * Si la valeur ne commence pas par "enc:" (ancien token en clair), la retourne telle quelle
 * pour assurer la rétrocompatibilité pendant la migration.
 */
export function decrypt(value) {
  if (!value) return value;
  if (!value.startsWith(PREFIX)) return value; // ancien token en clair — transition
  const [, ivHex, authTagHex, ciphertextHex] = value.split(":");
  const key        = getKey();
  const iv         = Buffer.from(ivHex,         "hex");
  const authTag    = Buffer.from(authTagHex,    "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher   = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext, undefined, "utf8") + decipher.final("utf8");
}

/** Retourne true si la valeur est déjà chiffrée. */
export function isEncrypted(value) {
  return typeof value === "string" && value.startsWith(PREFIX);
}
