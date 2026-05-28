import prisma from "../../config/database.js";

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function randomUID() {
  let s = 'CRD-';
  for (let i = 0; i < 6; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
  return s;
}

async function generateUniqueUIDs(count) {
  const candidates = new Set();
  while (candidates.size < count) candidates.add(randomUID());

  const existing = await prisma.nFCCard.findMany({
    where: { uid: { in: Array.from(candidates) } },
    select: { uid: true },
  });
  const taken = new Set(existing.map((c) => c.uid));
  const unique = Array.from(candidates).filter((u) => !taken.has(u));

  if (unique.length < count) {
    const extra = await generateUniqueUIDs(count - unique.length);
    return [...unique, ...extra];
  }
  return unique;
}

// POST /api/superadmin/cards/batch/generate
export async function batchGenerateCards(req, res) {
  try {
    const { quantity, designId, batchName } = req.body;
    const qty = parseInt(quantity, 10);

    if (!qty || qty < 1 || qty > 10000) {
      return res.status(400).json({ success: false, error: "quantity must be 1–10000" });
    }

    const template = designId
      ? await prisma.cardTemplate.findUnique({ where: { id: Number(designId) } })
      : null;

    if (designId && !template) {
      return res.status(404).json({ success: false, error: "Template not found" });
    }

    const uids = await generateUniqueUIDs(qty);
    const appBase = (process.env.NEXT_PUBLIC_API_URL || process.env.URL_PROD_BACKEND || process.env.URL_DEV_BACKEND).replace(/\/$/, '');
    const now = new Date();

    const cardsData = uids.map((uid) => ({
      uid,
      payload: `${appBase}/c/${uid}`,
      cardTemplateId: template?.id ?? null,
      status: 'NOT_PROGRAMMED',
      generatedAt: now,
    }));

    const { count: cardsCreatedCount } = await prisma.nFCCard.createMany({ data: cardsData, skipDuplicates: true });
    console.log(`[cardsBatch] nfc_cards inserted: ${cardsCreatedCount}/${qty}`);
    if (cardsCreatedCount === 0) {
      return res.status(500).json({ success: false, error: `0 cards inserted — check DB migration (companyId/userId must be nullable)` });
    }

    // Generate batch ID matching frontend format
    const d = now;
    const ds = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    const batchId = `BCH-${ds}-${Math.floor(Math.random() * 9000 + 1000)}`;

    const batch = await prisma.bulkBatch.create({
      data: {
        id: batchId,
        designId: template ? template.id : null,
        designName: template?.name ?? 'Stock batch',
        quantity: qty,
        status: 'Generated',
        jobStatus: 'completed',
        progress: 100,
        lastDone: qty,
        completedAt: now,
        settings: { batchName: batchName || batchId, quantity: qty, templateId: template?.id ?? null },
      },
    });

    const cards = cardsData.map((c) => ({
      uid: c.uid,
      qrUrl: c.payload,
      payload: c.payload,
    }));

    console.log(`[cardsBatch] Batch ${batch.id}: ${cards.length} cards generated`);

    return res.json({
      success: true,
      data: {
        batch: {
          id: batch.id,
          batchName: batchName || batch.id,
          quantity: batch.quantity,
          designId: batch.designId,
          status: batch.status,
          createdAt: batch.createdAt,
        },
        cards,
        cardsCreated: cards.length,
      },
    });
  } catch (err) {
    console.error('[batchGenerateCards]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// POST /api/superadmin/cards/assign
export async function assignCard(req, res) {
  try {
    const { uid, customerId, designId } = req.body;
    if (!uid) return res.status(400).json({ success: false, error: "uid required" });

    const card = await prisma.nFCCard.findUnique({ where: { uid } });
    if (!card) return res.status(404).json({ success: false, error: "Card not found" });

    const now = new Date();
    const updated = await prisma.nFCCard.update({
      where: { uid },
      data: {
        customerId: customerId != null ? Number(customerId) : null,
        designId:   designId   != null ? Number(designId)   : card.designId,
        status: 'ASSIGNED',
        assignedAt: now,
      },
    });

    console.log(`[cardsBatch] Card ${uid} → ASSIGNED to customer ${customerId}`);

    return res.json({
      success: true,
      data: {
        uid: updated.uid,
        qrUrl: updated.payload,
        designId: updated.designId,
        customerId: updated.customerId,
        status: updated.status,
        assignedAt: updated.assignedAt,
      },
    });
  } catch (err) {
    console.error('[assignCard]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/cards/:uid/activate  (public — appelé lors de l'activation par l'utilisateur)
export async function activateCardPublic(req, res) {
  try {
    const { uid } = req.params;

    const card = await prisma.nFCCard.findUnique({ where: { uid } });
    if (!card) return res.status(404).json({ success: false, error: "Card not found" });

    if (card.status === 'ACTIVATED') {
      return res.json({ success: true, data: { uid: card.uid, status: 'ACTIVATED', activatedAt: card.activatedAt } });
    }

    const now = new Date();
    const updated = await prisma.nFCCard.update({
      where: { uid },
      data: { status: 'ACTIVATED', activatedAt: now, active: true },
    });

    console.log(`[cardsBatch] Card ${uid} → ACTIVATED`);

    return res.json({
      success: true,
      data: { uid: updated.uid, status: 'ACTIVATED', activatedAt: updated.activatedAt },
    });
  } catch (err) {
    console.error('[activateCardPublic]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
