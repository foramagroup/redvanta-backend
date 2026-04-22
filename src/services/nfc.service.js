// src/services/nfc.service.js — v3
// NFCTag = hardware (puce physique, neutre, stock)
// NFCCard = logique métier (client, location, design, product)
//
// La génération QR Code (SVG / PNG / PDF) est déléguée à qrcode.service.js

import prisma from "../config/database.js";
import { v4 as uuidv4 } from "uuid";
import { generateAllQrCodes, deriveQrUrls, deleteQrFiles } from "./qrcode.service.js";
import { generateCardExport, deleteCardExportFiles, deriveCardUrls } from "./cardExport.service.js";

const APP_URL = process.env.URL_PROD_BACKEND || "http://localhost:4000/api";

// ─── Payload encodée dans le QR + puce NFC ───────────────────
// JAMAIS le lien Google directement — toujours l'URL de redirection interne
function buildPayload(uid) {
  return `${APP_URL}/r/${uid}`;
}

// ─────────────────────────────────────────────────────────────
// FONCTIONS EXPORTÉES
// ─────────────────────────────────────────────────────────────

// ─── Générer les NFCCards pour une commande payée ─────────────
// Appelé par le webhook Stripe (payment_intent.succeeded)
export async function generateNfcCardsForOrder(order) {
  const items = order.items ?? [];
  const allCards = [];
 
  for (const item of items) {
    if (!item.designId) {
      console.log(`[nfc] orderItem #${item.id} sans design — cartes ignorées`);
      continue;
    }
 
    const totalCards = item.totalCards ?? item.quantity ?? 1;
 
    // Compter les cartes déjà générées pour cet item (idempotence)
    const alreadyCount = await prisma.nFCCard.count({ where: { orderItemId: item.id } });
 
    if (alreadyCount >= totalCards) {
      console.log(`[nfc] orderItem #${item.id} — ${alreadyCount} carte(s) déjà générée(s), skip`);
      const existing = await prisma.nFCCard.findMany({ where: { orderItemId: item.id } });
      allCards.push(...existing);
      continue;
    }
 
    // Générer les cartes manquantes (en cas de relance partielle)
    const toGenerate = totalCards - alreadyCount;
    console.log(`[nfc] orderItem #${item.id} — génération de ${toGenerate} carte(s) (totalCards=${totalCards})`);
 
    for (let i = 0; i < toGenerate; i++) {
      const card = await createNfcCard(item, order);
      allCards.push(card);
    }
  }
 
  console.log(`[nfc] ${allCards.length} NFCCard(s) au total pour commande #${order.orderNumber}`);
  return allCards;
}
 
// ─── Créer une NFCCard (avec QR Code) pour un item ───────────
// ─── Créer UNE NFCCard (avec QR Code) pour un item ──────────
// Appelé N fois par generateNfcCardsForOrder (N = orderItem.totalCards)
// Chaque appel produit un uid UUID distinct → QR Code distinct → puce NFC distincte
// ⚠️  orderItemId n'a PAS @unique dans le schéma → plusieurs cartes peuvent partager le même orderItemId
async function createNfcCard(orderItem, order) {
  const design = await prisma.design.findUnique({ where: { id: orderItem.designId } });
 
  // 1. Générer l'uid stable — jamais modifié — utilisé dans l'URL /r/{uid}
  const uid     = uuidv4();
  const payload = buildPayload(uid); // Ex: https://app.redvanta.com/r/a8f3c9d2-…
 
  // 2. Générer SVG + PNG + PDF via qrcode.service.js
  //    payload = contenu exact encodé dans le QR (JAMAIS lien Google directement)
  const { svgUrl: qrCodeUrl } = await generateAllQrCodes(uid, payload);
 
  // 3. Créer la NFCCard en DB
  //    tagId   : NULL — puce hardware assignée à la production physique
  //    active  : false — activée seulement lors de la livraison (DELIVERED)
  //    status  : NOT_PROGRAMMED — inchangé jusqu'à la production
  const card = await prisma.nFCCard.create({
    data: {
      uid,
      payload,
      qrCodeUrl,                               // ← URL du SVG généré (ou null si échec)
      companyId:       order.companyId,
      userId:          order.userId,
      designId:        design?.id              ?? null,
      orderItemId:     orderItem.id,
      googlePlaceId:   design?.googlePlaceId   ?? null,
      googleReviewUrl: design?.googleReviewUrl  ?? null,
      status:          "NOT_PROGRAMMED",        // statut inchangé
      active:          false,                   // false jusqu'à DELIVERED
      used:            false,
      generatedAt:     new Date(),
    },
  });
 
  // 4. Lier à la location via Google Place ID (uid intact, pas modifié)
  if (design?.googlePlaceId) {
    await linkCardToLocation(card, order.companyId, design.googlePlaceId);
  }
 
  console.log(`[nfc] NFCCard créée uid=${uid} | qrCodeUrl=${qrCodeUrl ?? "null"} | active=false | status=NOT_PROGRAMMED`);
  return card;
}
 
// ─── Régénérer le QR Code d'une carte existante ──────────────
// Utile si l'upload a échoué lors de la création (qrCodeUrl === null)
// Endpoint superadmin : PATCH /api/superadmin/nfc/cards/:uid/regenerate-qr
export async function regenerateQrCode(cardUid) {
  console.log(`[nfc] 🔄 Régénération exports pour carte uid=${cardUid}`);

  // ✅ Récupérer la carte avec son design
  const card = await prisma.nFCCard.findUnique({ 
    where: { uid: cardUid },
    include: { design: true }  // ✅ Important : inclure le design
  });

  if (!card) {
    throw new Error(`NFCCard uid=${cardUid} introuvable`);
  }

  if (!card.payload) {
    throw new Error(`NFCCard uid=${cardUid} n'a pas de payload`);
  }

  if (!card.design) {
    throw new Error(`NFCCard uid=${cardUid} n'a pas de design lié`);
  }

  try {
    // ✅ ÉTAPE 1 : Supprimer les anciens fichiers (SVG + PNG + PDF)
    await deleteCardExportFiles(cardUid);
    console.log(`[nfc]   ✅ Anciens fichiers supprimés`);

    // ✅ ÉTAPE 2 : Générer les nouveaux exports avec le design
    const exports = await generateCardExport(card, card.design);
    console.log(`[nfc]   ✅ Nouveaux exports générés → ${exports.svgUrl}`);

    // ✅ ÉTAPE 3 : Mettre à jour qrCodeUrl en DB
    await prisma.nFCCard.update({ 
      where: { uid: cardUid }, 
      data: { qrCodeUrl: exports.svgUrl } 
    });
    console.log(`[nfc]   ✅ DB mise à jour`);

    console.log(`[nfc] ✅ Régénération réussie pour uid=${cardUid}`);
    return exports;  // ✅ Retourne { svgUrl, pngUrl, pdfUrl }

  } catch (err) {
    console.error(`[nfc] ❌ Échec régénération uid=${cardUid} :`, err.message);
    throw new Error(`Échec de génération des exports pour uid=${cardUid}: ${err.message}`);
  }
}

export async function regenerateCardExportsForDesign(designId) {
  console.log(`[nfc] 🔄 Début régénération exports pour design #${designId}`);

  // ✅ Récupérer le design avec toutes ses cartes NFC
  const design = await prisma.design.findUnique({ 
    where: { id: designId },
    include: { 
      nfcCards: true  // ✅ Relation Design → NFCCard
    }
  });

  if (!design) {
    console.error(`[nfc] ❌ Design #${designId} introuvable`);
    throw new Error(`Design #${designId} introuvable`);
  }

  if (!design.nfcCards || design.nfcCards.length === 0) {
    console.log(`[nfc] ⚠️ Design #${designId} — aucune carte NFC liée, skip`);
    return { regenerated: 0, failed: 0 };
  }

  console.log(`[nfc] 📋 ${design.nfcCards.length} carte(s) NFC liées au design #${designId}`);

  let regenerated = 0;
  let failed = 0;

  // ✅ Régénérer pour chaque carte
  for (const card of design.nfcCards) {
    if (!card.payload) {
      console.warn(`[nfc] ⚠️ Carte uid=${card.uid} sans payload, skip`);
      failed++;
      continue;
    }

    try {
      console.log(`[nfc] 🔄 Régénération uid=${card.uid}...`);

      // ✅ ÉTAPE 1 : Supprimer les anciens fichiers (SVG + PNG + PDF)
      await deleteCardExportFiles(card.uid);
      console.log(`[nfc]   ✅ Anciens fichiers supprimés`);

      // ✅ ÉTAPE 2 : Générer les nouveaux exports avec le design mis à jour
      const exports = await generateCardExport(card, design);
      console.log(`[nfc]   ✅ Nouveaux exports générés → ${exports.svgUrl}`);

      // ✅ ÉTAPE 3 : Mettre à jour qrCodeUrl en DB (si l'URL a changé)
      if (exports.svgUrl !== card.qrCodeUrl) {
        await prisma.nFCCard.update({
          where: { uid: card.uid },
          data: { qrCodeUrl: exports.svgUrl }
        });
        console.log(`[nfc]   ✅ DB mise à jour`);
      }

      regenerated++;
      console.log(`[nfc] ✅ uid=${card.uid} régénéré avec succès`);

    } catch (err) {
      console.error(`[nfc] ❌ Échec régénération uid=${card.uid} :`, err.message);
      failed++;
    }
  }

  console.log(`[nfc] 🎯 Design #${designId} — ${regenerated} régénérés, ${failed} échecs`);
  return { regenerated, failed };
}
 
// ─── Lier une NFCCard à sa location ──────────────────────────
async function linkCardToLocation(card, companyId, googlePlaceId) {
  try {
    const location = await prisma.location.findFirst({ where: { companyId, googlePlaceId } });
    if (!location) return;
    await prisma.nFCCard.update({
      where: { id: card.id },
      data: {
        locationId:      location.id,
        locationName:    location.name,
        locationAddress: location.address ?? null,
      },
    });
    const count = await prisma.nFCCard.count({ where: { locationId: location.id } });
    await prisma.location.update({ where: { id: location.id }, data: { cardCount: count } });
  } catch (e) {
    console.error("[nfc] Erreur liaison location:", e.message);
  }
}
 
// ─── Mettre à jour le statut des cartes (production → shipped) ─
export async function updateCardsStatusForOrder(orderId, newOrderStatus) {
  const items = await prisma.orderItem.findMany({ where: { orderId }, include: { nfcCard: true } });
  const cards = items.filter((i) => i.nfcCard).map((i) => i.nfcCard);
  if (!cards.length) return 0;
 
  const statusMap = { production: "NOT_PROGRAMMED", printed: "PRINTED", shipped: "SHIPPED" };
  const cardStatus = statusMap[newOrderStatus];
  if (!cardStatus) return 0;
 
  await prisma.nFCCard.updateMany({
    where: { id: { in: cards.map((c) => c.id) } },
    data:  { status: cardStatus },
  });
 
  // Si printed → marquer les puces hardware liées comme PROGRAMMED
  if (newOrderStatus === "printed") {
    for (const card of cards) {
      if (card.tagId) {
        await prisma.nFCTag.update({
          where: { id: card.tagId },
          data:  { status: "PROGRAMMED" },
        }).catch(() => {});
      }
    }
  }
 
  console.log(`[nfc] ${cards.length} NFCCard(s) → status=${cardStatus}`);
  return cards.length;
}
 
// ─── Activer les cartes à la livraison (SEUL moment) ─────────
export async function activateCardsForOrder(orderId) {
  const items   = await prisma.orderItem.findMany({ where: { orderId }, include: { nfcCard: true } });
  const cardIds = items.filter((i) => i.nfcCard).map((i) => i.nfcCard.id);
  if (!cardIds.length) return 0;
 
  await prisma.nFCCard.updateMany({
    where: { id: { in: cardIds } },
    data:  { status: "ACTIVE", active: true, activatedAt: new Date() },
  });
 
  console.log(`[nfc] ${cardIds.length} NFCCard(s) ACTIVÉES pour commande #${orderId}`);
  return cardIds.length;
}
 
// ─── Assigner une puce hardware à une carte ──────────────────
export async function assignTagToCard(cardId, tagId) {
  return await prisma.$transaction(async (tx) => {
    // 1. Vérifier la disponibilité du Tag
    const tag = await tx.nFCTag.findUnique({ where: { id: tagId } });
    if (!tag) throw new Error(`NFCTag #${tagId} introuvable`);
    if (tag.status !== "NEW") throw new Error(`Tag déjà utilisé (status=${tag.status})`);
    // 2. Vérifier la Carte
    const card = await tx.nFCCard.findUnique({ where: { id: cardId } });
    if (!card) throw new Error(`NFCCard #${cardId} introuvable`);
    if (card.tagId) throw new Error(`Cette carte possède déjà une puce`);
    // 3. Update atomique des deux côtés
    const updatedCard = await tx.nFCCard.update({
      where: { id: cardId },
      data: { tagId: tagId }, // On lie le tag à la carte
    });
    await tx.nFCTag.update({
      where: { id: tagId },
      data: { status: "PROGRAMMED" }, // On marque le tag comme assigné
    });
    console.log(`[nfc] Liaison réussie : Tag ${tag.tagSerial} ↔ Card ${card.uid}`);
    return updatedCard;
  });
}
 
// ─── Formats réponse API ──────────────────────────────────────
export function formatNfcCard(card) {
  // Dériver PNG + PDF depuis l'URL SVG stockée en DB
  // Aucune modification du schéma Prisma nécessaire
  const { svgUrl, pngUrl, pdfUrl } = deriveQrUrls(card.qrCodeUrl ?? null);
 
  return {
    id:                  card.id,
    uid:                 card.uid,
    payload:             card.payload,
    qrCodeUrl:           svgUrl,   // SVG — impression cartes PVC
    qrCodePngUrl:        pngUrl,   // PNG — dashboard & mobile (1000px)
    qrCodePdfUrl:        pdfUrl,   // PDF — envoi imprimeur
    tagId:               card.tagId               ?? null,
    tagSerial:           card.tag?.tagSerial       ?? null,
    chipType:            card.tag?.chipType        ?? null,
    tagStatus:           card.tag?.status          ?? null,
    status:              card.status,
    active:              card.active,
    used:                card.used,
    companyId:           card.companyId,
    userId:              card.userId,
    locationId:          card.locationId           ?? null,
    locationName:        card.locationName         ?? null,
    designId:            card.designId             ?? null,
    orderItemId:         card.orderItemId          ?? null,
    googlePlaceId:       card.googlePlaceId        ?? null,
    googleReviewUrl:     card.googleReviewUrl      ?? null,
    scanCount:           card.scanCount            ?? 0,
    googleRedirectCount: card.googleRedirectCount  ?? 0,
    lastScannedAt:       card.lastScannedAt        ?? null,
    generatedAt:         card.generatedAt          ?? null,
    activatedAt:         card.activatedAt          ?? null,
    companyName:         card.company?.name        ?? null,
  };
}
 
export function formatNfcTag(tag) {
  return {
    id:         tag.id,
    tagSerial:  tag.tagSerial ?? null,
    chipType:   tag.chipType  ?? null,
    status:     tag.status,
    isAssigned: !!tag.card,
    cardUid:    tag.card?.uid ?? null,
    createdAt:  tag.createdAt.toISOString().split('T')[0],
  };
}