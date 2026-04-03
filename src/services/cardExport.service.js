// src/services/cardExport.service.js
// ─────────────────────────────────────────────────────────────
// Service de génération des fichiers d'impression des cartes NFC
//
// Format de sortie (recto EN HAUT, verso EN BAS sur la même feuille) :
//
//   ┌─────────────────────┐  ←── RECTO (face avant)
//   │  Logo | BusinessName│
//   │  Slogan             │
//   │  QR Code            │
//   │  Instructions front │
//   └─────────────────────┘
//        (séparateur)
//   ┌─────────────────────┐  ←── VERSO (face arrière)
//   │  Instructions back  │
//   │  NFC Icon           │
//   └─────────────────────┘
//
// Dimensions standard carte PVC : 85.6mm × 54mm (CR80)
// En pixels @ 300 DPI : 1011px × 638px
// En points PDF (72pt/inch) : 242.6pt × 153pt
//
// Formats exportés :
//   SVG  → vectoriel, impression HD
//   PNG  → 300 DPI (recto + verso empilés)
//   PDF  → A4, recto en haut / verso en bas, prêt imprimeur
//
// ─────────────────────────────────────────────────────────────

import fs   from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import QRCode from "qrcode";

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const EXPORT_DIR = path.resolve(__dirname, "../../../public/uploads/cards");

// ── Dimensions carte CR80 @ 300 DPI ──────────────────────────
const CARD = {
  W_PX:  1011,   // 85.6mm @ 300dpi
  H_PX:   638,   // 54mm   @ 300dpi
  W_MM:  85.6,
  H_MM:  54,
  W_PT:  242.6,  // pour PDF
  H_PT:  153,
};

const GAP_PX  = 60;   // espace entre recto et verso dans le SVG/PNG
const MARGIN  = 20;   // marge SVG autour des cartes

// ─────────────────────────────────────────────────────────────
// EXPORT PRINCIPAL — appelé depuis nfcCards.controller.js
// Génère SVG + PNG + PDF pour une NFCCard avec son design
// ─────────────────────────────────────────────────────────────

export async function generateCardExport(card, design) {
  await fs.mkdir(EXPORT_DIR, { recursive: true });

  // 1. Générer le QR code SVG du payload
  const qrSvgString = await generateQrSvg(card.payload, design);

  // 2. Construire les données de rendu
  const renderData = buildRenderData(card, design, qrSvgString);

  // 3. Générer le SVG complet (recto + verso)
  const svgContent = buildCardSheetSvg(renderData);

  // 4. Sauvegarder SVG
  const svgPath = path.join(EXPORT_DIR, `${card.uid}.svg`);
  await fs.writeFile(svgPath, svgContent, "utf-8");

  // 5. Générer PNG depuis SVG via sharp
  const pngPath = path.join(EXPORT_DIR, `${card.uid}.png`);
  await svgToPng(svgContent, pngPath, renderData.totalWidth, renderData.totalHeight);

  // 6. Générer PDF (A4, recto/verso empilés, centré)
  const pdfPath = path.join(EXPORT_DIR, `${card.uid}.pdf`);
  await buildCardPdf(card, design, qrSvgString, pdfPath);

  const base = `${process.env.APP_URL ?? process.env.FRONTEND_URL}/uploads/cards`;

  return {
    svgUrl: `${base}/${card.uid}.svg`,
    pngUrl: `${base}/${card.uid}.png`,
    pdfUrl: `${base}/${card.uid}.pdf`,
  };
}

// ─────────────────────────────────────────────────────────────
// QR CODE — générateur SVG intégré dans la carte
// ─────────────────────────────────────────────────────────────

async function generateQrSvg(payload, design) {
  const qrColor = design?.accentColor ?? "#E10600";
  const bgColor = design?.bgColor     ?? "#0B0D0F";

  // Générer le QR en string SVG
  const svgString = await QRCode.toString(payload, {
    type:                 "svg",
    errorCorrectionLevel: "H",
    margin:               1,
    color: { dark: qrColor, light: bgColor },
  });

  // Extraire uniquement le contenu intérieur du SVG (pas les balises root)
  // pour pouvoir l'intégrer dans le SVG de la carte
  const innerMatch = svgString.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  return innerMatch ? innerMatch[1] : svgString;
}

// ─────────────────────────────────────────────────────────────
// DONNÉES DE RENDU — construit les coordonnées et styles
// depuis le modèle Design (tous les champs du schéma Prisma)
// ─────────────────────────────────────────────────────────────

function buildRenderData(card, design, qrSvgInner) {
  const d = design ?? {};

  // Couleurs
  const bgColor      = d.bgColor      ?? "#0B0D0F";
  const textColor    = d.textColor    ?? "#FFFFFF";
  const accentColor  = d.accentColor  ?? "#E10600";
  const starColor    = d.starColor    ?? "#F59E0B";
  const iconsColor   = d.iconsColor   ?? "#22C55E";
  const gradient1    = d.gradient1    ?? bgColor;
  const gradient2    = d.gradient2    ?? "#1A1A1A";
  const accentBand1  = d.accentBand1  ?? accentColor;
  const bandPosition = d.bandPosition ?? "bottom";
  const frontBandH   = d.frontBandHeight ?? 22;  // % de la hauteur
  const backBandH    = d.backBandHeight  ?? 12;

  // Typographie
  const bizFont      = d.businessFont          ?? "Space Grotesk";
  const bizSize      = d.businessFontSize      ?? 16;
  const bizWeight    = d.businessFontWeight    ?? "700";
  const bizTransform = d.businessTextTransform ?? "none";
  const sloganFont   = d.sloganFont            ?? "Inter";
  const sloganSize   = d.sloganFontSize        ?? 12;

  // QR Code
  const qrSize       = d.qrCodeSize   ?? 60;   // % de la hauteur carte
  const qrSizePx     = Math.round(CARD.H_PX * (qrSize / 100));
  const qrPos        = d.qrCodeStyle  ?? "left"; // "left"|"right"|"top"|"bottom"

  // Logo
  const logoH        = d.logoSize     ?? 32;   // px en rendu
  const logoPos      = d.logoPosition ?? "left";

  // Orientation
  const isPortrait   = d.orientation === "portrait";
  const cardW        = isPortrait ? CARD.H_PX : CARD.W_PX;
  const cardH        = isPortrait ? CARD.W_PX : CARD.H_PX;

  // Layout total SVG (recto + GAP + verso)
  const totalWidth   = cardW + MARGIN * 2;
  const totalHeight  = cardH * 2 + GAP_PX + MARGIN * 2;

  // Position recto (haut) et verso (bas)
  const rectoY = MARGIN;
  const versoY = MARGIN + cardH + GAP_PX;

  return {
    card, design: d,
    // Dimensions
    cardW, cardH, totalWidth, totalHeight,
    rectoY, versoY, isPortrait,
    // Couleurs
    bgColor, textColor, accentColor, starColor, iconsColor,
    gradient1, gradient2, accentBand1,
    bandPosition, frontBandH, backBandH,
    // Typo
    bizFont, bizSize, bizWeight, bizTransform,
    sloganFont, sloganSize,
    // QR
    qrSvgInner, qrSizePx, qrPos,
    // Logo
    logoH, logoPos,
    // Textes
    businessName:   d.businessName      ?? card.locationName ?? "Business",
    slogan:         d.slogan            ?? null,
    callToAction:   d.callToAction      ?? "Powered by Opinoor",
    frontInstr1:    d.frontInstruction1 ?? "Approach the phone to the card",
    frontInstr2:    d.frontInstruction2 ?? "Tap to leave a review",
    backInstr1:     d.backInstruction1  ?? null,
    backInstr2:     d.backInstruction2  ?? null,
    showNfcIcon:    d.showNfcIcon  !== false,
    showGoogleIcon: d.showGoogleIcon !== false,
  };
}

// ─────────────────────────────────────────────────────────────
// SVG PRINCIPAL — recto en haut, verso en bas
// ─────────────────────────────────────────────────────────────

function buildCardSheetSvg(r) {
  const {
    cardW, cardH, totalWidth, totalHeight,
    rectoY, versoY,
    bgColor, textColor, accentColor, gradient1, gradient2, accentBand1,
    bandPosition, frontBandH, backBandH,
    bizFont, bizSize, bizWeight, bizTransform,
    sloganFont, sloganSize,
    qrSvgInner, qrSizePx, qrPos,
    logoH,
    businessName, slogan, callToAction,
    frontInstr1, frontInstr2, backInstr1, backInstr2,
    showNfcIcon, showGoogleIcon,
    textColor: tc, starColor, iconsColor,
  } = r;

  // ── RECTO ─────────────────────────────────────────────────
  // Zone logo + nom (gauche) et QR (droite) si qrPos = "left"|"right"
  const qrX = qrPos === "right"
    ? cardW - qrSizePx - 24
    : 24;
  const contentX = qrPos === "right" ? 24 : qrSizePx + 48;
  const contentW = cardW - qrSizePx - 72;

  // Hauteur bande accent
  const bandHpx = Math.round(cardH * (frontBandH / 100));
  const bandY   = bandPosition === "top" ? 0 : cardH - bandHpx;

  // ── VERSO ─────────────────────────────────────────────────
  const backBandHpx = Math.round(cardH * (backBandH / 100));

  // Étoiles décoratives (5 étoiles)
  const starsPath = buildStarsPath(cardW / 2 - 60, cardH / 2 - 12, 5, 12);

  // Instructions (recto)
  const instrY1 = cardH - 60;
  const instrY2 = cardH - 38;

  // NFC icon (verso) — simple cercle + vagues
  const nfcX = cardW / 2;
  const nfcY = cardH / 2;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${totalWidth}" height="${totalHeight}"
     viewBox="0 0 ${totalWidth} ${totalHeight}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${gradient1}"/>
      <stop offset="100%" stop-color="${gradient2}"/>
    </linearGradient>
    <clipPath id="rectoClip">
      <rect x="${MARGIN}" y="${rectoY}" width="${cardW}" height="${cardH}" rx="16"/>
    </clipPath>
    <clipPath id="versoClip">
      <rect x="${MARGIN}" y="${versoY}" width="${cardW}" height="${cardH}" rx="16"/>
    </clipPath>
  </defs>

  <!-- ═══════════════════════════════════════════════════ -->
  <!-- RECTO (face avant) — en HAUT                       -->
  <!-- ═══════════════════════════════════════════════════ -->
  <g clip-path="url(#rectoClip)">
    <!-- Fond gradient -->
    <rect x="${MARGIN}" y="${rectoY}" width="${cardW}" height="${cardH}" fill="url(#bgGrad)" rx="16"/>
    <!-- Bande accent -->
    <rect x="${MARGIN}" y="${rectoY + bandY}" width="${cardW}" height="${bandHpx}" fill="${accentBand1}" opacity="0.9"/>

    <!-- QR Code (intégré depuis QRCode.js) -->
    <g transform="translate(${MARGIN + qrX}, ${rectoY + (cardH - qrSizePx) / 2})" width="${qrSizePx}" height="${qrSizePx}">
      <svg viewBox="0 0 21 21" width="${qrSizePx}" height="${qrSizePx}" preserveAspectRatio="xMidYMid meet">
        ${qrSvgInner}
      </svg>
    </g>

    <!-- Nom du business -->
    <text
      x="${MARGIN + contentX}"
      y="${rectoY + 44}"
      font-family="${bizFont}, sans-serif"
      font-size="${bizSize}"
      font-weight="${bizWeight}"
      fill="${textColor}"
      text-anchor="start"
      text-transform="${bizTransform}"
      dominant-baseline="central"
    >${escXml(businessName)}</text>

    <!-- Slogan -->
    ${slogan ? `<text
      x="${MARGIN + contentX}"
      y="${rectoY + 44 + bizSize + 8}"
      font-family="${sloganFont}, sans-serif"
      font-size="${sloganSize}"
      font-weight="400"
      fill="${textColor}"
      opacity="0.75"
      text-anchor="start"
      dominant-baseline="central"
    >${escXml(slogan)}</text>` : ""}

    <!-- Stars décoratifs -->
    <g transform="translate(${MARGIN + contentX}, ${rectoY + cardH / 2 - 10})">
      ${starsPath}
    </g>

    <!-- Instruction 1 -->
    <text
      x="${MARGIN + contentX}"
      y="${rectoY + instrY1}"
      font-family="${sloganFont}, sans-serif"
      font-size="10"
      fill="${textColor}"
      opacity="0.6"
      text-anchor="start"
    >${escXml(frontInstr1)}</text>

    <!-- Instruction 2 -->
    <text
      x="${MARGIN + contentX}"
      y="${rectoY + instrY2}"
      font-family="${sloganFont}, sans-serif"
      font-size="10"
      fill="${textColor}"
      opacity="0.6"
      text-anchor="start"
    >${escXml(frontInstr2)}</text>

    <!-- Google icon (si activé) -->
    ${showGoogleIcon ? buildGoogleIcon(MARGIN + cardW - 36, rectoY + 20, 16) : ""}
  </g>

  <!-- Label RECTO -->
  <text x="${MARGIN}" y="${rectoY - 8}" font-family="sans-serif" font-size="11" fill="#888" text-anchor="start">RECTO</text>

  <!-- ═══════════════════════════════════════════════════ -->
  <!-- VERSO (face arrière) — en BAS                      -->
  <!-- ═══════════════════════════════════════════════════ -->
  <g clip-path="url(#versoClip)">
    <!-- Fond -->
    <rect x="${MARGIN}" y="${versoY}" width="${cardW}" height="${cardH}" fill="url(#bgGrad)" rx="16"/>
    <!-- Bande accent verso (plus fine) -->
    <rect x="${MARGIN}" y="${versoY}" width="${cardW}" height="${backBandHpx}" fill="${accentBand1}" opacity="0.7"/>

    <!-- NFC icon centré (si activé) -->
    ${showNfcIcon ? buildNfcIcon(MARGIN + cardW / 2, versoY + cardH / 2 - 20, 40, accentColor) : ""}

    <!-- Instructions verso -->
    ${backInstr1 ? `<text
      x="${MARGIN + cardW / 2}"
      y="${versoY + cardH - 48}"
      font-family="${sloganFont}, sans-serif"
      font-size="10"
      fill="${textColor}"
      opacity="0.6"
      text-anchor="middle"
    >${escXml(backInstr1)}</text>` : ""}

    ${backInstr2 ? `<text
      x="${MARGIN + cardW / 2}"
      y="${versoY + cardH - 28}"
      font-family="${sloganFont}, sans-serif"
      font-size="10"
      fill="${textColor}"
      opacity="0.6"
      text-anchor="middle"
    >${escXml(backInstr2)}</text>` : ""}

    <!-- CTA -->
    <text
      x="${MARGIN + cardW / 2}"
      y="${versoY + cardH - 10}"
      font-family="${sloganFont}, sans-serif"
      font-size="8"
      fill="${textColor}"
      opacity="0.4"
      text-anchor="middle"
    >${escXml(callToAction)}</text>
  </g>

  <!-- Label VERSO -->
  <text x="${MARGIN}" y="${versoY - 8}" font-family="sans-serif" font-size="11" fill="#888" text-anchor="start">VERSO</text>

  <!-- Ligne de séparation entre recto et verso -->
  <line
    x1="${MARGIN}" y1="${rectoY + cardH + GAP_PX / 2}"
    x2="${MARGIN + cardW}" y2="${rectoY + cardH + GAP_PX / 2}"
    stroke="#555" stroke-width="0.5" stroke-dasharray="4 4" opacity="0.4"
  />
</svg>`;
}

// ─────────────────────────────────────────────────────────────
// SVG → PNG via sharp
// ─────────────────────────────────────────────────────────────

async function svgToPng(svgContent, outputPath, width, height) {
  try {
    const sharp = (await import("sharp")).default;
    await sharp(Buffer.from(svgContent))
      .resize(width, height)
      .png({ quality: 100 })
      .toFile(outputPath);
  } catch (e) {
    console.error("[cardExport] sharp error:", e.message);
    // Fallback — sauvegarder le SVG converti en placeholder PNG
    await fs.writeFile(outputPath.replace(".png", "-placeholder.svg"), svgContent);
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────
// PDF — A4, recto centré en haut / verso centré en bas
// ─────────────────────────────────────────────────────────────
// Dimensions A4 en points : 595 × 842 pt
// Carte CR80 en points : 242.6 × 153 pt
// Recto : centré horizontalement, y = 80pt
// Verso : centré horizontalement, y = 450pt

async function buildCardPdf(card, design, qrSvgInner, outputPath) {
  const PAGE_W = 595;
  const PAGE_H = 842;
  const CARD_W = CARD.W_PT;   // 242.6
  const CARD_H = CARD.H_PT;   // 153
  const CARD_X = (PAGE_W - CARD_W) / 2;  // centré
  const RECTO_Y = 80;
  const VERSO_Y = 460;

  // Générer PNG des deux faces séparément pour les encapsuler dans le PDF
  // en utilisant sharp pour rasteriser le SVG de chaque face

  const rectoSvg = buildSingleFaceSvg("recto", card, design, qrSvgInner, CARD_W, CARD_H);
  const versoSvg = buildSingleFaceSvg("verso", card, design, qrSvgInner, CARD_W, CARD_H);

  const sharp = (await import("sharp")).default;

  // Rasteriser recto → PNG buffer
  const rectoBuffer = await sharp(Buffer.from(rectoSvg))
    .resize(Math.round(CARD_W * 3), Math.round(CARD_H * 3))  // 3× pour qualité
    .png()
    .toBuffer();

  // Rasteriser verso → PNG buffer
  const versoBuffer = await sharp(Buffer.from(versoSvg))
    .resize(Math.round(CARD_W * 3), Math.round(CARD_H * 3))
    .png()
    .toBuffer();

  // Construire le PDF avec les deux images
  const pdfBuffer = buildPdfWithTwoImages({
    pageW:    PAGE_W,
    pageH:    PAGE_H,
    rectoImg: rectoBuffer,
    rectoX:   CARD_X,
    rectoY:   RECTO_Y,
    rectoW:   CARD_W,
    rectoH:   CARD_H,
    versoImg: versoBuffer,
    versoX:   CARD_X,
    versoY:   VERSO_Y,
    versoW:   CARD_W,
    versoH:   CARD_H,
  });

  await fs.writeFile(outputPath, pdfBuffer);
}

// ─────────────────────────────────────────────────────────────
// SVG d'une seule face (pour le PDF)
// ─────────────────────────────────────────────────────────────

function buildSingleFaceSvg(face, card, design, qrSvgInner, W, H) {
  const r = buildRenderData(card, design, qrSvgInner);
  // Utiliser les dimensions de la carte en points (pour PDF)
  const scaleX = W / r.cardW;
  const scaleY = H / r.cardH;

  if (face === "recto") {
    const bandHpx  = Math.round(r.cardH * (r.frontBandH / 100));
    const bandY    = r.bandPosition === "top" ? 0 : r.cardH - bandHpx;
    const qrX      = r.qrPos === "right" ? r.cardW - r.qrSizePx - 24 : 24;
    const contentX = r.qrPos === "right" ? 24 : r.qrSizePx + 48;

    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
      width="${W}" height="${H}" viewBox="0 0 ${r.cardW} ${r.cardH}">
      <defs>
        <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${r.gradient1}"/>
          <stop offset="100%" stop-color="${r.gradient2}"/>
        </linearGradient>
        <clipPath id="cc"><rect width="${r.cardW}" height="${r.cardH}" rx="12"/></clipPath>
      </defs>
      <g clip-path="url(#cc)">
        <rect width="${r.cardW}" height="${r.cardH}" fill="url(#g1)"/>
        <rect y="${bandY}" width="${r.cardW}" height="${bandHpx}" fill="${r.accentBand1}" opacity="0.9"/>
        <g transform="translate(${qrX},${(r.cardH - r.qrSizePx) / 2})">
          <svg viewBox="0 0 21 21" width="${r.qrSizePx}" height="${r.qrSizePx}">
            ${qrSvgInner}
          </svg>
        </g>
        <text x="${contentX}" y="44" font-family="${r.bizFont}, sans-serif"
          font-size="${r.bizSize}" font-weight="${r.bizWeight}"
          fill="${r.textColor}" dominant-baseline="central"
        >${escXml(r.businessName)}</text>
        ${r.slogan ? `<text x="${contentX}" y="${44 + r.bizSize + 8}"
          font-family="${r.sloganFont}, sans-serif" font-size="${r.sloganSize}"
          fill="${r.textColor}" opacity="0.75" dominant-baseline="central"
        >${escXml(r.slogan)}</text>` : ""}
        <text x="${contentX}" y="${r.cardH - 60}" font-family="sans-serif" font-size="10"
          fill="${r.textColor}" opacity="0.6">${escXml(r.frontInstr1)}</text>
        <text x="${contentX}" y="${r.cardH - 38}" font-family="sans-serif" font-size="10"
          fill="${r.textColor}" opacity="0.6">${escXml(r.frontInstr2)}</text>
      </g>
    </svg>`;
  }

  // Verso
  const backBandHpx = Math.round(r.cardH * (r.backBandH / 100));
  return `<svg xmlns="http://www.w3.org/2000/svg"
    width="${W}" height="${H}" viewBox="0 0 ${r.cardW} ${r.cardH}">
    <defs>
      <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${r.gradient1}"/>
        <stop offset="100%" stop-color="${r.gradient2}"/>
      </linearGradient>
      <clipPath id="cv"><rect width="${r.cardW}" height="${r.cardH}" rx="12"/></clipPath>
    </defs>
    <g clip-path="url(#cv)">
      <rect width="${r.cardW}" height="${r.cardH}" fill="url(#g2)"/>
      <rect width="${r.cardW}" height="${backBandHpx}" fill="${r.accentBand1}" opacity="0.7"/>
      ${r.showNfcIcon ? buildNfcIcon(r.cardW / 2, r.cardH / 2 - 20, 40, r.accentColor) : ""}
      ${r.backInstr1 ? `<text x="${r.cardW / 2}" y="${r.cardH - 48}" font-family="sans-serif" font-size="10"
        fill="${r.textColor}" opacity="0.6" text-anchor="middle">${escXml(r.backInstr1)}</text>` : ""}
      ${r.backInstr2 ? `<text x="${r.cardW / 2}" y="${r.cardH - 28}" font-family="sans-serif" font-size="10"
        fill="${r.textColor}" opacity="0.6" text-anchor="middle">${escXml(r.backInstr2)}</text>` : ""}
      <text x="${r.cardW / 2}" y="${r.cardH - 10}" font-family="sans-serif" font-size="8"
        fill="${r.textColor}" opacity="0.4" text-anchor="middle">${escXml(r.callToAction)}</text>
    </g>
  </svg>`;
}

// ─────────────────────────────────────────────────────────────
// PDF builder — 2 images PNG sur une page A4
// ─────────────────────────────────────────────────────────────

function buildPdfWithTwoImages({ pageW, pageH, rectoImg, rectoX, rectoY, rectoW, rectoH, versoImg, versoX, versoY, versoW, versoH }) {
  const header    = Buffer.from(`%PDF-1.4\n%\xe2\xe3\xcf\xd3\n`);

  // Objets PDF
  const xRefTable = [];
  const objects   = [];
  let   bytePos   = header.length;

  const pushObj = (content) => {
    xRefTable.push(bytePos);
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(content);
    objects.push(buf);
    bytePos += buf.length;
  };

  // Obj 1 — Catalog
  pushObj(`1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n`);
  // Obj 2 — Pages
  pushObj(`2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n`);
  // Obj 3 — Page
  pushObj(`3 0 obj\n<</Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources <</XObject <</Recto 5 0 R /Verso 6 0 R>>>>>>\nendobj\n`);

  // Obj 4 — Content stream
  const stream = [
    `q`,
    `${rectoW} 0 0 ${rectoH} ${rectoX} ${pageH - rectoY - rectoH} cm /Recto Do`,
    `Q`,
    `q`,
    `${versoW} 0 0 ${versoH} ${versoX} ${pageH - versoY - versoH} cm /Verso Do`,
    `Q`,
  ].join("\n");
  const streamBuf = Buffer.from(stream);
  pushObj(`4 0 obj\n<</Length ${streamBuf.length}>>\nstream\n`);
  objects.push(streamBuf);
  xRefTable[3] += 0; // déjà compté
  bytePos += streamBuf.length;
  const endStream = Buffer.from(`\nendstream\nendobj\n`);
  objects.push(endStream);
  bytePos += endStream.length;

  // Obj 5 — Recto image
  pushObj(`5 0 obj\n<</Type /XObject /Subtype /Image /Width ${Math.round(rectoW * 3)} /Height ${Math.round(rectoH * 3)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${rectoImg.length}>>\nstream\n`);
  objects.push(rectoImg);
  bytePos += rectoImg.length;
  const endRecto = Buffer.from(`\nendstream\nendobj\n`);
  objects.push(endRecto);
  bytePos += endRecto.length;

  // Obj 6 — Verso image
  pushObj(`6 0 obj\n<</Type /XObject /Subtype /Image /Width ${Math.round(versoW * 3)} /Height ${Math.round(versoH * 3)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${versoImg.length}>>\nstream\n`);
  objects.push(versoImg);
  bytePos += versoImg.length;
  const endVerso = Buffer.from(`\nendstream\nendobj\n`);
  objects.push(endVerso);
  bytePos += endVerso.length;

  // XRef + Trailer
  const xrefOffset = bytePos;
  let xref = `xref\n0 7\n0000000000 65535 f \n`;
  xRefTable.forEach((pos) => {
    xref += `${String(pos).padStart(10, "0")} 00000 n \n`;
  });
  xref += `trailer\n<</Size 7 /Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.concat([header, ...objects, Buffer.from(xref)]);
}

// ─────────────────────────────────────────────────────────────
// HELPERS SVG
// ─────────────────────────────────────────────────────────────

function buildStarsPath(x, y, count, size) {
  let stars = "";
  for (let i = 0; i < count; i++) {
    const cx = x + i * (size + 4);
    const cy = y;
    stars += `<polygon points="${starPoints(cx, cy, size / 2, size / 4, 5)}"
      fill="#F59E0B" opacity="0.85"/>`;
  }
  return stars;
}

function starPoints(cx, cy, outerR, innerR, numPoints) {
  const pts = [];
  for (let i = 0; i < numPoints * 2; i++) {
    const angle  = (i * Math.PI) / numPoints - Math.PI / 2;
    const radius = i % 2 === 0 ? outerR : innerR;
    pts.push(`${(cx + Math.cos(angle) * radius).toFixed(1)},${(cy + Math.sin(angle) * radius).toFixed(1)}`);
  }
  return pts.join(" ");
}

function buildNfcIcon(cx, cy, r, color) {
  // Cercle central + 3 arcs concentriques (style NFC)
  return `
    <circle cx="${cx}" cy="${cy}" r="${r * 0.25}" fill="${color}" opacity="0.9"/>
    <path d="M${cx - r * 0.5} ${cy} A${r * 0.5} ${r * 0.5} 0 0 1 ${cx + r * 0.5} ${cy}"
      fill="none" stroke="${color}" stroke-width="2" opacity="0.7"/>
    <path d="M${cx - r * 0.75} ${cy} A${r * 0.75} ${r * 0.75} 0 0 1 ${cx + r * 0.75} ${cy}"
      fill="none" stroke="${color}" stroke-width="1.5" opacity="0.5"/>
    <path d="M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}"
      fill="none" stroke="${color}" stroke-width="1" opacity="0.3"/>`;
}

function buildGoogleIcon(x, y, size) {
  const s = size;
  return `<g transform="translate(${x}, ${y})">
    <text font-family="sans-serif" font-size="${s}" fill="#FFFFFF" opacity="0.7">G</text>
  </g>`;
}

function escXml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Supprimer les fichiers d'une carte (nettoyage)
export async function deleteCardExportFiles(uid) {
  for (const ext of ["svg", "png", "pdf"]) {
    await fs.unlink(path.join(EXPORT_DIR, `${uid}.${ext}`)).catch(() => {});
  }
}

// Dériver les URLs depuis le SVG (même logique que qrcode.service.js)
export function deriveCardUrls(svgUrl) {
  if (!svgUrl) return { svgUrl: null, pngUrl: null, pdfUrl: null };
  const base = svgUrl.replace(/\.svg$/, "");
  return { svgUrl, pngUrl: `${base}.png`, pdfUrl: `${base}.pdf` };
}