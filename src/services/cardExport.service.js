// src/services/cardExport.service.js
// ─────────────────────────────────────────────────────────────
// Génération fiche impression NFC — SVG + PNG + PDF
// ─────────────────────────────────────────────────────────────
// CORRECTIONS :
//   1. resolveLogoDataUri() — chemin corrigé pour matcher saveLogo() du controller
//      saveLogo() écrit dans : process.env.UPLOAD_DIR || "uploads"  (relatif au CWD)
//      → on résout depuis ROOT_DIR en cherchant "uploads/" PAS "public/uploads/"
//   2. <image> SVG — ajout xlink:href en plus de href (compatibilité sharp/libvips)
// ─────────────────────────────────────────────────────────────

import fsP   from "fs/promises";
import path  from "path";
import { fileURLToPath } from "url";
import QRCode from "qrcode";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
// Structure : backend/src/services/cardExport.service.js
// ROOT_DIR  = backend/
const ROOT_DIR   = path.resolve(__dirname, "../..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");

// ── FIX LOGO : UPLOAD_DIR correspond au même dossier que saveLogo() ──────────
// design.controller.js : path.resolve(process.env.UPLOAD_DIR || "uploads", ...)
// process.cwd() au moment du lancement = backend/
// Donc le chemin réel = backend/uploads/designs/logos/xxx.webp
// On réplique exactement la même logique ici :
const UPLOAD_DIR = path.resolve(
  process.cwd(),
  process.env.UPLOAD_DIR || "uploads"
);
console.log(`[cardExport] ROOT_DIR   = ${ROOT_DIR}`);
console.log(`[cardExport] UPLOAD_DIR = ${UPLOAD_DIR}`);

const EXPORT_DIR = path.join(PUBLIC_DIR, "uploads", "cards");

const CR80 = { W: 1011, H: 638 };
const RX   = 16;
const SCALE = 3.5;
const PAD   = Math.round(20 * SCALE);
const GAP4  = Math.round(16 * SCALE);
const SHEET_GAP    = 80;
const SHEET_MARGIN = 30;

// ─────────────────────────────────────────────────────────────
// EXPORT PRINCIPAL
// ─────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────
// EXPORT PRINCIPAL
// ─────────────────────────────────────────────────────────────

export async function generateCardExport(card, design) {
  if (!card?.payload) throw new Error(`[cardExport] uid=${card?.uid} — payload manquant`);

  await fsP.mkdir(EXPORT_DIR, { recursive: true });
  console.log(`[cardExport] EXPORT_DIR = ${EXPORT_DIR}`);
  console.log(`[cardExport] uid = ${card.uid}`);

  // ── Résoudre le logo en Buffer PNG (bypass total de librsvg) ─────────────
  // librsvg (moteur SVG de sharp) ne supporte PAS les data URI ni WebP dans <image>.
  // Solution : on ne met PAS le logo dans le SVG.
  // On rasterise le SVG sans logo, puis on composite le logo par-dessus avec sharp.
  let logoPngBuffer = null;
  if (design?.logoUrl) {
    logoPngBuffer = await resolveLogoBuffer(design.logoUrl);
  }

  // normalizeDesign : on passe "HAS_LOGO" pour que le layout réserve l'espace
  const d = normalizeDesign({ ...design, logoUrl: logoPngBuffer ? "HAS_LOGO" : null }, card);
  const qrInner = await buildQrInner(card.payload, d);

  const totalW = d.cardW + SHEET_MARGIN * 2;
  const totalH = d.cardH * 2 + SHEET_GAP + SHEET_MARGIN * 2;
  const rectoY = SHEET_MARGIN;
  const versoY = SHEET_MARGIN + d.cardH + SHEET_GAP;

  // SVG avec logoUrl="HAS_LOGO" pour que bizTextX soit décalé correctement
  // mais buildRecto ne génère PAS de balise <image> car logoSvg check la vraie valeur
  // → le layout réserve l'espace logo, l'overlay sharp pose le vrai PNG dessus
  const svgContent = buildGlobalSvg(d, qrInner, totalW, totalH, rectoY, versoY);
  const svgPath    = path.join(EXPORT_DIR, `${card.uid}.svg`);
  await fsP.writeFile(svgPath, svgContent, "utf-8");
  console.log(`[cardExport] ✅ SVG → ${svgPath}`);

  // PNG global avec overlay logo
  const pngPath = path.join(EXPORT_DIR, `${card.uid}.png`);
  await writePngWithLogoOverlay(svgContent, pngPath, totalW, totalH, d, logoPngBuffer, rectoY);

  // PDF A4 avec overlay logo
  const pdfPath = path.join(EXPORT_DIR, `${card.uid}.pdf`);
  await writePdfWithLogoOverlay(d, qrInner, pdfPath, logoPngBuffer);

  const base = (process.env.APP_URL ?? process.env.FRONTEND_URL ?? "http://localhost:4000").replace(/\/$/, "");
  return {
    svgUrl: `${base}/uploads/cards/${card.uid}.svg`,
    pngUrl: `${base}/uploads/cards/${card.uid}.png`,
    pdfUrl: `${base}/uploads/cards/${card.uid}.pdf`,
  };
}

// ─────────────────────────────────────────────────────────────
// RÉSOLUTION LOGO → Buffer PNG
// ─────────────────────────────────────────────────────────────
// Retourne un Buffer PNG redimensionné prêt pour sharp.composite()
// Contourne totalement librsvg qui ignore les <image> avec data URI / WebP

async function resolveLogoBuffer(logoUrl) {
  if (!logoUrl) return null;

  // URL externe non supportée en local (pas de fetch dans ce context)
  if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
    console.warn("[cardExport] ⚠️ Logo URL externe ignoré (non supporté en rendu local)");
    return null;
  }

  // Trouver le fichier source — DB stocke /uploads/designs/logos/xxx.webp
  // Sur Windows path.isAbsolute("/uploads/...") = true → résout vers C:\  ← FAUX
  const normalized = logoUrl.replace(/\//g, path.sep);
  const relative   = normalized.startsWith(path.sep) ? normalized.slice(path.sep.length) : normalized;
  const subPath    = relative.replace(/^uploads[\\\\\/]/, "");

  const candidates = [
    path.join(ROOT_DIR, relative),       // backend/uploads/designs/logos/xxx.webp ✅
    path.join(PUBLIC_DIR, relative),     // backend/public/uploads/...
    path.join(UPLOAD_DIR, subPath),      // CWD/uploads/designs/logos/xxx.webp
  ];

  let srcPath = null;
  for (const c of candidates) {
    if (await fsP.access(c).then(() => true).catch(() => false)) {
      srcPath = c;
      console.log(`[cardExport] 🔍 Logo source : ${srcPath}`);
      break;
    }
  }

  if (!srcPath) {
    console.warn(`[cardExport] ⚠️ Logo introuvable — logoUrl="${logoUrl}"`);
    candidates.forEach((c, i) => console.warn(`[cardExport]   candidate${i+1} = ${c}`));
    return null;
  }

  try {
    const sharp = (await import("sharp")).default;
    // On retourne le buffer source brut (PNG haute qualité)
    // Le resize à la bonne taille (d.logoSize * SCALE) se fait dans writePngWithLogoOverlay / writePdfWithLogoOverlay
    const buf = await sharp(srcPath).png().toBuffer();
    console.log(`[cardExport] ✅ Logo Buffer PNG source prêt (${buf.length} bytes)`);
    return buf;
  } catch (e) {
    console.warn(`[cardExport] ⚠️ Erreur conversion logo : ${e.message}`);
    return null;
  }
}


// ─────────────────────────────────────────────────────────────
// NORMALISATION DU DESIGN
// ─────────────────────────────────────────────────────────────

const LETTER_SPACING_MAP = {
  tight:  "-0.025em",
  normal: "0em",
  wide:   "0.05em",
  wider:  "0.1em",
};

function normalizeDesign(d, card) {
  d = d ?? {};
  const colorMode   = d.colorMode   ?? "single";
  const orientation = d.orientation ?? "landscape";
  const isLandscape = orientation !== "portrait";
  const cardW = isLandscape ? CR80.W : CR80.H;
  const cardH = isLandscape ? CR80.H : CR80.W;

  const bg1  = colorMode === "single" ? (d.bgColor ?? "#0D0D0D") : (d.gradient1 ?? d.bgColor ?? "#0D0D0D");
  const bg2  = colorMode === "single" ? bg1 : (d.gradient2 ?? "#161616");
  const vbg1 = colorMode === "single" ? bg1 : bg2;
  const vbg2 = colorMode === "single" ? bg1 : bg1;

  const accentBand1  = d.accentBand1  ?? d.accentColor ?? "#E10600";
  const accentBand2  = d.accentBand2  ?? accentBand1;
  const bandPosition = d.bandPosition ?? "bottom";
  const frontBandH   = d.frontBandHeight ?? 22;
  const backBandH    = d.backBandHeight  ?? 12;

  const nameFont       = d.businessFont       ?? d.nameFont       ?? "\'Space Grotesk\', sans-serif";
  const nameFontSize   = d.businessFontSize    ?? d.nameFontSize   ?? 16;
  const nameFontWeight = d.businessFontWeight  ?? d.nameFontWeight ?? "700";
  const nameLetSpacing = LETTER_SPACING_MAP[d.businessFontSpacing ?? d.nameLetterSpacing] ?? "0em";
  const nameTransform  = (d.businessTextTransform ?? d.nameTextTransform) === "none"
    ? null : (d.businessTextTransform ?? d.nameTextTransform ?? null);
  const nameAlign      = d.businessAlign      ?? d.nameTextAlign  ?? "left";
  const nameLineH      = d.businessLineHeight ?? d.nameLineHeight ?? "1.2";

  const sloganFont       = d.sloganFont       ?? nameFont;
  const sloganFontSize   = d.sloganFontSize   ?? 12;
  const sloganFontWeight = d.sloganFontWeight ?? "400";
  const sloganLetSpacing = LETTER_SPACING_MAP[d.sloganFontSpacing ?? d.sloganLetterSpacing] ?? "0em";
  const sloganTransform  = d.sloganTextTransform === "none" ? null : (d.sloganTextTransform ?? null);
  const sloganAlign      = d.sloganAlign      ?? d.sloganTextAlign ?? "left";

  const instrFont       = d.instrFont       ?? d.instructionFont       ?? nameFont;
  const instrFontSize   = d.instrFontSize   ?? d.instructionFontSize   ?? 10;
  const instrFontWeight = d.instrFontWeight ?? d.instructionFontWeight ?? "400";
  const instrLetSpacing = LETTER_SPACING_MAP[d.instrFontSpacing ?? d.instructionLetterSpacing] ?? "0em";
  const instrAlign      = d.instrAlign      ?? d.instructionTextAlign  ?? "left";

  const qrColor    = d.accentColor ?? d.qrColor    ?? "#E10600";
  const qrSize     = d.qrCodeSize  ?? d.qrSize     ?? 80;
  const qrPosition = d.qrPosition  ?? (isLandscape ? "right" : "top");

  const logoUrl      = d.logoUrl      ?? null;
  const logoPosition = d.logoPosition ?? (isLandscape ? "left" : "top-center");
  const logoSize     = d.logoSize     ?? 32;

  const starsColor       = d.starColor       ?? d.starsColor      ?? "#FBBF24";
  const iconsColor       = d.iconsColor      ?? "#22C55E";
  const checkStrokeWidth = d.checkStrokeWidth ?? 3.5;
  const showNfcIcon      = d.showNfcIcon     !== false;
  const showGoogleIcon   = d.showGoogleIcon  !== false;
  const nfcIconSize      = d.nfcIconSize     ?? 24;
  const googleIconSize   = d.googleLogoSize  ?? d.googleIconSize  ?? 20;

  const textColor     = d.textColor ?? "#FFFFFF";
  const businessName  = esc(d.businessName ?? card?.locationName ?? "Business Name");
  const sloganText    = d.slogan ? esc(d.slogan) : null;
  const ctaText       = esc(d.cta ?? d.callToAction ?? "Powered by RedVanta");
  const ctaPaddingTop = d.ctaPaddingTop ?? 8;

  const frontLine1 = esc(d.frontInstruction1 ?? d.frontLine1 ?? "Approach the phone to the card");
  const frontLine2 = esc(d.frontInstruction2 ?? d.frontLine2 ?? "Tap to leave a review");
  const backLine1  = esc(d.backInstruction1  ?? d.backLine1  ?? "Use your phone camera to scan the QR code");
  const backLine2  = esc(d.backInstruction2  ?? d.backLine2  ?? "Write a review on our Google Maps page");
  const pattern    = d.pattern ?? "none";

  return {
    cardW, cardH, isLandscape,
    colorMode, bg1, bg2, vbg1, vbg2, textColor,
    accentBand1, accentBand2, bandPosition, frontBandH, backBandH,
    nameFont, nameFontSize, nameFontWeight, nameLetSpacing, nameTransform, nameAlign, nameLineH,
    sloganFont, sloganFontSize, sloganFontWeight, sloganLetSpacing, sloganTransform, sloganAlign,
    instrFont, instrFontSize, instrFontWeight, instrLetSpacing, instrAlign,
    qrColor, qrSize, qrPosition,
    logoUrl, logoPosition, logoSize,
    starsColor, iconsColor, checkStrokeWidth,
    showNfcIcon, nfcIconSize, showGoogleIcon, googleIconSize,
    businessName, sloganText, ctaText, ctaPaddingTop,
    frontLine1, frontLine2, backLine1, backLine2, pattern,
  };
}

async function buildQrInner(payload, d) {
  const svgStr = await QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 1, // On garde une petite marge interne
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });

  // 1. On récupère la viewBox originale (ex: "0 0 33 33")
  const viewBoxMatch = svgStr.match(/viewBox="([^"]+)"/);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 33 33";

  // 2. On récupère le contenu (les <path>)
  const contentMatch = svgStr.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  const innerContent = contentMatch ? contentMatch[1] : svgStr;

  // 3. On encapsule dans un nouveau SVG avec preserveAspectRatio
  // Cela force le QR code à remplir tout l'espace disponible (le carré blanc)
  return `
    <svg viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
      ${innerContent}
    </svg>
  `;
}

// ─────────────────────────────────────────────────────────────
// SVG GLOBAL
// ─────────────────────────────────────────────────────────────

function buildGlobalSvg(d, qrInner, totalW, totalH, rectoY, versoY) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
<defs>
  ${buildGradientDefs(d)}
  <clipPath id="cr">
    <rect x="${SHEET_MARGIN}" y="${rectoY}" width="${d.cardW}" height="${d.cardH}" rx="${RX}"/>
  </clipPath>
  <clipPath id="cv">
    <rect x="${SHEET_MARGIN}" y="${versoY}" width="${d.cardW}" height="${d.cardH}" rx="${RX}"/>
  </clipPath>
</defs>

<text x="${SHEET_MARGIN}" y="${rectoY - 10}" font-family="Arial,sans-serif" font-size="20" fill="#555">RECTO</text>
<g clip-path="url(#cr)">
  ${buildRecto(d, qrInner, SHEET_MARGIN, rectoY)}
</g>

<line x1="${SHEET_MARGIN}" y1="${rectoY + d.cardH + SHEET_GAP / 2}"
      x2="${SHEET_MARGIN + d.cardW}" y2="${rectoY + d.cardH + SHEET_GAP / 2}"
      stroke="#333" stroke-width="1" stroke-dasharray="8 5" opacity="0.5"/>

<text x="${SHEET_MARGIN}" y="${versoY - 10}" font-family="Arial,sans-serif" font-size="20" fill="#555">VERSO</text>
<g clip-path="url(#cv)">
  ${buildVerso(d, qrInner, SHEET_MARGIN, versoY)}
</g>
</svg>`;
}

function buildGradientDefs(d) {
  return `
  <linearGradient id="rectoGrad" x1="94%" y1="34%" x2="6%" y2="66%">
    <stop offset="0%"  stop-color="${d.bg1}"/>
    <stop offset="70%" stop-color="${d.bg2}"/>
  </linearGradient>
  <linearGradient id="versoGrad" x1="94%" y1="34%" x2="6%" y2="66%">
    <stop offset="0%"   stop-color="${d.vbg1}"/>
    <stop offset="100%" stop-color="${d.vbg2}"/>
  </linearGradient>
  <linearGradient id="bandGrad" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%"   stop-color="${d.accentBand1}"/>
    <stop offset="100%" stop-color="${d.accentBand2}"/>
  </linearGradient>`;
}

// ─────────────────────────────────────────────────────────────
// RECTO
// ─────────────────────────────────────────────────────────────

function buildRecto(d, _qrInner, ox, oy) {
  const W = d.cardW, H = d.cardH;

  const logoSzPx  = Math.round(d.logoSize       * SCALE);
  const nameSzPx  = Math.round(d.nameFontSize    * SCALE);
  const sloganSzPx= Math.round(d.sloganFontSize  * SCALE);
  const instrSzPx = Math.round(d.instrFontSize   * SCALE);
  const ctaSzPx   = Math.round(9 * SCALE);
  const nfcSzPx   = Math.round(d.nfcIconSize     * SCALE);
  const gSzPx     = Math.round(d.googleIconSize  * SCALE);
  const starSzPx  = Math.round(14 * SCALE);
  const checkSzPx = Math.round(12 * SCALE);
  const instrGap  = Math.round(6  * SCALE);
  const ctaPadTop = Math.round(d.ctaPaddingTop   * SCALE);

  const contentH  = nameSzPx + sloganSzPx + starSzPx + GAP4 + checkSzPx * 2 + instrGap + GAP4 + ctaSzPx + ctaPadTop + 20;
  const contentY  = Math.round((H - contentH) / 2);

  const bizRowY   = contentY;
  const instrY    = bizRowY + Math.max(logoSzPx, nameSzPx + sloganSzPx + starSzPx + 10) + GAP4;
  const instr1Y   = instrY + checkSzPx;
  const instr2Y   = instr1Y + checkSzPx + instrGap;
  const ctaY      = instr2Y + ctaSzPx + GAP4 + ctaPadTop;

  const bizTextX  = d.logoUrl ? PAD + logoSzPx + Math.round(6 * SCALE) : PAD;

  const nfcX = ox + W - Math.round(12 * SCALE) - nfcSzPx;
  const nfcY = oy + Math.round(12 * SCALE);
  const gX   = ox + W - Math.round(12 * SCALE) - gSzPx;
  const gY   = oy + H - Math.round(12 * SCALE) - gSzPx;

  const bandSvg = d.colorMode === "template" && d.bandPosition !== "hidden"
    ? buildBandSvg(d, ox, oy, W, H, d.frontBandH) : "";

  // logoUrl="HAS_LOGO" → réserve l'espace (bizTextX décalé) mais pas de balise <image>
  // Le vrai logo est composé après rasterisation via sharp.composite()
  const isRealLogoUrl = d.logoUrl && d.logoUrl !== "HAS_LOGO"
    && !d.logoUrl.startsWith("HAS_");
  const logoSvg = isRealLogoUrl ? `<image
    x="${ox + PAD}" y="${oy + bizRowY}"
    width="${logoSzPx}" height="${logoSzPx}"
    xlink:href="${d.logoUrl}"
    href="${d.logoUrl}"
    preserveAspectRatio="xMidYMid meet"/>` : "";

  return `
  <!-- Fond recto -->
  <rect x="${ox}" y="${oy}" width="${W}" height="${H}" fill="url(#rectoGrad)"/>

  <!-- NFC icon (absolute top-3 right-3 opacity-30) -->
  ${d.showNfcIcon ? buildNfcIcon(nfcX, nfcY, nfcSzPx, d.textColor, 0.30) : ""}

  <!-- Google icon (absolute bottom-3 right-3 opacity-60) -->
  ${d.showGoogleIcon ? buildGoogleIcon(gX, gY, gSzPx, 0.60) : ""}

  <!-- Logo -->
  ${logoSvg}

  <!-- businessName -->
  <text x="${ox + bizTextX}" y="${oy + bizRowY + nameSzPx}"
    font-family="${d.nameFont}" font-size="${nameSzPx}"
    font-weight="${d.nameFontWeight}"
    letter-spacing="${d.nameLetSpacing}"
    ${d.nameTransform ? `text-transform="${d.nameTransform}"` : ""}
    fill="${d.textColor}"
    text-anchor="${d.nameAlign === 'center' ? 'middle' : d.nameAlign === 'right' ? 'end' : 'start'}"
    >${d.businessName}</text>

  <!-- slogan -->
  ${d.sloganText ? `<text x="${ox + bizTextX}" y="${oy + bizRowY + nameSzPx + Math.round(4*SCALE) + sloganSzPx}"
    font-family="${d.sloganFont}" font-size="${sloganSzPx}"
    font-weight="${d.sloganFontWeight}"
    letter-spacing="${d.sloganLetSpacing}"
    ${d.sloganTransform ? `text-transform="${d.sloganTransform}"` : ""}
    fill="${d.textColor}" opacity="0.70"
    >${d.sloganText}</text>` : ""}

  <!-- StarsRow -->
  ${buildStarsRow(
    ox + bizTextX,
    oy + bizRowY + nameSzPx + (d.sloganText ? sloganSzPx + Math.round(4*SCALE) : 0) + Math.round(4*SCALE) + starSzPx,
    5, starSzPx, d.starsColor
  )}

  <!-- Instructions -->
  ${buildCheckLine(ox + PAD, oy + instr1Y, d.frontLine1, d, instrSzPx, checkSzPx)}
  ${d.frontLine2 ? buildCheckLine(ox + PAD, oy + instr2Y, d.frontLine2, d, instrSzPx, checkSzPx) : ""}

  <!-- CTA -->
  <text x="${ox + PAD}" y="${oy + ctaY}"
    font-family="${d.instrFont}" font-size="${ctaSzPx}"
    font-weight="500"
    fill="${d.textColor}" opacity="0.80">${d.ctaText}</text>

  ${bandSvg}`;
}

// ─────────────────────────────────────────────────────────────
// VERSO
// ─────────────────────────────────────────────────────────────

function buildVerso(d, qrInner, ox, oy) {
  const W = d.cardW, H = d.cardH;

  const nameSzPx   = Math.round(Math.max(d.nameFontSize - 4, 8) * SCALE);
  const sloganSzPx = Math.round(Math.max(d.sloganFontSize - 2, 7) * SCALE);
  const instrSzPx  = Math.round(Math.max(d.instrFontSize - 1, 7) * SCALE);
  const ctaSzPx    = Math.round(10 * SCALE);
  const starSzPx   = Math.round(11 * SCALE);
  const checkSzPx  = Math.round(11 * SCALE);
  const gSzPx      = Math.round(d.googleIconSize * SCALE);

  const rowGap   = Math.round(12 * SCALE);
  const gap4     = GAP4;
  const instrGap = Math.round(6 * SCALE);
  const ctaPadTop = Math.round(d.ctaPaddingTop * SCALE);

  const qrSzPx    = Math.min(Math.round(d.qrSize * SCALE), Math.round(H * 0.50));
  const qrPad     = Math.round(qrSzPx * 0.08);
  const qrInnerSz = qrSzPx - qrPad * 2;

  const isQrHoriz = d.qrPosition === "left" || d.qrPosition === "right";
  const isQrFirst = d.qrPosition === "left"  || d.qrPosition === "top";

  const sloganLineH = d.sloganText ? sloganSzPx + Math.round(4 * SCALE) : 0;
  const infoH  = nameSzPx + Math.round(4 * SCALE) + sloganLineH + Math.round(4 * SCALE) + starSzPx;

  const topRowH = Math.max(qrSzPx, infoH);
  const instrTotalH = checkSzPx + instrGap + checkSzPx;
  const totalH = topRowH + gap4 + instrTotalH + gap4 + ctaSzPx + ctaPadTop;
  const startY = Math.round((H - totalH) / 2);

  const topRowTop  = startY;
  const instrTop   = topRowTop + topRowH + gap4;
  const instr1Base = instrTop + checkSzPx;
  const instr2Base = instr1Base + instrGap + checkSzPx;
  const ctaBase    = instr2Base + gap4 + ctaSzPx + ctaPadTop;

  const infoBlockW = Math.round(W * 0.40);
  const topRowW    = isQrHoriz ? (infoBlockW + rowGap + qrSzPx) : Math.max(qrSzPx, infoBlockW);
  const topRowX    = Math.round((W - topRowW) / 2);

  let qrX, infoBlockX;
  if (isQrHoriz) {
    if (isQrFirst) {
      qrX        = ox + topRowX;
      infoBlockX = qrX + qrSzPx + rowGap;
    } else {
      infoBlockX = ox + topRowX;
      qrX        = infoBlockX + infoBlockW + rowGap;
    }
  } else {
    qrX        = ox + Math.round((W - qrSzPx) / 2);
    infoBlockX = ox + Math.round((W - infoBlockW) / 2);
  }

  const infoCX = infoBlockX + Math.round(infoBlockW / 2);
  const qrY    = oy + topRowTop + Math.round((topRowH - qrSzPx) / 2);

  const infoTopY    = oy + topRowTop + Math.round((topRowH - infoH) / 2);
  const nameBaseY   = infoTopY + nameSzPx;
  const sloganBaseY = nameBaseY + Math.round(4 * SCALE) + sloganSzPx;
  const starsY      = (d.sloganText ? sloganBaseY : nameBaseY) + Math.round(4 * SCALE) + starSzPx;

  const gX = ox + W - Math.round(12 * SCALE) - gSzPx;
  const gY = oy + H - Math.round(12 * SCALE) - gSzPx;

  const bandSvg = d.colorMode === "template" && d.bandPosition !== "hidden"
    ? buildBandSvg(d, ox, oy, W, H, d.backBandH) : "";

  const starsStartX = infoCX - Math.round(5 * (starSzPx + Math.round(2 * SCALE)) / 2);

  return `
  <!-- Fond verso -->
  <rect x="${ox}" y="${oy}" width="${W}" height="${H}" fill="url(#versoGrad)"/>

  <!-- Google icon -->
  ${d.showGoogleIcon ? buildGoogleIcon(gX, gY, gSzPx, 0.60) : ""}

  <!-- QR box — fond blanc obligatoire pour scannabilité (noir sur blanc = standard universel) -->
  <rect x="${qrX}" y="${qrY}" width="${qrSzPx}" height="${qrSzPx}"
    rx="8" ry="8"
    fill="#FFFFFF"/>
  <!-- Le QR SVG contient déjà son fond blanc grâce à light="#FFFFFF" dans buildQrInner -->
  <svg x="${qrX}" y="${qrY}"
       width="${qrSzPx}" height="${qrSzPx}"
       viewBox="0 0 ${qrSzPx} ${qrSzPx}" preserveAspectRatio="xMidYMid meet">
    <rect width="${qrSzPx}" height="${qrSzPx}" fill="#FFFFFF"/>
    <svg x="${qrPad}" y="${qrPad}" width="${qrInnerSz}" height="${qrInnerSz}"
         viewBox="0 0 ${qrInnerSz} ${qrInnerSz}" preserveAspectRatio="xMidYMid meet">
      ${qrInner}
    </svg>
  </svg>

  <!-- businessName -->
  <text x="${infoCX}" y="${nameBaseY}"
    font-family="${d.nameFont}" font-size="${nameSzPx}"
    font-weight="${d.nameFontWeight}"
    fill="${d.textColor}" text-anchor="middle">${d.businessName}</text>

  <!-- slogan -->
  ${d.sloganText ? `<text x="${infoCX}" y="${sloganBaseY}"
    font-family="${d.sloganFont}" font-size="${sloganSzPx}"
    font-weight="${d.sloganFontWeight}"
    fill="${d.textColor}" opacity="0.70" text-anchor="middle">${d.sloganText}</text>` : ""}

  <!-- StarsRow -->
  ${buildStarsRow(starsStartX, starsY, 5, starSzPx, d.starsColor)}

  <!-- Instructions -->
  ${buildCheckLineCentered(ox + W / 2, oy + instr1Base, d.backLine1, d, instrSzPx, checkSzPx)}
  ${d.backLine2 ? buildCheckLineCentered(ox + W / 2, oy + instr2Base, d.backLine2, d, instrSzPx, checkSzPx) : ""}

  <!-- CTA -->
  <text x="${ox + W / 2}" y="${oy + ctaBase}"
    font-family="${d.instrFont}" font-size="${ctaSzPx}"
    font-weight="500"
    fill="${d.textColor}" opacity="0.70" text-anchor="middle">${d.ctaText}</text>

  ${bandSvg}`;
}

// ─────────────────────────────────────────────────────────────
// HELPERS SVG
// ─────────────────────────────────────────────────────────────

function buildBandSvg(d, ox, oy, W, H, pct) {
  const bH = Math.round(H * pct / 100);
  const bY = d.bandPosition === "top" ? oy : oy + H - bH;
  return `<rect x="${ox}" y="${bY}" width="${W}" height="${bH}"
    fill="url(#bandGrad)" opacity="0.9"/>`;
}

function buildCheckLine(x, y, text, d, fontSize, checkSz) {
  if (!text) return "";
  const cx = x + checkSz / 2;
  const cy = y - checkSz * 0.5;
  const tx = x + checkSz + Math.round(6 * SCALE);
  return `
  <circle cx="${cx}" cy="${cy}" r="${checkSz * 0.55}" fill="${d.iconsColor}" opacity="0.12"/>
  <polyline
    points="${x + checkSz*0.2},${cy} ${cx - checkSz*0.05},${y - checkSz*0.1} ${x + checkSz*0.85},${y - checkSz*0.75}"
    fill="none" stroke="${d.iconsColor}"
    stroke-width="${Math.max(1.5, d.checkStrokeWidth * SCALE * 0.5)}"
    stroke-linecap="round" stroke-linejoin="round"/>
  <text x="${tx}" y="${y}"
    font-family="${d.instrFont}" font-size="${fontSize}"
    font-weight="${d.instrFontWeight}"
    letter-spacing="${d.instrLetSpacing}"
    fill="${d.textColor}" opacity="0.90">${text}</text>`;
}

function buildCheckLineCentered(cx, y, text, d, fontSize, checkSz) {
  if (!text) return "";
  const textW  = text.length * fontSize * 0.52;
  const itemW  = checkSz + Math.round(6 * SCALE) + textW;
  const startX = cx - itemW / 2;
  return buildCheckLine(startX, y, text, d, fontSize, checkSz);
}

function buildStarsRow(x, y, count, size, color) {
  let svg = "";
  const R   = size / 2;
  const r   = R * 0.382;
  const gap = Math.round(2 * SCALE);
  for (let i = 0; i < count; i++) {
    const cx = x + R + i * (size + gap);
    const cy = y - R;
    svg += `<polygon points="${starPts(cx, cy, R, r, 5)}" fill="${color}"/>`;
  }
  return svg;
}

function starPts(cx, cy, R, r, n) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a    = i * Math.PI / n - Math.PI / 2;
    const dist = i % 2 === 0 ? R : r;
    pts.push(`${(cx + Math.cos(a) * dist).toFixed(2)},${(cy + Math.sin(a) * dist).toFixed(2)}`);
  }
  return pts.join(" ");
}

function buildNfcIcon(x, y, size, color, opacity) {
  const sc = (size / 24).toFixed(3);
  return `<g transform="translate(${x}, ${y}) scale(${sc})"
    fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"
    opacity="${opacity}">
    <path d="M6 8.32a7.43 7.43 0 0 1 0 7.36"/>
    <path d="M9.46 6.21a11.76 11.76 0 0 1 0 11.58"/>
    <path d="M12.91 4.1a16.09 16.09 0 0 1 0 15.8"/>
  </g>`;
}

function buildGoogleIcon(x, y, size, opacity) {
  const sc = (size / 24).toFixed(3);
  return `<g transform="translate(${x}, ${y}) scale(${sc})" opacity="${opacity}">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </g>`;
}

function esc(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─────────────────────────────────────────────────────────────
// PNG via sharp
// ─────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────
// PNG avec overlay logo (sharp composite)
// ─────────────────────────────────────────────────────────────

async function writePngWithLogoOverlay(svgContent, outPath, w, h, d, logoPngBuffer, rectoY) {
  try {
    const sharp = (await import("sharp")).default;

    // 1. Rasteriser le SVG (sans logo)
    let img = sharp(Buffer.from(svgContent)).resize(w, h);

    // 2. Composite le logo si disponible
    if (logoPngBuffer) {
      const logoSzPx = Math.round(d.logoSize * SCALE);   // taille réelle du logo
      const logoX    = SHEET_MARGIN + PAD;                 // même x que le texte dans buildRecto
      const bizRowY  = computeBizRowY(d);                  // y du bloc business dans la carte
      // centrer verticalement le logo dans la bizRow (items-center)
      const bizRowH  = Math.round(d.logoSize * SCALE);     // hauteur du bizRow ≈ logoSize
      const logoY    = rectoY + bizRowY;                   // top de la bizRow dans le PNG global
      console.log(`[cardExport] 🖼 Logo overlay PNG @ (${logoX}, ${logoY}) ${logoSzPx}px`);
      const logoBuf  = await sharp(logoPngBuffer)
        .resize({ width: logoSzPx, height: logoSzPx, fit: "inside", background: { r:0,g:0,b:0,alpha:0 } })
        .png()
        .toBuffer();
      img = img.composite([{ input: logoBuf, left: Math.round(logoX), top: Math.round(logoY), blend: "over" }]);
    }

    await img.png({ compressionLevel: 6 }).toFile(outPath);
    console.log(`[cardExport] ✅ PNG → ${outPath}`);
  } catch (e) {
    console.warn(`[cardExport] ⚠️ Erreur PNG : ${e.message}`);
    const placeholder = Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" +
      "0000000a49444154789c6260000000000200e221bc330000000049454e44ae426082","hex");
    await fsP.writeFile(outPath, placeholder);
  }
}

// ─────────────────────────────────────────────────────────────
// PDF A4 avec overlay logo (sharp composite sur chaque face)
// ─────────────────────────────────────────────────────────────

async function writePdfWithLogoOverlay(d, qrInner, outPath, logoPngBuffer) {
  const PW = 595, PH = 842;
  const CW_PT = 243, CH_PT = 153;
  const CX = (PW - CW_PT) / 2;
  const RY = 60;
  const VY = RY + CH_PT + 60;

  try {
    const sharp    = (await import("sharp")).default;
    // Passer d directement (logoUrl="HAS_LOGO") → buildRecto réserve l'espace
    // sans générer de <image>, le logo est posé par sharp.composite() après
    const rectoSvg = buildFaceSvg("recto", d, qrInner);
    const versoSvg = buildFaceSvg("verso",  d, qrInner);
    const W4 = Math.round(d.cardW * 4), H4 = Math.round(d.cardH * 4);

    // Rasteriser les deux faces
    let rectoImg = sharp(Buffer.from(rectoSvg)).resize(W4, H4);
    let versoImg = sharp(Buffer.from(versoSvg)).resize(W4, H4);

    // Composite logo sur le recto uniquement
    if (logoPngBuffer) {
      const imgScale  = 4;                                         // W4 = cardW × 4
      const logoSzPx  = Math.round(d.logoSize * SCALE * imgScale); // taille logo dans l'image ×4
      const logoX     = Math.round(PAD * imgScale);
      const bizRowY   = Math.round(computeBizRowY(d) * imgScale);
      console.log(`[cardExport] 🖼 Logo overlay PDF recto @ (${logoX}, ${bizRowY}) ${logoSzPx}px`);
      const logoBuf4x = await sharp(logoPngBuffer)
        .resize({ width: logoSzPx, height: logoSzPx, fit: "inside", background: { r:0,g:0,b:0,alpha:0 } })
        .png()
        .toBuffer();
      rectoImg = rectoImg.composite([{ input: logoBuf4x, left: logoX, top: bizRowY, blend: "over" }]);
    }

    const [rJpeg, vJpeg] = await Promise.all([
      rectoImg.jpeg({ quality: 97 }).toBuffer(),
      versoImg.jpeg({ quality: 97 }).toBuffer(),
    ]);

    await fsP.writeFile(outPath, assemblePdfJpeg(PW, PH, CX, RY, VY, CW_PT, CH_PT, W4, H4, rJpeg, vJpeg));
    console.log(`[cardExport] ✅ PDF (sharp JPEG ×4 + logo overlay) → ${outPath}`);
    return;
  } catch (e) {
    console.warn(`[cardExport] ⚠️ sharp indisponible : ${e.message}`);
  }

  // Puppeteer fallback
  try {
    const puppeteer = (await import("puppeteer")).default;
    const rectoSvg  = buildFaceSvg("recto", d, qrInner);
    const versoSvg  = buildFaceSvg("verso",  d, qrInner);
    const rectoB64  = Buffer.from(rectoSvg).toString("base64");
    const versoB64  = Buffer.from(versoSvg).toString("base64");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>* { margin:0; padding:0; box-sizing:border-box; }
body { width:21cm; background:#fff; padding:1cm; font-family:Arial,sans-serif; }
.label { font-size:9pt; color:#555; margin-bottom:4pt; font-weight:bold; }
.card { width:85.6mm; height:54mm; display:block; margin:0 auto; }
.sep { border:none; border-top:1px dashed #ccc; margin:8mm auto; width:85.6mm; display:block; }
</style></head><body>
<p class="label">RECTO</p>
<img class="card" src="data:image/svg+xml;base64,${rectoB64}"/>
<div class="sep"></div>
<p class="label">VERSO</p>
<img class="card" src="data:image/svg+xml;base64,${versoB64}"/>
</body></html>`;
    const browser = await puppeteer.launch({ args: ["--no-sandbox","--disable-setuid-sandbox","--disable-web-security"] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuf = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();
    await fsP.writeFile(outPath, pdfBuf);
    console.log(`[cardExport] ✅ PDF (puppeteer) → ${outPath}`);
    return;
  } catch (e) {
    console.warn(`[cardExport] ⚠️ puppeteer indisponible : ${e.message}`);
  }

  // Fallback HTML
  const rectoSvgFb = buildFaceSvg("recto", d, qrInner);
  const versoSvgFb = buildFaceSvg("verso",  d, qrInner);
  const htmlFallback = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Carte NFC</title>
<style>* { margin:0; padding:0; } body { background:#f5f5f5; padding:30px; font-family:Arial; }
.wrap { background:white; padding:20px; border-radius:8px; display:inline-block; margin:10px; }
@media print { body { background:white; } .wrap { box-shadow:none; } }
</style></head><body>
<div class="wrap"><div style="font-size:10px;color:#888;margin-bottom:6px">RECTO</div>
${rectoSvgFb.replace(/<\?xml[^>]*\?>/, "")}</div>
<div class="wrap"><div style="font-size:10px;color:#888;margin-bottom:6px">VERSO</div>
${versoSvgFb.replace(/<\?xml[^>]*\?>/, "")}</div>
</body></html>`;
  await fsP.writeFile(outPath.replace(/\.pdf$/, ".html"), htmlFallback, "utf-8");
  await fsP.writeFile(outPath, buildNoSharpPdf(PW, PH, d));
}

// Calcule le Y de bizRow (identique à buildRecto, utilisé pour l'overlay)
function computeBizRowY(d) {
  const nameSzPx   = Math.round(d.nameFontSize    * 3.5);
  const sloganSzPx = Math.round(d.sloganFontSize  * 3.5);
  const starSzPx   = Math.round(14 * 3.5);
  const checkSzPx  = Math.round(12 * 3.5);
  const instrGap   = Math.round(6  * 3.5);
  const ctaPadTop  = Math.round(d.ctaPaddingTop   * 3.5);
  const ctaSzPx    = Math.round(9  * 3.5);
  const logoSzPx   = Math.round(d.logoSize        * 3.5);
  const contentH   = nameSzPx + sloganSzPx + starSzPx + GAP4 + checkSzPx*2 + instrGap + GAP4 + ctaSzPx + ctaPadTop + 20;
  return Math.round((d.cardH - contentH) / 2);
}

function assemblePdfJpeg(PW, PH, cx, ry, vy, cw, ch, imgW, imgH, rJpeg, vJpeg) {
  const chunks = []; const xrefs = []; let pos = 0;
  function push(b) { if (!Buffer.isBuffer(b)) b=Buffer.from(b,"binary"); chunks.push(b); pos+=b.length; }
  function obj(n,s)  { xrefs[n]=pos; push(Buffer.from(s,"binary")); }
  push(Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n","binary"));
  obj(1,`1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n`);
  obj(2,`2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n`);
  obj(3,`3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${PW} ${PH}]/Contents 4 0 R/Resources<</XObject<</R 5 0 R/V 6 0 R>>>>>>\nendobj\n`);
  const rY=(PH-ry-ch).toFixed(2), vY=(PH-vy-ch).toFixed(2);
  const stream=Buffer.from(`q ${cw.toFixed(2)} 0 0 ${ch.toFixed(2)} ${cx.toFixed(2)} ${rY} cm /R Do Q\nq ${cw.toFixed(2)} 0 0 ${ch.toFixed(2)} ${cx.toFixed(2)} ${vY} cm /V Do Q`);
  obj(4,`4 0 obj\n<</Length ${stream.length}>>\nstream\n`);push(stream);push(Buffer.from("\nendstream\nendobj\n","binary"));
  function imgObj(n,jpeg){obj(n,`${n} 0 obj\n<</Type/XObject/Subtype/Image/Width ${imgW}/Height ${imgH}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${jpeg.length}>>\nstream\n`);push(jpeg);push(Buffer.from("\nendstream\nendobj\n","binary"));}
  imgObj(5,rJpeg); imgObj(6,vJpeg);
  const xpos=pos; let xr=`xref\n0 7\n0000000000 65535 f \n`;
  for(let i=1;i<=6;i++) xr+=`${String(xrefs[i]??0).padStart(10,"0")} 00000 n \n`;
  xr+=`trailer\n<</Size 7/Root 1 0 R>>\nstartxref\n${xpos}\n%%EOF\n`;
  push(Buffer.from(xr,"binary"));
  return Buffer.concat(chunks);
}

function buildNoSharpPdf(PW, PH, d) {
  function pt(s) { return (s ?? "").replace(/[^\x20-\x7E]/g, "?").replace(/[()\\]/g, "\\$&"); }
  const lines = [
    `0.97 0.97 0.97 rg 0 0 ${PW} ${PH} re f`,
    `0.1 0.1 0.1 rg`,
    `BT /F1 16 Tf 50 790 Td (Fiche impression NFC) Tj ET`,
    `BT /F1 11 Tf 50 760 Td (Business : ${pt(d.businessName)}) Tj ET`,
    `0.8 0.1 0.1 rg`,
    `BT /F1 12 Tf 50 720 Td (Rendu complet indisponible : sharp n\\047est pas installe.) Tj ET`,
    `0.1 0.1 0.1 rg`,
    `BT /F1 10 Tf 50 695 Td (Solution : npm install sharp dans le dossier backend) Tj ET`,
  ].join("\n");
  const sb = Buffer.from(lines);
  const p = [], x = []; let o = 0;
  function ao(s) { x.push(o); const b = Buffer.from(s, "binary"); p.push(b); o += b.length; }
  const hdr = Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "binary");
  p.push(hdr); o = hdr.length;
  ao(`1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n`);
  ao(`2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n`);
  ao(`3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${PW} ${PH}]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>\nendobj\n`);
  x.push(o);
  const s4h = Buffer.from(`4 0 obj\n<</Length ${sb.length}>>\nstream\n`, "binary");
  const s4e = Buffer.from("\nendstream\nendobj\n", "binary");
  p.push(s4h); o += s4h.length; p.push(sb); o += sb.length; p.push(s4e); o += s4e.length;
  ao(`5 0 obj\n<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>\nendobj\n`);
  const xp = o;
  let xr = `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 0; i < x.length; i++) xr += `${String(x[i]).padStart(10, "0")} 00000 n \n`;
  xr += `trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n${xp}\n%%EOF\n`;
  p.push(Buffer.from(xr, "binary"));
  return Buffer.concat(p);
}

function buildFaceSvg(face, d, qrInner) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  viewBox="0 0 ${d.cardW} ${d.cardH}" width="${d.cardW}" height="${d.cardH}">
<defs>
  <linearGradient id="rectoGrad" x1="94%" y1="34%" x2="6%" y2="66%">
    <stop offset="0%"  stop-color="${d.bg1}"/>
    <stop offset="70%" stop-color="${d.bg2}"/>
  </linearGradient>
  <linearGradient id="versoGrad" x1="94%" y1="34%" x2="6%" y2="66%">
    <stop offset="0%"   stop-color="${d.vbg1}"/>
    <stop offset="100%" stop-color="${d.vbg2}"/>
  </linearGradient>
  <linearGradient id="bandGrad" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%"   stop-color="${d.accentBand1}"/>
    <stop offset="100%" stop-color="${d.accentBand2}"/>
  </linearGradient>
  <clipPath id="fc"><rect width="${d.cardW}" height="${d.cardH}" rx="${RX}"/></clipPath>
</defs>
<g clip-path="url(#fc)">
  ${face === "recto" ? buildRecto(d, qrInner, 0, 0) : buildVerso(d, qrInner, 0, 0)}
</g></svg>`;
}

// ─────────────────────────────────────────────────────────────
// EXPORTS UTILITAIRES
// ─────────────────────────────────────────────────────────────

export async function deleteCardExportFiles(uid) {
  for (const ext of ["svg","png","pdf"]) {
    try { await fsP.unlink(path.join(EXPORT_DIR,`${uid}.${ext}`)); } catch {}
  }
  console.log(`[cardExport] 🗑️  uid=${uid}`);
}

export function deriveCardUrls(svgUrl) {
  if (!svgUrl) return { svgUrl: null, pngUrl: null, pdfUrl: null };
  const base = svgUrl.replace(/\.svg$/, "");
  return { svgUrl, pngUrl: `${base}.png`, pdfUrl: `${base}.pdf` };
}