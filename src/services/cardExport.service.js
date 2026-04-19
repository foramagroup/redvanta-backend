// src/services/cardExport.service.js
// ─────────────────────────────────────────────────────────────
// Génération fidèle au rendu SharedCardPreview.jsx
// ─────────────────────────────────────────────────────────────

import fsP from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import QRCode from "qrcode";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR || "uploads");
const EXPORT_DIR = path.join(PUBLIC_DIR, "uploads", "cards");

// ✅ Dimensions CR80 réduites de moitié pour export compact
const CR80 = { W: 506, H: 319 };
const RX = 8;

// ✅ SCALE réduit pour fichiers plus légers
const SCALE = 1.0;
const PAD = Math.round(16 * SCALE);
const GAP4 = Math.round(12 * SCALE);

console.log(`[cardExport] EXPORT_DIR = ${EXPORT_DIR}`);

// ─────────────────────────────────────────────────────────────
// EXPORT PRINCIPAL
// ─────────────────────────────────────────────────────────────

export async function generateCardExport(card, design) {
  if (!card?.payload) throw new Error(`[cardExport] uid=${card?.uid} — payload manquant`);

  await fsP.mkdir(EXPORT_DIR, { recursive: true });

  let logoPngBuffer = null;
  if (design?.logoUrl) {
    logoPngBuffer = await resolveLogoBuffer(design.logoUrl);
  }

  const d = normalizeDesign(design, card);
  const qrInner = await buildQrInner(card.payload, d);

  const totalW = d.cardW + 60;
  const totalH = d.cardH * 2 + 160;
  const rectoY = 30;
  const versoY = rectoY + d.cardH + 80;

  const svgContent = buildGlobalSvg(d, qrInner, totalW, totalH, rectoY, versoY);
  const svgPath = path.join(EXPORT_DIR, `${card.uid}.svg`);
  await fsP.writeFile(svgPath, svgContent, "utf-8");
  console.log(`[cardExport] ✅ SVG → ${svgPath}`);

  const pngPath = path.join(EXPORT_DIR, `${card.uid}.png`);
  await writePngWithLogoOverlay(svgContent, pngPath, totalW, totalH, d, logoPngBuffer, rectoY);

  const pdfPath = path.join(EXPORT_DIR, `${card.uid}.pdf`);
  await writePdfWithPlaywright(svgContent, pdfPath, totalW, totalH, d, logoPngBuffer, rectoY);

  const base = (process.env.APP_URL ?? process.env.FRONTEND_URL ?? "http://localhost:4000").replace(/\/$/, "");
  return {
    svgUrl: `${base}/uploads/cards/${card.uid}.svg`,
    pngUrl: `${base}/uploads/cards/${card.uid}.png`,
    pdfUrl: `${base}/uploads/cards/${card.uid}.pdf`,
  };
}

// ─────────────────────────────────────────────────────────────
// RÉSOLUTION LOGO
// ─────────────────────────────────────────────────────────────

async function resolveLogoBuffer(logoUrl) {
  if (!logoUrl || logoUrl.startsWith("http")) return null;

  const normalized = logoUrl.replace(/\//g, path.sep);
  const relative = normalized.startsWith(path.sep) ? normalized.slice(path.sep.length) : normalized;
  const subPath = relative.replace(/^uploads[\\\/]/, "");

  const candidates = [
    path.join(ROOT_DIR, relative),
    path.join(PUBLIC_DIR, relative),
    path.join(UPLOAD_DIR, subPath),
  ];

  let srcPath = null;
  for (const c of candidates) {
    if (await fsP.access(c).then(() => true).catch(() => false)) {
      srcPath = c;
      break;
    }
  }

  if (!srcPath) return null;

  try {
    const sharp = (await import("sharp")).default;
    return await sharp(srcPath).png().toBuffer();
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// NORMALISATION DU DESIGN
// ─────────────────────────────────────────────────────────────

const LETTER_SPACING_MAP = {
  tight: "-0.025em", normal: "0em", wide: "0.05em", wider: "0.1em",
  Tight: "-0.025em", Normal: "0em", Wide: "0.05em", Wider: "0.1em",
};

function normalizeDesign(design, card) {
  const d = design ?? {};
  const orientation = d.orientation ?? "landscape";
  const isLandscape = orientation === "landscape";
  const cardW = isLandscape ? CR80.W : CR80.H;
  const cardH = isLandscape ? CR80.H : CR80.W;

  const colorMode = d.colorMode ?? "single";
  const bg1 = colorMode === "single" ? (d.bgColor ?? "#0B0D0F") : (d.gradient1 ?? "#0B0D0F");
  const bg2 = colorMode === "single" ? bg1 : (d.gradient2 ?? "#1A1A1A");

  // ✅ Gestion des elementOffsets (JSON depuis DB)
  const elementOffsets = d.elementOffsets || {};
  const frontOffsets = elementOffsets?.[orientation]?.front || {};
  const backOffsets = elementOffsets?.[orientation]?.back || {};

  return {
    cardW, cardH, isLandscape, orientation,
    colorMode, bg1, bg2,
    textColor: d.textColor ?? "#FFFFFF",
    accentBand1: d.accentBand1 ?? d.accentColor ?? "#E10600",
    accentBand2: d.accentBand2 ?? d.accentBand1 ?? "#E10600",
    bandPosition: d.bandPosition ?? "bottom",
    frontBandH: d.frontBandHeight ?? 22,
    backBandH: d.backBandHeight ?? 12,

    businessFont: d.businessFont ?? "Space Grotesk",
    businessFontSize: d.businessFontSize ?? 16,
    businessFontWeight: d.businessFontWeight ?? "Bold",
    businessFontSpacing: LETTER_SPACING_MAP[d.businessFontSpacing] ?? "0em",
    businessTextTransform: d.businessTextTransform === "none" ? null : d.businessTextTransform,
    businessAlign: d.businessAlign ?? "Left",

    sloganFont: d.sloganFont ?? "Inter",
    sloganFontSize: d.sloganFontSize ?? 12,
    sloganFontWeight: d.sloganFontWeight ?? "Regular",
    sloganFontSpacing: LETTER_SPACING_MAP[d.sloganFontSpacing] ?? "0em",
    sloganTextTransform: d.sloganTextTransform === "none" ? null : d.sloganTextTransform,

    instrFont: d.instrFont ?? "Space Grotesk",
    instrFontSize: d.instrFontSize ?? 10,
    instrFontWeight: d.instrFontWeight ?? "Regular",
    instrFontSpacing: LETTER_SPACING_MAP[d.instrFontSpacing] ?? "0em",

    qrColor: d.accentColor ?? "#E10600",
    qrSize: d.qrCodeSize ?? 80,
    qrPosition: d.qrCodeStyle ?? "top",

    logoUrl: d.logoUrl ?? null,
    logoPosition: d.logoPosition ?? "left",
    logoSize: d.logoSize ?? 32,

    starsColor: d.starColor ?? "#F59E0B",
    iconsColor: d.iconsColor ?? "#22C55E",
    checkStrokeWidth: d.checkStrokeWidth ? parseFloat(d.checkStrokeWidth) : 3.5,
    showNfcIcon: d.showNfcIcon !== false,
    showGoogleIcon: d.showGoogleIcon !== false,
    nfcIconSize: d.nfcIconSize ?? 24,
    googleIconSize: d.googleLogoSize ?? 16,

    businessName: esc(d.businessName ?? card?.locationName ?? "Business Name"),
    sloganText: d.slogan ? esc(d.slogan) : null,
    ctaText: esc(d.callToAction ?? "Powered by RedVanta"),
    ctaPaddingTop: d.ctaPaddingTop ?? 8,

    frontInstruction1: esc(d.frontInstruction1 ?? "Approach the phone to the card"),
    frontInstruction2: esc(d.frontInstruction2 ?? "Tap to leave a review"),
    backInstruction1: esc(d.backInstruction1 ?? "Scan the QR code with your camera"),
    backInstruction2: esc(d.backInstruction2 ?? "Write a review on our profile page"),

    // ✅ Offsets drag-and-drop (px) depuis elementOffsets
    frontOffsets,
    backOffsets,
  };
}

// ─────────────────────────────────────────────────────────────
// QR CODE
// ─────────────────────────────────────────────────────────────

async function buildQrInner(payload, d) {
  const svgStr = await QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 0,
    color: {
      dark: d.qrColor,
      light: "#FFFFFF",
    },
  });

  const viewBoxMatch = svgStr.match(/viewBox="([^"]+)"/);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 33 33";
  const contentMatch = svgStr.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  const innerContent = contentMatch ? contentMatch[1] : svgStr;

  return `<svg viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
    ${innerContent}
  </svg>`;
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
    <rect x="30" y="${rectoY}" width="${d.cardW}" height="${d.cardH}" rx="${RX}"/>
  </clipPath>
  <clipPath id="cv">
    <rect x="30" y="${versoY}" width="${d.cardW}" height="${d.cardH}" rx="${RX}"/>
  </clipPath>
</defs>

<text x="30" y="${rectoY - 10}" font-family="Arial,sans-serif" font-size="16" fill="#555">RECTO</text>
<g clip-path="url(#cr)">
  ${buildRecto(d, qrInner, 30, rectoY)}
</g>

<line x1="30" y1="${rectoY + d.cardH + 40}" x2="${30 + d.cardW}" y2="${rectoY + d.cardH + 40}"
      stroke="#333" stroke-width="1" stroke-dasharray="6 4" opacity="0.4"/>

<text x="30" y="${versoY - 10}" font-family="Arial,sans-serif" font-size="16" fill="#555">VERSO</text>
<g clip-path="url(#cv)">
  ${buildVerso(d, qrInner, 30, versoY)}
</g>
</svg>`;
}

function buildGradientDefs(d) {
  return `
  <linearGradient id="rectoGrad" x1="94%" y1="34%" x2="6%" y2="66%">
    <stop offset="0%" stop-color="${d.bg1}"/>
    <stop offset="70%" stop-color="${d.bg2}"/>
  </linearGradient>
  <linearGradient id="versoGrad" x1="94%" y1="34%" x2="6%" y2="66%">
    <stop offset="0%" stop-color="${d.bg2}"/>
    <stop offset="100%" stop-color="${d.bg1}"/>
  </linearGradient>
  <linearGradient id="bandGrad" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="${d.accentBand1}"/>
    <stop offset="100%" stop-color="${d.accentBand2}"/>
  </linearGradient>`;
}

// ─────────────────────────────────────────────────────────────
// RECTO
// ─────────────────────────────────────────────────────────────

function buildRecto(d, _qrInner, ox, oy) {
  const W = d.cardW, H = d.cardH;

  const logoSzPx = Math.round(d.logoSize * SCALE);
  const nameSzPx = Math.round(d.businessFontSize * SCALE);
  const sloganSzPx = Math.round(d.sloganFontSize * SCALE);
  const instrSzPx = Math.round(d.instrFontSize * SCALE);
  const ctaSzPx = Math.round(9 * SCALE);
  const nfcSzPx = Math.round(d.nfcIconSize * SCALE);
  const gSzPx = Math.round(d.googleIconSize * SCALE);
  const starSzPx = Math.round(12 * SCALE);
  const checkSzPx = Math.round(10 * SCALE);
  const instrGap = Math.round(5 * SCALE);

  const hasBand = d.colorMode === "template" && d.bandPosition !== "hidden";
  const bandH_px = hasBand ? Math.round((H * d.frontBandH) / 100) : 0;
  const bandSvg = hasBand ? buildBandSvg(d, ox, oy, W, H, d.frontBandH) : "";

  const usableH = H - bandH_px;

  // ✅ CTA : ctaPaddingTop depuis le BAS de la zone utile + offset drag (CORRIGÉ)
  const ctaPadPx = Math.round(d.ctaPaddingTop * SCALE);
  const ctaOffsetX = (d.frontOffsets?.cta?.x || 0);  // ✅ PAS de multiplication par SCALE
  const ctaOffsetY = (d.frontOffsets?.cta?.y || 0);  // ✅ PAS de multiplication par SCALE
  const ctaBaseY = usableH - ctaPadPx + ctaOffsetY;

  const sloganExtra = d.sloganText ? sloganSzPx + Math.round(3 * SCALE) : 0;
  const headerH = nameSzPx + sloganExtra + Math.round(5 * SCALE) + starSzPx;
  const instrCount = (d.frontInstruction1 ? 1 : 0) + (d.frontInstruction2 ? 1 : 0);
  const instrBlockH = instrCount * checkSzPx + (instrCount > 1 ? instrGap : 0);
  const contentH = headerH + GAP4 + instrBlockH;
  const contentY = Math.round((usableH - contentH) / 2);

  const nameBaseY = contentY + nameSzPx;
  const sloganBaseY = nameBaseY + Math.round(3 * SCALE) + sloganSzPx;
  const starsBaseY = (d.sloganText ? sloganBaseY : nameBaseY) + Math.round(5 * SCALE) + starSzPx;
  const instr1BaseY = starsBaseY + GAP4 + checkSzPx;
  const instr2BaseY = instr1BaseY + instrGap + checkSzPx;

  // ✅ Offsets drag-and-drop (PAS de multiplication par SCALE, valeurs brutes en px)
  const instrOffsetX = d.frontOffsets?.instructions?.x || 0;
  const instrOffsetY = d.frontOffsets?.instructions?.y || 0;
  const logoOffsetX = d.frontOffsets?.logo?.x || 0;
  const logoOffsetY = d.frontOffsets?.logo?.y || 0;

  const nfcOffsetX = d.frontOffsets?.nfcIcon?.x || 0;
  const nfcOffsetY = d.frontOffsets?.nfcIcon?.y || 0;
  const nfcX = ox + W - Math.round(8 * SCALE) - nfcSzPx + nfcOffsetX;
  const nfcY = oy + Math.round(8 * SCALE) + nfcOffsetY;

  const gOffsetX = d.frontOffsets?.googleIcon?.x || 0;
  const gOffsetY = d.frontOffsets?.googleIcon?.y || 0;
  const gBandCenterY = bandH_px > 0
    ? oy + H - Math.round((bandH_px + gSzPx) / 2) + gOffsetY
    : oy + H - Math.round(5 * SCALE) - gSzPx + gOffsetY;
  const gX = ox + W - Math.round(6 * SCALE) - gSzPx + gOffsetX;

  // ✅ Layout selon logoPosition
  const logoPos = d.logoPosition || "left";
  const isLogoHorizontal = logoPos === "left" || logoPos === "right";
  const isLogoLeft = logoPos === "left";

  let logoSvg = "";
  let businessInfoX = PAD;

  if (d.logoUrl && isLogoHorizontal) {
    const logoX = isLogoLeft 
      ? ox + PAD + logoOffsetX 
      : ox + W - PAD - logoSzPx + logoOffsetX;
    const logoY = oy + contentY + logoOffsetY;
    
    logoSvg = `<image href="${d.logoUrl}" x="${logoX}" y="${logoY}" width="${logoSzPx}" height="${logoSzPx}" preserveAspectRatio="xMidYMid meet"/>`;
    
    if (isLogoLeft) {
      businessInfoX = PAD + logoSzPx + Math.round(5 * SCALE);
    }
  }

  return `
  <rect x="${ox}" y="${oy}" width="${W}" height="${H}" fill="url(#rectoGrad)"/>
  ${bandSvg}
  ${d.showNfcIcon ? buildNfcIcon(nfcX, nfcY, nfcSzPx, d.textColor, 0.3) : ""}
  ${d.showGoogleIcon ? buildGoogleIcon(gX, gBandCenterY, gSzPx, 1.0) : ""}

  ${logoSvg}

  <text x="${ox + businessInfoX}" y="${oy + nameBaseY}"
    font-family="${d.businessFont}" font-size="${nameSzPx}"
    font-weight="${d.businessFontWeight}"
    letter-spacing="${d.businessFontSpacing}"
    ${d.businessTextTransform ? `text-transform="${d.businessTextTransform}"` : ""}
    fill="${d.textColor}"
    text-anchor="start">${d.businessName}</text>

  ${d.sloganText ? `<text x="${ox + businessInfoX}" y="${oy + sloganBaseY}"
    font-family="${d.sloganFont}" font-size="${sloganSzPx}"
    font-weight="${d.sloganFontWeight}"
    letter-spacing="${d.sloganFontSpacing}"
    ${d.sloganTextTransform ? `text-transform="${d.sloganTextTransform}"` : ""}
    fill="${d.textColor}" opacity="0.70">${d.sloganText}</text>` : ""}

  ${buildStarsRow(ox + businessInfoX, oy + starsBaseY, 5, starSzPx, d.starsColor)}

  ${d.frontInstruction1 ? buildCheckLine(ox + PAD + instrOffsetX, oy + instr1BaseY + instrOffsetY, d.frontInstruction1, d, instrSzPx, checkSzPx) : ""}
  ${d.frontInstruction2 ? buildCheckLine(ox + PAD + instrOffsetX, oy + instr2BaseY + instrOffsetY, d.frontInstruction2, d, instrSzPx, checkSzPx) : ""}

  <text x="${ox + PAD + ctaOffsetX}" y="${oy + ctaBaseY}"
    font-family="${d.instrFont}" font-size="${ctaSzPx}"
    font-weight="500"
    fill="${d.textColor}" opacity="0.75">${d.ctaText}</text>
`;
}

// ─────────────────────────────────────────────────────────────
// VERSO
// ─────────────────────────────────────────────────────────────

function buildVerso(d, qrInner, ox, oy) {
  const W = d.cardW, H = d.cardH;

  const nameSzPx = Math.round(Math.max(d.businessFontSize - 3, 9) * SCALE);
  const sloganSzPx = Math.round(Math.max(d.sloganFontSize - 2, 8) * SCALE);
  const instrSzPx = Math.round(Math.max(d.instrFontSize - 1, 8) * SCALE);
  const ctaSzPx = Math.round(8 * SCALE);
  const starSzPx = Math.round(10 * SCALE);
  const checkSzPx = Math.round(10 * SCALE);
  const gSzPx = Math.round(d.googleIconSize * SCALE);
  const qrSzPx = Math.min(Math.round(d.qrSize * SCALE), Math.round(H * 0.45));
  const rowGap = Math.round(10 * SCALE);
  const instrGap = Math.round(5 * SCALE);

  const hasBand = d.colorMode === "template" && d.bandPosition !== "hidden";
  const bandH_px = hasBand ? Math.round((H * d.backBandH) / 100) : 0;
  const bandSvg = hasBand ? buildBandSvg(d, ox, oy, W, H, d.backBandH) : "";

  const usableH = H - bandH_px;

  // ✅ CTA : ctaPaddingTop depuis le BAS de la zone utile + offset drag (CORRIGÉ)
  const ctaPadPx = Math.round(d.ctaPaddingTop * SCALE);
  const ctaOffsetY = d.backOffsets?.cta?.y || 0;  // ✅ PAS de multiplication par SCALE
  const ctaBaseY = usableH - ctaPadPx + ctaOffsetY;

  const gOffsetX = d.backOffsets?.googleIcon?.x || 0;
  const gOffsetY = d.backOffsets?.googleIcon?.y || 0;
  const gBandCenterY = bandH_px > 0
    ? oy + H - Math.round((bandH_px + gSzPx) / 2) + gOffsetY
    : oy + H - Math.round(5 * SCALE) - gSzPx + gOffsetY;
  const gX = ox + W - Math.round(6 * SCALE) - gSzPx + gOffsetX;

  // ✅ QR : fond blanc + brackets blancs
  const bracketSize = Math.round(qrSzPx * 0.28);
  const bracketW = Math.round(bracketSize * 0.25);

  const isQrHoriz = d.qrPosition === "left" || d.qrPosition === "right";
  const isQrFirst = d.qrPosition === "left" || d.qrPosition === "top";

  const sloganLineH = d.sloganText ? sloganSzPx + Math.round(3 * SCALE) : 0;
  const infoH = nameSzPx + Math.round(3 * SCALE) + sloganLineH + Math.round(3 * SCALE) + starSzPx;
  const topRowH = Math.max(qrSzPx, infoH);

  const instrCount = (d.backInstruction1 ? 1 : 0) + (d.backInstruction2 ? 1 : 0);
  const instrTotalH = instrCount * checkSzPx + (instrCount > 1 ? instrGap : 0);
  const contentH = topRowH + GAP4 + instrTotalH;
  const startY = Math.round((usableH - contentH) / 2);

  const topRowTop = startY;
  const instrTop = topRowTop + topRowH + GAP4;
  const instr1Base = instrTop + checkSzPx;
  const instr2Base = instr1Base + instrGap + checkSzPx;

  const infoBlockW = Math.round(W * 0.4);
  const topRowW = isQrHoriz ? infoBlockW + rowGap + qrSzPx : Math.max(qrSzPx, infoBlockW);
  const topRowX = Math.round((W - topRowW) / 2);

  let qrX, infoBlockX;
  if (isQrHoriz) {
    if (isQrFirst) { qrX = ox + topRowX; infoBlockX = qrX + qrSzPx + rowGap; }
    else { infoBlockX = ox + topRowX; qrX = infoBlockX + infoBlockW + rowGap; }
  } else {
    qrX = ox + Math.round((W - qrSzPx) / 2);
    infoBlockX = ox + Math.round((W - infoBlockW) / 2);
  }

  const infoCX = infoBlockX + Math.round(infoBlockW / 2);
  const qrY = oy + topRowTop + Math.round((topRowH - qrSzPx) / 2);
  const infoTopY = oy + topRowTop + Math.round((topRowH - infoH) / 2);
  const nameBaseY = infoTopY + nameSzPx;
  const sloganBaseY = nameBaseY + Math.round(3 * SCALE) + sloganSzPx;
  const starsY = (d.sloganText ? sloganBaseY : nameBaseY) + Math.round(3 * SCALE) + starSzPx;
  const starsStartX = infoCX - Math.round((5 * (starSzPx + Math.round(1.5 * SCALE))) / 2);

  return `
  <rect x="${ox}" y="${oy}" width="${W}" height="${H}" fill="url(#versoGrad)"/>
  ${bandSvg}
  ${d.showGoogleIcon ? buildGoogleIcon(gX, gBandCenterY, gSzPx, 1.0) : ""}

  <rect x="${qrX}" y="${qrY}" width="${qrSzPx}" height="${qrSzPx}" rx="6" fill="#FFFFFF"/>
  
  <rect x="${qrX}" y="${qrY}" width="${bracketSize}" height="${bracketW}" fill="#FFFFFF"/>
  <rect x="${qrX}" y="${qrY}" width="${bracketW}" height="${bracketSize}" fill="#FFFFFF"/>
  <rect x="${qrX + qrSzPx - bracketSize}" y="${qrY}" width="${bracketSize}" height="${bracketW}" fill="#FFFFFF"/>
  <rect x="${qrX + qrSzPx - bracketW}" y="${qrY}" width="${bracketW}" height="${bracketSize}" fill="#FFFFFF"/>
  <rect x="${qrX}" y="${qrY + qrSzPx - bracketW}" width="${bracketSize}" height="${bracketW}" fill="#FFFFFF"/>
  <rect x="${qrX}" y="${qrY + qrSzPx - bracketSize}" width="${bracketW}" height="${bracketSize}" fill="#FFFFFF"/>
  <rect x="${qrX + qrSzPx - bracketSize}" y="${qrY + qrSzPx - bracketW}" width="${bracketSize}" height="${bracketW}" fill="#FFFFFF"/>
  <rect x="${qrX + qrSzPx - bracketW}" y="${qrY + qrSzPx - bracketSize}" width="${bracketW}" height="${bracketSize}" fill="#FFFFFF"/>

  <svg x="${qrX + Math.round(qrSzPx * 0.1)}" y="${qrY + Math.round(qrSzPx * 0.1)}"
       width="${Math.round(qrSzPx * 0.8)}" height="${Math.round(qrSzPx * 0.8)}"
       viewBox="0 0 ${Math.round(qrSzPx * 0.8)} ${Math.round(qrSzPx * 0.8)}"
       preserveAspectRatio="xMidYMid meet">${qrInner}</svg>

  <text x="${infoCX}" y="${nameBaseY}"
    font-family="${d.businessFont}" font-size="${nameSzPx}"
    font-weight="${d.businessFontWeight}"
    fill="${d.textColor}" text-anchor="middle">${d.businessName}</text>

  ${d.sloganText ? `<text x="${infoCX}" y="${sloganBaseY}"
    font-family="${d.sloganFont}" font-size="${sloganSzPx}"
    font-weight="${d.sloganFontWeight}"
    fill="${d.textColor}" opacity="0.70" text-anchor="middle">${d.sloganText}</text>` : ""}

  ${buildStarsRow(starsStartX, starsY, 5, starSzPx, d.starsColor)}

  ${d.backInstruction1 ? buildCheckLineCentered(ox + W / 2, oy + instr1Base, d.backInstruction1, d, instrSzPx, checkSzPx) : ""}
  ${d.backInstruction2 ? buildCheckLineCentered(ox + W / 2, oy + instr2Base, d.backInstruction2, d, instrSzPx, checkSzPx) : ""}

  <text x="${ox + W / 2}" y="${oy + ctaBaseY}"
    font-family="${d.instrFont}" font-size="${ctaSzPx}"
    font-weight="500"
    fill="${d.textColor}" opacity="0.70" text-anchor="middle">${d.ctaText}</text>
`;
}

// ─────────────────────────────────────────────────────────────
// HELPERS SVG
// ─────────────────────────────────────────────────────────────

function buildBandSvg(d, ox, oy, W, H, pct) {
  const bH = Math.round((H * pct) / 100);
  const bY = d.bandPosition === "top" ? oy : oy + H - bH;
  return `<rect x="${ox}" y="${bY}" width="${W}" height="${bH}"
    fill="url(#bandGrad)" opacity="0.9"/>`;
}

function buildCheckLine(x, y, text, d, fontSize, checkSz) {
  if (!text) return "";
  const cx = x + checkSz / 2;
  const cy = y - checkSz * 0.5;
  const tx = x + checkSz + Math.round(6 * SCALE);
  const sw = Math.max(1.5, d.checkStrokeWidth * SCALE * 0.35);
  return `
  <circle cx="${cx}" cy="${cy}" r="${checkSz * 0.55}" fill="${d.iconsColor}" opacity="0.15"/>
  <polyline
    points="${x + checkSz * 0.2},${cy} ${cx - checkSz * 0.05},${y - checkSz * 0.1} ${x + checkSz * 0.85},${y - checkSz * 0.75}"
    fill="none" stroke="${d.iconsColor}"
    stroke-width="${sw}"
    stroke-linecap="round" stroke-linejoin="round"/>
  <text x="${tx}" y="${y}"
    font-family="${d.instrFont}" font-size="${fontSize}"
    font-weight="${d.instrFontWeight}"
    letter-spacing="${d.instrFontSpacing}"
    fill="${d.textColor}" opacity="0.90">${text}</text>`;
}

function buildCheckLineCentered(cx, y, text, d, fontSize, checkSz) {
  if (!text) return "";
  const textW = text.length * fontSize * 0.5;
  const itemW = checkSz + Math.round(6 * SCALE) + textW;
  const startX = cx - itemW / 2;
  return buildCheckLine(startX, y, text, d, fontSize, checkSz);
}

function buildStarsRow(x, y, count, size, color) {
  let svg = "";
  const R = size / 2;
  const r = R * 0.382;
  const gap = Math.round(1.5 * SCALE);
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
    const a = (i * Math.PI) / n - Math.PI / 2;
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
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─────────────────────────────────────────────────────────────
// PNG + PDF (inchangé)
// ─────────────────────────────────────────────────────────────

async function writePngWithLogoOverlay(svgContent, outPath, w, h, d, logoPngBuffer, rectoY) {
  try {
    const sharp = (await import("sharp")).default;
    let img = sharp(Buffer.from(svgContent)).resize(w, h);
    if (logoPngBuffer) {
      const logoSzPx = Math.round(d.logoSize * SCALE);
      const logoX = 30 + PAD;
      const bizRowY = Math.round((d.cardH - 180) / 2);
      const logoY = rectoY + bizRowY;
      const logoBuf = await sharp(logoPngBuffer)
        .resize({ width: logoSzPx, height: logoSzPx, fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      img = img.composite([{ input: logoBuf, left: Math.round(logoX), top: Math.round(logoY), blend: "over" }]);
    }
    await img.png({ compressionLevel: 6 }).toFile(outPath);
    console.log(`[cardExport] ✅ PNG → ${outPath}`);
  } catch (e) {
    console.warn(`[cardExport] ⚠️ Erreur PNG : ${e.message}`);
  }
}

async function writePdfWithPlaywright(svgContent, pdfPath, totalW, totalH, d, logoPngBuffer, rectoY) {
  try {
    const { chromium } = await import("playwright");
    const sharp = (await import("sharp")).default;
    let img = sharp(Buffer.from(svgContent)).resize(totalW, totalH);

    if (logoPngBuffer) {
      const logoSzPx = Math.round(d.logoSize * SCALE);
      const logoX = 30 + PAD;
      const bizRowY = Math.round((d.cardH - 180) / 2);
      const logoY = rectoY + bizRowY;
      const logoBuf = await sharp(logoPngBuffer)
        .resize({ width: logoSzPx, height: logoSzPx, fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      img = img.composite([{ input: logoBuf, left: Math.round(logoX), top: Math.round(logoY), blend: "over" }]);
    }

    const pngBuffer = await img.png({ compressionLevel: 6 }).toBuffer();
    const base64Png = pngBuffer.toString("base64");

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${totalW}px; height: ${totalH}px; background: white; }
  img { display: block; width: ${totalW}px; height: ${totalH}px; }
</style>
</head>
<body>
  <img src="data:image/png;base64,${base64Png}" />
</body>
</html>`;

    const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();

    await page.setViewportSize({ width: totalW, height: totalH });
    await page.setContent(html, { waitUntil: "networkidle" });

    await page.pdf({
      path: pdfPath,
      width: `${totalW}px`,
      height: `${totalH}px`,
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    await browser.close();
    console.log(`[cardExport] ✅ PDF → ${pdfPath}`);
  } catch (e) {
    console.warn(`[cardExport] ⚠️ Erreur PDF Playwright : ${e.message}`);
    await writePdfFallback(svgContent, pdfPath, totalW, totalH, d, logoPngBuffer, rectoY);
  }
}

async function writePdfFallback(svgContent, pdfPath, totalW, totalH, d, logoPngBuffer, rectoY) {
  try {
    const sharp = (await import("sharp")).default;
    let img = sharp(Buffer.from(svgContent)).resize(totalW, totalH);

    if (logoPngBuffer) {
      const logoSzPx = Math.round(d.logoSize * SCALE);
      const logoX = 30 + PAD;
      const bizRowY = Math.round((d.cardH - 180) / 2);
      const logoY = rectoY + bizRowY;
      const logoBuf = await sharp(logoPngBuffer)
        .resize({ width: logoSzPx, height: logoSzPx, fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      img = img.composite([{ input: logoBuf, left: Math.round(logoX), top: Math.round(logoY), blend: "over" }]);
    }

    const jpegBuffer = await img.jpeg({ quality: 95 }).toBuffer();
    const pdfContent = buildMinimalPdf(jpegBuffer, totalW, totalH);
    await fsP.writeFile(pdfPath, pdfContent);
    console.log(`[cardExport] ✅ PDF fallback → ${pdfPath}`);
  } catch (e) {
    console.warn(`[cardExport] ⚠️ Erreur PDF fallback : ${e.message}`);
  }
}

function buildMinimalPdf(jpegBuffer, widthPx, heightPx) {
  const wPt = Math.round(widthPx * 72 / 96);
  const hPt = Math.round(heightPx * 72 / 96);
  const imgLen = jpegBuffer.length;

  const xref = [];
  const parts = [];

  const push = (s) => { xref.push(parts.reduce((a, b) => a + b.length, 0)); parts.push(Buffer.isBuffer(s) ? s : Buffer.from(s, "latin1")); };

  push("%PDF-1.4\n");
  push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`);
  push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt} ${hPt}]\n   /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> >> >>\nendobj\n`);
  push(`4 0 obj\n<< /Length 35 >>\nstream\nq ${wPt} 0 0 ${hPt} 0 0 cm /Im1 Do Q\nendstream\nendobj\n`);
  push(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx}\n   /ColorSpace /DeviceRGB /BitsPerComponent 8\n   /Filter /DCTDecode /Length ${imgLen} >>\nstream\n`);
  push(jpegBuffer);
  push(`\nendstream\nendobj\n`);

  const xrefOffset = parts.reduce((a, b) => a + b.length, 0);
  const xrefTable = `xref\n0 6\n0000000000 65535 f \n` + xref.slice(1).map(o => String(o).padStart(10, "0") + " 00000 n \n").join("");
  push(xrefTable);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return Buffer.concat(parts);
}

export async function deleteCardExportFiles(uid) {
  for (const ext of ["svg", "png", "pdf"]) {
    try {
      await fsP.unlink(path.join(EXPORT_DIR, `${uid}.${ext}`));
    } catch {}
  }
}

export function deriveCardUrls(svgUrl) {
  if (!svgUrl) return { svgUrl: null, pngUrl: null, pdfUrl: null };
  const base = svgUrl.replace(/\.svg$/, "");
  return { svgUrl, pngUrl: `${base}.png`, pdfUrl: `${base}.pdf` };
}