// src/services/nfc.service.js — v3
// NFCTag = hardware (puce physique, neutre, stock)
// NFCCard = logique métier (client, location, design, product)

import prisma from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";

const APP_URL = process.env.FRONTEND_URL || "http://localhost:3000";

function buildPayload(uid) {
  return `${APP_URL}/r/${uid}`;
}

// ─── Générer les NFCCards pour une commande payée ─────────────
export async function generateNfcCardsForOrder(order) {
  const items = order.items ?? [];
  const cards = [];
  for (const item of items) {
    if (!item.designId) {
      console.log(`[nfc] orderItem #${item.id} sans design — carte ignorée`);
      continue;
    }
    const existing = await prisma.nFCCard.findUnique({ where: { orderItemId: item.id } });
    if (existing) { cards.push(existing); continue; }
    const card = await createNfcCard(item, order);
    cards.push(card);
  }
  console.log(`[nfc] ${cards.length} NFCCard(s) générées pour commande #${order.orderNumber}`);
  return cards;
}

async function createNfcCard(orderItem, order) {
  const design  = await prisma.design.findUnique({ where: { id: orderItem.designId } });
  const uid     = uuidv4();
  const payload = buildPayload(uid);

  const card = await prisma.nFCCard.create({
    data: {
      uid, payload,
      // tagId : NULL — puce hardware assignée à la production
      companyId:      order.companyId,
      userId:         order.userId,
      designId:       design?.id              ?? null,
      orderItemId:    orderItem.id,
      googlePlaceId:  design?.googlePlaceId   ?? null,
      googleReviewUrl: design?.googleReviewUrl ?? null,
      status:  "NOT_PROGRAMMED",
      active:  false,   // false jusqu'à DELIVERED
      used:    false,
      generatedAt: new Date(),
    },
  });

  if (design?.googlePlaceId) await linkCardToLocation(card, order.companyId, design.googlePlaceId);
  console.log(`[nfc] NFCCard créée uid=${uid} | active=false | status=NOT_PROGRAMMED`);
  return card;
}

async function linkCardToLocation(card, companyId, googlePlaceId) {
  try {
    const location = await prisma.location.findFirst({ where: { companyId, googlePlaceId } });
    if (!location) return;
    await prisma.nFCCard.update({
      where: { id: card.id },
      data: { locationId: location.id, locationName: location.name, locationAddress: location.address ?? null },
    });
    const count = await prisma.nFCCard.count({ where: { locationId: location.id } });
    await prisma.location.update({ where: { id: location.id }, data: { cardCount: count } });
  } catch (e) { console.error("[nfc] Erreur liaison location:", e.message); }
}

// ─── Mettre à jour le statut des cartes (production → shipped) ─
export async function updateCardsStatusForOrder(orderId, newOrderStatus) {
  const items = await prisma.orderItem.findMany({ where: { orderId }, include: { nfcCard: true } });
  const cards = items.filter((i) => i.nfcCard).map((i) => i.nfcCard);
  if (!cards.length) return 0;

  const statusMap = { production: "NOT_PROGRAMMED", printed: "PRINTED", shipped: "SHIPPED" };
  const cardStatus = statusMap[newOrderStatus];
  if (!cardStatus) return 0;

  await prisma.nFCCard.updateMany({ where: { id: { in: cards.map((c) => c.id) } }, data: { status: cardStatus } });

  // Si printed → marquer les puces hardware comme PROGRAMMED
  if (newOrderStatus === "printed") {
    for (const card of cards) {
      if (card.tagId) {
        await prisma.nFCTag.update({ where: { id: card.tagId }, data: { status: "PROGRAMMED" } }).catch(() => {});
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
// Appelé lors de la production physique
export async function assignTagToCard(cardUid, tagId) {
  const tag = await prisma.nFCTag.findUnique({ where: { id: tagId } });
  if (!tag) throw new Error(`NFCTag #${tagId} introuvable`);
  if (tag.status !== "NEW") throw new Error(`NFCTag #${tagId} déjà utilisée (status=${tag.status})`);
  const card = await prisma.nFCCard.findUnique({ where: { uid: cardUid } });
  if (!card) throw new Error(`NFCCard uid=${cardUid} introuvable`);
  if (card.tagId) throw new Error(`NFCCard a déjà une puce (tagId=${card.tagId})`);
  await prisma.nFCCard.update({ where: { uid: cardUid }, data: { tagId } });
  console.log(`[nfc] NFCTag #${tagId} → NFCCard uid=${cardUid}`);
}

// ─── Formats ──────────────────────────────────────────────────
export function formatNfcCard(card) {
  return {
    id: card.id, uid: card.uid, payload: card.payload,
    qrCodeUrl:    card.qrCodeUrl     ?? null,
    tagId:        card.tagId         ?? null,
    tagSerial:    card.tag?.tagSerial ?? null,
    chipType:     card.tag?.chipType  ?? null,
    tagStatus:    card.tag?.status    ?? null,
    status:       card.status, active: card.active, used: card.used,
    companyId:    card.companyId,
    userId:       card.userId,
    locationId:   card.locationId    ?? null,
    locationName: card.locationName  ?? null,
    designId:     card.designId      ?? null,
    orderItemId:  card.orderItemId   ?? null,
    googlePlaceId:       card.googlePlaceId       ?? null,
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
    id: tag.id, tagSerial: tag.tagSerial ?? null,
    chipType: tag.chipType ?? null, status: tag.status,
    isAssigned: !!tag.card, cardUid: tag.card?.uid ?? null,
    createdAt: tag.createdAt,
  };
}