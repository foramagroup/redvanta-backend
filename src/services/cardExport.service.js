// src/services/cardExport.service.js
// ─────────────────────────────────────────────────────────────
// Génération des fichiers d'impression des cartes NFC
//
// ⚠️  CHEMIN : process.cwd() — compatible Windows/XAMPP
//     __dirname + ESM + Windows = résolution instable → NE PAS utiliser
//
// Fichiers produits :
//   public/uploads/cards/{uid}.svg  → vectoriel, impression HD
//   public/uploads/cards/{uid}.png  → 300 DPI via sharp (ou placeholder si sharp absent)
//   public/uploads/cards/{uid}.pdf  → PDF A4, recto/verso, pur Node.js (pas de dépendance)
//
// Format carte PVC CR80 : 85.6mm × 54mm
// ─────────────────────────────────────────────────────────────

import fs   from "fs";        // sync (existsSync, createReadStream)
import fsP  from "fs/promises"; // async (mkdir, writeFile, unlink)
import path from "path";
import QRCode from "qrcode";

// ── Chemin absolu résolu depuis la racine du process ─────────
// process.cwd() = C:\xampp\htdocs\x\backend  sur Windows/XAMPP
// __dirname en ESM sur Windows peut pointer vers un mauvais chemin
const EXPORT_DIR = path.join(process.cwd(), "public", "uploads", "cards");

// ── Dimensions carte CR80 ─────────────────────────────────────
const W_PX = 1011;   // 85.6mm @ 300 DPI
const H_PX =  638;   // 54mm   @ 300 DPI
const W_PT =  243;   // points PDF (72pt/inch)
const H_PT =  153;

const GAP    = 60;   // espace entre recto et verso dans le SVG global
const MARGIN = 20;   // marge extérieure du SVG global

// ─────────────────────────────────────────────────────────────
// EXPORT PRINCIPAL — appelé depuis nfcCards.superadmin.controller.js
// ─────────────────────────────────────────────────────────────

export async function generateCardExport(card, design) {

  // ── 0. Vérifications préalables ─────────────────────────────
  if (!card?.payload) {
    throw new Error(`[cardExport] NFCCard uid=${card?.uid} n'a pas de payload`);
  }

  // ── 1. Créer le dossier de sortie ───────────────────────────
  await fsP.mkdir(EXPORT_DIR, { recursive: true });
  console.log(`[cardExport] EXPORT_DIR = ${EXPORT_DIR}`);
  console.log(`[cardExport] Génération uid=${card.uid}`);

  // ── 2. QR Code inner SVG (contenu, sans les balises <svg> racines) ─
  const qrInner = await buildQrInner(card.payload, design);

  // ── 3. Données de rendu (couleurs, textes, dimensions) ──────
  const r = buildRenderData(card, design, qrInner);

  // ── 4. SVG global (recto en haut / verso en bas) ────────────
  const svgContent = buildSheetSvg(r);
  const svgPath    = path.join(EXPORT_DIR, `${card.uid}.svg`);
  await fsP.writeFile(svgPath, svgContent, "utf-8");
  console.log(`[cardExport] ✅ SVG écrit  → ${svgPath}`);

  // ── 5. PNG via sharp (fallback si sharp absent sur Windows) ─
  const pngPath = path.join(EXPORT_DIR, `${card.uid}.png`);
  await writePng(svgContent, pngPath, r.totalW, r.totalH);

  // ── 6. PDF pur Node.js (aucune dépendance) ──────────────────
  const pdfPath = path.join(EXPORT_DIR, `${card.uid}.pdf`);
  await writePdf(r, pdfPath);

  // ── 7. Retourner les URLs publiques ─────────────────────────
  const base = (process.env.APP_URL ?? process.env.FRONTEND_URL ?? "http://localhost:4000").replace(/\/$/, "");
  return {
    svgUrl: `${base}/uploads/cards/${card.uid}.svg`,
    pngUrl: `${base}/uploads/cards/${card.uid}.png`,
    pdfUrl: `${base}/uploads/cards/${card.uid}.pdf`,
  };
}

// ─────────────────────────────────────────────────────────────
// QR CODE — inner SVG (modules uniquement, sans balise <svg> racine)
// ─────────────────────────────────────────────────────────────

async function buildQrInner(payload, design) {
  const dark  = design?.accentColor ?? "#000000";
  const light = design?.bgColor     ?? "#FFFFFF";
  const svgStr = await QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 1,
    color: { dark, light },
  });
  // Extraire le contenu intérieur de <svg>…</svg>
  const m = svgStr.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  return m ? m[1] : svgStr;
}

// ─────────────────────────────────────────────────────────────
// DONNÉES DE RENDU — lit tous les champs du modèle Design Prisma
// ─────────────────────────────────────────────────────────────

function buildRenderData(card, design, qrInner) {
  const d = design ?? {};

  const isPortrait = d.orientation === "portrait";
  const cardW      = isPortrait ? H_PX : W_PX;
  const cardH      = isPortrait ? W_PX : H_PX;
  const qrPct      = d.qrCodeSize    ?? 60;           // % hauteur carte
  const qrSz       = Math.round(cardH * qrPct / 100);
  const qrPos      = d.qrCodeStyle   ?? "left";       // left | right

  return {
    card, uid: card.uid,
    // Dimensions
    cardW, cardH,
    totalW: cardW + MARGIN * 2,
    totalH: cardH * 2 + GAP + MARGIN * 2,
    rectoY: MARGIN,
    versoY: MARGIN + cardH + GAP,
    // QR
    qrInner, qrSz, qrPos,
    qrX:      qrPos === "right" ? cardW - qrSz - 24 : 24,
    contentX: qrPos === "right" ? 24 : qrSz + 48,
    // Couleurs
    bg:        d.bgColor       ?? "#0B0D0F",
    text:      d.textColor     ?? "#FFFFFF",
    accent:    d.accentColor   ?? "#E10600",
    grad1:     d.gradient1     ?? d.bgColor     ?? "#0B0D0F",
    grad2:     d.gradient2     ?? "#1A1A1A",
    band:      d.accentBand1   ?? d.accentColor  ?? "#E10600",
    bandPos:   d.bandPosition  ?? "bottom",
    frontBandH: d.frontBandHeight ?? 22,   // % hauteur
    backBandH:  d.backBandHeight  ?? 12,
    // Typographie
    bizFont:   esc(d.businessFont       ?? "Arial"),
    bizSize:   d.businessFontSize       ?? 16,
    bizWeight: d.businessFontWeight     ?? "700",
    sloFont:   esc(d.sloganFont         ?? "Arial"),
    sloSize:   d.sloganFontSize         ?? 11,
    // Textes
    biz:       esc(d.businessName       ?? card.locationName ?? "Business"),
    slogan:    d.slogan   ? esc(d.slogan)   : null,
    cta:       esc(d.callToAction       ?? "Powered by Opinoor"),
    fi1:       esc(d.frontInstruction1  ?? "Approchez votre téléphone"),
    fi2:       esc(d.frontInstruction2  ?? "Appuyez pour laisser un avis"),
    bi1:       d.backInstruction1 ? esc(d.backInstruction1) : null,
    bi2:       d.backInstruction2 ? esc(d.backInstruction2) : null,
    nfcIcon:   d.showNfcIcon    !== false,
    gIcon:     d.showGoogleIcon !== false,
  };
}

// ─────────────────────────────────────────────────────────────
// SVG GLOBAL — RECTO (haut) + VERSO (bas)
// ─────────────────────────────────────────────────────────────

function buildSheetSvg(r) {
  const {
    cardW, cardH, totalW, totalH, rectoY, versoY,
    bg, text, accent, grad1, grad2, band, bandPos, frontBandH, backBandH,
    bizFont, bizSize, bizWeight, sloFont, sloSize,
    qrInner, qrSz, qrX, contentX,
    biz, slogan, cta, fi1, fi2, bi1, bi2, nfcIcon, gIcon,
  } = r;

  const fBandH = Math.round(cardH * frontBandH / 100);
  const fBandY = bandPos === "top" ? 0 : cardH - fBandH;
  const bBandH = Math.round(cardH * backBandH  / 100);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
<defs>
  <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%"   stop-color="${grad1}"/>
    <stop offset="100%" stop-color="${grad2}"/>
  </linearGradient>
  <clipPath id="rc"><rect x="${MARGIN}" y="${rectoY}" width="${cardW}" height="${cardH}" rx="16"/></clipPath>
  <clipPath id="vc"><rect x="${MARGIN}" y="${versoY}" width="${cardW}" height="${cardH}" rx="16"/></clipPath>
</defs>

<!-- ═══ LABEL RECTO ═══ -->
<text x="${MARGIN}" y="${rectoY - 8}" font-family="Arial,sans-serif" font-size="11" fill="#777">RECTO</text>

<!-- ═══ RECTO ═══ -->
<g clip-path="url(#rc)">
  <rect x="${MARGIN}" y="${rectoY}" width="${cardW}" height="${cardH}" fill="url(#bg)"/>
  <rect x="${MARGIN}" y="${rectoY + fBandY}" width="${cardW}" height="${fBandH}" fill="${band}" opacity="0.9"/>

  <!-- QR Code -->
  <g transform="translate(${MARGIN + qrX},${rectoY + (cardH - qrSz) / 2})">
    <svg viewBox="0 0 21 21" width="${qrSz}" height="${qrSz}" preserveAspectRatio="xMidYMid meet">
      ${qrInner}
    </svg>
  </g>

  <!-- Nom business -->
  <text x="${MARGIN + contentX}" y="${rectoY + 44}"
    font-family="${bizFont},Arial,sans-serif" font-size="${bizSize}" font-weight="${bizWeight}"
    fill="${text}" dominant-baseline="central">${biz}</text>

  ${slogan ? `<text x="${MARGIN + contentX}" y="${rectoY + 44 + bizSize + 10}"
    font-family="${sloFont},Arial,sans-serif" font-size="${sloSize}"
    fill="${text}" opacity="0.72" dominant-baseline="central">${slogan}</text>` : ""}

  <!-- Étoiles décoratives -->
  ${stars(MARGIN + contentX, rectoY + cardH / 2 - 8, 5, 10)}

  <!-- Instructions -->
  <text x="${MARGIN + contentX}" y="${rectoY + cardH - 52}"
    font-family="Arial,sans-serif" font-size="9" fill="${text}" opacity="0.58">${fi1}</text>
  <text x="${MARGIN + contentX}" y="${rectoY + cardH - 35}"
    font-family="Arial,sans-serif" font-size="9" fill="${text}" opacity="0.58">${fi2}</text>

  ${gIcon ? googleG(MARGIN + cardW - 32, rectoY + 18, 14) : ""}
</g>

<!-- Séparateur pointillé -->
<line x1="${MARGIN}" y1="${rectoY + cardH + GAP / 2}"
      x2="${MARGIN + cardW}" y2="${rectoY + cardH + GAP / 2}"
      stroke="#555" stroke-width="0.5" stroke-dasharray="5 4" opacity="0.35"/>

<!-- ═══ LABEL VERSO ═══ -->
<text x="${MARGIN}" y="${versoY - 8}" font-family="Arial,sans-serif" font-size="11" fill="#777">VERSO</text>

<!-- ═══ VERSO ═══ -->
<g clip-path="url(#vc)">
  <rect x="${MARGIN}" y="${versoY}" width="${cardW}" height="${cardH}" fill="url(#bg)"/>
  <rect x="${MARGIN}" y="${versoY}" width="${cardW}" height="${bBandH}" fill="${band}" opacity="0.7"/>

  ${nfcIcon ? nfc(MARGIN + cardW / 2, versoY + cardH / 2 - 14, 34, accent) : ""}

  ${bi1 ? `<text x="${MARGIN + cardW / 2}" y="${versoY + cardH - 44}"
    font-family="Arial,sans-serif" font-size="9" fill="${text}" opacity="0.58"
    text-anchor="middle">${bi1}</text>` : ""}
  ${bi2 ? `<text x="${MARGIN + cardW / 2}" y="${versoY + cardH - 27}"
    font-family="Arial,sans-serif" font-size="9" fill="${text}" opacity="0.58"
    text-anchor="middle">${bi2}</text>` : ""}

  <text x="${MARGIN + cardW / 2}" y="${versoY + cardH - 10}"
    font-family="Arial,sans-serif" font-size="8" fill="${text}" opacity="0.32"
    text-anchor="middle">${cta}</text>
</g>
</svg>`;
}

// ─────────────────────────────────────────────────────────────
// PNG — via sharp avec fallback PNG minimal valide
// ─────────────────────────────────────────────────────────────

async function writePng(svgContent, outPath, w, h) {
  try {
    const sharp = (await import("sharp")).default;
    await sharp(Buffer.from(svgContent))
      .resize(w, h)
      .png({ compressionLevel: 6 })
      .toFile(outPath);
    console.log(`[cardExport] ✅ PNG (sharp) → ${outPath}`);
  } catch (e) {
    console.warn(`[cardExport] ⚠️  sharp échoue (${e.message}) — PNG placeholder`);
    // PNG 1×1 transparent valide — au moins le fichier existe
    const placeholder = Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489000000" +
      "0a49444154789c6260000000000200e221bc330000000049454e44ae426082",
      "hex"
    );
    await fsP.writeFile(outPath, placeholder);
    console.warn(`[cardExport] ⚠️  PNG placeholder écrit — installez sharp pour la vraie image`);
  }
}

// ─────────────────────────────────────────────────────────────
// PDF — pur Node.js, aucune dépendance
// A4 (595×842 pt) : recto centré en haut, verso centré en bas
// Deux cas :
//   A) sharp disponible → images JPEG embarquées (qualité maximale)
//   B) sharp absent     → rectangles colorés + texte (lisible, imprimable)
// ─────────────────────────────────────────────────────────────

async function writePdf(r, outPath) {
  const PAGE_W = 595, PAGE_H = 842;
  const CX     = (PAGE_W - W_PT) / 2;
  const RY     = 90;   // Y recto (depuis le haut de la page)
  const VY     = 470;  // Y verso

  // Essayer avec sharp pour des images JPEG dans le PDF
  try {
    const sharp = (await import("sharp")).default;

    const rectoSvg = buildFaceSvg("recto", r);
    const versoSvg = buildFaceSvg("verso",  r);

    const [rectoJpeg, versoJpeg] = await Promise.all([
      sharp(Buffer.from(rectoSvg)).resize(Math.round(W_PT * 4), Math.round(H_PT * 4)).jpeg({ quality: 92 }).toBuffer(),
      sharp(Buffer.from(versoSvg)).resize(Math.round(W_PT * 4), Math.round(H_PT * 4)).jpeg({ quality: 92 }).toBuffer(),
    ]);

    const pdfBuf = pdfWithImages(PAGE_W, PAGE_H, CX, RY, VY, W_PT, H_PT, rectoJpeg, versoJpeg);
    await fsP.writeFile(outPath, pdfBuf);
    console.log(`[cardExport] ✅ PDF (images JPEG) → ${outPath}`);
    return;
  } catch (e) {
    console.warn(`[cardExport] ⚠️  sharp absent pour PDF (${e.message}) — PDF vectoriel`);
  }

  // Fallback PDF vectoriel pur — toujours fonctionnel
  const pdfBuf = pdfVectorial(PAGE_W, PAGE_H, CX, RY, VY, W_PT, H_PT, r);
  await fsP.writeFile(outPath, pdfBuf);
  console.log(`[cardExport] ✅ PDF (vectoriel fallback) → ${outPath}`);
}

// ─────────────────────────────────────────────────────────────
// SVG d'une seule face (pour rasterisation PDF)
// ─────────────────────────────────────────────────────────────

function buildFaceSvg(face, r) {
  const { cardW, cardH, bg, text, accent, grad1, grad2, band, bandPos,
          frontBandH, backBandH, bizFont, bizSize, bizWeight, sloFont, sloSize,
          qrInner, qrSz, qrX, contentX,
          biz, slogan, fi1, fi2, bi1, bi2, nfcIcon, cta } = r;

  if (face === "recto") {
    const fh = Math.round(cardH * frontBandH / 100);
    const fy = bandPos === "top" ? 0 : cardH - fh;
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
      viewBox="0 0 ${cardW} ${cardH}" width="${cardW}" height="${cardH}">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${grad1}"/>
          <stop offset="100%" stop-color="${grad2}"/>
        </linearGradient>
        <clipPath id="cc"><rect width="${cardW}" height="${cardH}" rx="12"/></clipPath>
      </defs>
      <g clip-path="url(#cc)">
        <rect width="${cardW}" height="${cardH}" fill="url(#g)"/>
        <rect y="${fy}" width="${cardW}" height="${fh}" fill="${band}" opacity="0.9"/>
        <g transform="translate(${qrX},${(cardH - qrSz) / 2})">
          <svg viewBox="0 0 21 21" width="${qrSz}" height="${qrSz}">${qrInner}</svg>
        </g>
        <text x="${contentX}" y="44" font-family="${bizFont},Arial,sans-serif"
          font-size="${bizSize}" font-weight="${bizWeight}"
          fill="${text}" dominant-baseline="central">${biz}</text>
        ${slogan ? `<text x="${contentX}" y="${44 + bizSize + 10}"
          font-family="${sloFont},Arial,sans-serif" font-size="${sloSize}"
          fill="${text}" opacity="0.72" dominant-baseline="central">${slogan}</text>` : ""}
        ${stars(contentX, cardH / 2 - 8, 5, 10)}
        <text x="${contentX}" y="${cardH - 52}" font-family="Arial,sans-serif"
          font-size="9" fill="${text}" opacity="0.58">${fi1}</text>
        <text x="${contentX}" y="${cardH - 35}" font-family="Arial,sans-serif"
          font-size="9" fill="${text}" opacity="0.58">${fi2}</text>
      </g>
    </svg>`;
  }

  // VERSO
  const bh = Math.round(cardH * backBandH / 100);
  return `<svg xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 ${cardW} ${cardH}" width="${cardW}" height="${cardH}">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${grad1}"/>
        <stop offset="100%" stop-color="${grad2}"/>
      </linearGradient>
      <clipPath id="cc"><rect width="${cardW}" height="${cardH}" rx="12"/></clipPath>
    </defs>
    <g clip-path="url(#cc)">
      <rect width="${cardW}" height="${cardH}" fill="url(#g)"/>
      <rect width="${cardW}" height="${bh}" fill="${band}" opacity="0.7"/>
      ${nfcIcon ? nfc(cardW / 2, cardH / 2 - 14, 34, accent) : ""}
      ${bi1 ? `<text x="${cardW / 2}" y="${cardH - 44}" font-family="Arial,sans-serif"
        font-size="9" fill="${text}" opacity="0.58" text-anchor="middle">${bi1}</text>` : ""}
      ${bi2 ? `<text x="${cardW / 2}" y="${cardH - 27}" font-family="Arial,sans-serif"
        font-size="9" fill="${text}" opacity="0.58" text-anchor="middle">${bi2}</text>` : ""}
      <text x="${cardW / 2}" y="${cardH - 10}" font-family="Arial,sans-serif"
        font-size="8" fill="${text}" opacity="0.32" text-anchor="middle">${cta}</text>
    </g>
  </svg>`;
}

// ─────────────────────────────────────────────────────────────
// PDF avec images JPEG (quand sharp est disponible)
// Structure PDF/1.4 minimale, 6 objets
// ─────────────────────────────────────────────────────────────

function pdfWithImages(PW, PH, cx, ry, vy, cw, ch, rectoJpeg, versoJpeg) {
  const parts  = [];
  const xrefs  = [];
  let   offset = 0;

  function add(s) {
    const b = Buffer.isBuffer(s) ? s : Buffer.from(s, "binary");
    xrefs.push(offset);
    parts.push(b);
    offset += b.length;
  }
  function raw(b) {
    // ajouter sans enregistrer dans xrefs (données inline d'un objet déjà ouvert)
    parts.push(b);
    offset += b.length;
  }

  const hdr = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  parts.push(Buffer.from(hdr, "binary"));
  offset = hdr.length;

  add(`1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n`);
  add(`2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n`);
  add(`3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${PW} ${PH}]/Contents 4 0 R/Resources<</XObject<</R 5 0 R/V 6 0 R>>>>>>\nendobj\n`);

  // Stream de contenu : placer les images
  // PDF Y=0 est en bas → on convertit depuis le haut
  const rY = (PH - ry - ch).toFixed(2);
  const vY = (PH - vy - ch).toFixed(2);
  const stream = `q ${cw.toFixed(2)} 0 0 ${ch.toFixed(2)} ${cx.toFixed(2)} ${rY} cm /R Do Q\nq ${cw.toFixed(2)} 0 0 ${ch.toFixed(2)} ${cx.toFixed(2)} ${vY} cm /V Do Q`;
  const sb     = Buffer.from(stream);
  add(`4 0 obj\n<</Length ${sb.length}>>\nstream\n`);
  raw(sb);
  raw(Buffer.from("\nendstream\nendobj\n"));

  const rW = Math.round(cw * 4), rH = Math.round(ch * 4);
  add(`5 0 obj\n<</Type/XObject/Subtype/Image/Width ${rW}/Height ${rH}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${rectoJpeg.length}>>\nstream\n`);
  raw(rectoJpeg);
  raw(Buffer.from("\nendstream\nendobj\n"));

  add(`6 0 obj\n<</Type/XObject/Subtype/Image/Width ${rW}/Height ${rH}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${versoJpeg.length}>>\nstream\n`);
  raw(versoJpeg);
  raw(Buffer.from("\nendstream\nendobj\n"));

  const xrefOffset = offset;
  // Les 3 premiers xrefs correspondent aux objets 1,2,3
  // Les 3 suivants à 4,5,6 (add() les a enregistrés)
  let xrefTable = `xref\n0 7\n0000000000 65535 f \n`;
  xrefs.forEach(x => { xrefTable += `${String(x).padStart(10, "0")} 00000 n \n`; });
  xrefTable += `trailer\n<</Size 7/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.concat([...parts, Buffer.from(xrefTable)]);
}

// ─────────────────────────────────────────────────────────────
// PDF vectoriel fallback — rectangles colorés + texte PDF natif
// Toujours fonctionnel même sans sharp
// Résultat : PDF lisible et imprimable, sans image rasterisée
// ─────────────────────────────────────────────────────────────

function pdfVectorial(PW, PH, cx, ry, vy, cw, ch, r) {
  // hex #RRGGBB → "R G B" (0.0–1.0)
  function rgb(hex) {
    const h = (hex ?? "#000000").replace("#", "");
    return [
      (parseInt(h.slice(0,2),16)/255).toFixed(3),
      (parseInt(h.slice(2,4),16)/255).toFixed(3),
      (parseInt(h.slice(4,6),16)/255).toFixed(3),
    ].join(" ");
  }

  const bgRgb     = rgb(r.grad1);
  const accentRgb = rgb(r.band);
  const textRgb   = rgb(r.text);

  // Y PDF (bas=0) depuis Y haut-de-page
  const rY     = PH - ry - ch;
  const vY     = PH - vy - ch;
  const fBandH = ch * r.frontBandH / 100;
  const bBandH = ch * r.backBandH  / 100;
  const fBandY = r.bandPos === "top" ? rY + ch - fBandH : rY;

  // Texte PDF (encodage Latin-1 simple — pas d'UTF-8 natif en PDF/1.4 sans ToUnicode map)
  function pdfStr(s) {
    return (s ?? "").replace(/[^\x20-\x7E]/g, "?").replace(/[()\\]/g, "\\$&");
  }

  const stream = `
% ─── RECTO ───
q
${bgRgb} rg
${cx.toFixed(2)} ${rY.toFixed(2)} ${cw.toFixed(2)} ${ch.toFixed(2)} re f
${accentRgb} rg
${cx.toFixed(2)} ${fBandY.toFixed(2)} ${cw.toFixed(2)} ${fBandH.toFixed(2)} re f
${textRgb} rg
BT /F1 ${r.bizSize} Tf ${(cx + r.contentX).toFixed(2)} ${(rY + ch - 44).toFixed(2)} Td (${pdfStr(r.card.locationName ?? r.biz)}) Tj ET
BT /F1 9 Tf ${(cx + r.contentX).toFixed(2)} ${(rY + 52).toFixed(2)} Td (${pdfStr(r.fi1)}) Tj ET
BT /F1 9 Tf ${(cx + r.contentX).toFixed(2)} ${(rY + 35).toFixed(2)} Td (${pdfStr(r.fi2)}) Tj ET
Q

% ─── LABEL RECTO ───
BT /F1 9 Tf ${cx.toFixed(2)} ${(rY + ch + 8).toFixed(2)} Td 0.5 0.5 0.5 rg (RECTO) Tj ET

% ─── VERSO ───
q
${bgRgb} rg
${cx.toFixed(2)} ${vY.toFixed(2)} ${cw.toFixed(2)} ${ch.toFixed(2)} re f
${accentRgb} rg
${cx.toFixed(2)} ${(vY + ch - bBandH).toFixed(2)} ${cw.toFixed(2)} ${bBandH.toFixed(2)} re f
${textRgb} rg
BT /F1 8 Tf ${(cx + cw / 2 - 30).toFixed(2)} ${(vY + 10).toFixed(2)} Td (${pdfStr(r.cta.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">"))}) Tj ET
${r.bi1 ? `BT /F1 9 Tf ${(cx + cw / 2 - 60).toFixed(2)} ${(vY + 44).toFixed(2)} Td (${pdfStr(r.bi1)}) Tj ET` : ""}
${r.bi2 ? `BT /F1 9 Tf ${(cx + cw / 2 - 60).toFixed(2)} ${(vY + 27).toFixed(2)} Td (${pdfStr(r.bi2)}) Tj ET` : ""}
Q

% ─── LABEL VERSO ───
BT /F1 9 Tf ${cx.toFixed(2)} ${(vY + ch + 8).toFixed(2)} Td 0.5 0.5 0.5 rg (VERSO) Tj ET
`.trim();

  const streamBuf = Buffer.from(stream);

  // Construction manuelle du PDF (cross-reference table précise)
  const hdr     = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  let   out     = hdr;
  const offsets = [];

  function obj(n, dict, body) {
    offsets[n] = Buffer.byteLength(out, "binary");
    out += `${n} 0 obj\n${dict}\n`;
    if (body !== undefined) out += body;
    out += `endobj\n`;
  }

  obj(1, `<</Type/Catalog/Pages 2 0 R>>`);
  obj(2, `<</Type/Pages/Kids[3 0 R]/Count 1>>`);
  obj(3, `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${PW} ${PH}]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>`);

  // Objet 4 : stream de contenu — calculer la taille en bytes
  const s4len = streamBuf.length;
  offsets[4]  = Buffer.byteLength(out, "binary");
  // Convertir out en Buffer pour concat précis
  let outBuf = Buffer.from(out, "binary");
  const s4hdr = Buffer.from(`4 0 obj\n<</Length ${s4len}>>\nstream\n`, "binary");
  const s4end = Buffer.from(`\nendstream\nendobj\n`, "binary");
  offsets[4]  = outBuf.length;

  obj(5, `<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>`);

  const xrefPos = Buffer.byteLength(out, "binary");
  out += `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i++) {
    out += `${String(offsets[i] ?? 0).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n`;

  // Reconstruire proprement avec le stream en binaire
  const part1 = Buffer.from(hdr, "binary");
  const obj1  = Buffer.from(`1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n`, "binary");
  const obj2  = Buffer.from(`2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n`, "binary");
  const obj3  = Buffer.from(`3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${PW} ${PH}]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>\nendobj\n`, "binary");
  const obj5  = Buffer.from(`5 0 obj\n<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>\nendobj\n`, "binary");

  const o1 = part1.length;
  const o2 = o1 + obj1.length;
  const o3 = o2 + obj2.length;
  const o4 = o3 + obj3.length;
  const o4hdr = Buffer.from(`4 0 obj\n<</Length ${streamBuf.length}>>\nstream\n`, "binary");
  const o4end = Buffer.from(`\nendstream\nendobj\n`, "binary");
  const o5 = o4 + o4hdr.length + streamBuf.length + o4end.length;
  const xr = o5 + obj5.length;

  const xrefBuf = Buffer.from(
    `xref\n0 6\n0000000000 65535 f \n` +
    `${String(o1).padStart(10,"0")} 00000 n \n` +
    `${String(o2).padStart(10,"0")} 00000 n \n` +
    `${String(o3).padStart(10,"0")} 00000 n \n` +
    `${String(o4).padStart(10,"0")} 00000 n \n` +
    `${String(o5).padStart(10,"0")} 00000 n \n` +
    `trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n${xr}\n%%EOF\n`,
    "binary"
  );

  return Buffer.concat([part1, obj1, obj2, obj3, o4hdr, streamBuf, o4end, obj5, xrefBuf]);
}

// ─────────────────────────────────────────────────────────────
// HELPERS SVG
// ─────────────────────────────────────────────────────────────

function stars(x, y, count, sz) {
  let s = "";
  for (let i = 0; i < count; i++) {
    const cx = x + i * (sz + 3);
    s += `<polygon points="${starPts(cx, y, sz/2, sz/4, 5)}" fill="#F59E0B" opacity="0.85"/>`;
  }
  return s;
}

function starPts(cx, cy, R, r, n) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = i * Math.PI / n - Math.PI / 2;
    const d = i % 2 === 0 ? R : r;
    pts.push(`${(cx + Math.cos(a)*d).toFixed(1)},${(cy + Math.sin(a)*d).toFixed(1)}`);
  }
  return pts.join(" ");
}

function nfc(cx, cy, r, color) {
  return `
    <circle cx="${cx}" cy="${cy}" r="${(r*0.22).toFixed(1)}" fill="${color}" opacity="0.9"/>
    <path d="M${cx-r*0.5} ${cy} A${r*0.5} ${r*0.5} 0 0 1 ${cx+r*0.5} ${cy}" fill="none" stroke="${color}" stroke-width="2" opacity="0.7"/>
    <path d="M${cx-r*0.75} ${cy} A${r*0.75} ${r*0.75} 0 0 1 ${cx+r*0.75} ${cy}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.5"/>
    <path d="M${cx-r} ${cy} A${r} ${r} 0 0 1 ${cx+r} ${cy}" fill="none" stroke="${color}" stroke-width="1" opacity="0.3"/>`;
}

function googleG(x, y, sz) {
  return `<text x="${x}" y="${y + sz}" font-family="Arial,sans-serif" font-size="${sz}"
    font-weight="bold" fill="white" opacity="0.7">G</text>`;
}

function esc(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// ─────────────────────────────────────────────────────────────
// EXPORTS UTILITAIRES
// ─────────────────────────────────────────────────────────────

export async function deleteCardExportFiles(uid) {
  for (const ext of ["svg", "png", "pdf"]) {
    try { await fsP.unlink(path.join(EXPORT_DIR, `${uid}.${ext}`)); }
    catch { /* absent = ok */ }
  }
  console.log(`[cardExport] 🗑️  Fichiers supprimés uid=${uid}`);
}

export function deriveCardUrls(svgUrl) {
  if (!svgUrl) return { svgUrl: null, pngUrl: null, pdfUrl: null };
  const base = svgUrl.replace(/\.svg$/, "");
  return { svgUrl, pngUrl: `${base}.png`, pdfUrl: `${base}.pdf` };
}

// Log du chemin résolu au démarrage du module (aide au debug)
console.log(`[cardExport] EXPORT_DIR résolu = ${EXPORT_DIR}`);