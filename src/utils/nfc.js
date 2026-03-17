/**
 * nfc.js
 * Helpers pour générer payloads NFC / QR. Utilise qrcode pour les QR generation.
 */

import QRCode from 'qrcode';

export async function generateQrDataURL(text) {
  return QRCode.toDataURL(text);
}

// placeholder pour génération d'UID ou payload
export function makeNfcPayload({ type = 'url', value }) {
  if (type === 'url') return { url: value };
  return { type, value };
}
