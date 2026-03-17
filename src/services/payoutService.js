// backend/src/services/payoutService.js
import prisma from "../prismaClient.js";
import stripe from "../config/stripe.js";

/**
 * createPayoutRequest: enregistre la demande côté DB (status = pending)
 */
export async function createPayoutRequest({ affiliateId, amountCents, currency = "EUR", note }) {
  const req = await prisma.payoutRequest.create({
    data: {
      affiliateId,
      amountCents,
      currency,
      note,
      status: "pending"
    }
  });
  return req;
}

/**
 * approveAndProcess: transitionne en approved puis lance le transfert Stripe
 * - Si affiliate.stripeAccountId présent : create transfer to connected account
 * - Sinon : marque approved but no transfer (manual payout)
 */
export async function approveAndProcessPayout(payoutId, adminUser = null) {
  const payout = await prisma.payoutRequest.findUnique({ where: { id: payoutId }, include: { affiliate: true } });
  if (!payout) throw new Error("Payout not found");
  if (payout.status !== "pending" && payout.status !== "approved") throw new Error("Invalid status");

  // mark processing
  await prisma.payoutRequest.update({ where: { id: payoutId }, data: { status: "processing" } });

  const affiliate = payout.affiliate;
  if (!affiliate) throw new Error("Affiliate missing");

  if (!affiliate.stripeAccountId) {
    // no connected account -> cannot auto transfer
    await prisma.payoutRequest.update({ where: { id: payoutId }, data: { status: "approved", processedAt: new Date() } });
    return { manual: true };
  }

  // use stripe transfer to connected account
  try {
    const transfer = await stripe.transfers.create({
      amount: payout.amountCents,
      currency: payout.currency.toLowerCase(),
      destination: affiliate.stripeAccountId,
      metadata: { payoutRequestId: payout.id, affiliateId: affiliate.id }
    });

    await prisma.payoutRequest.update({
      where: { id: payoutId },
      data: { status: "paid", stripeTransferId: transfer.id, processedAt: new Date() }
    });

    return { transfer, payoutId };
  } catch (err) {
    await prisma.payoutRequest.update({
      where: { id: payoutId },
      data: { status: "failed", processedAt: new Date() }
    });
    throw err;
  }
}

/**
 * declinePayout: met à jour le statut
 */
export async function declinePayout(id, reason = null) {
  return prisma.payoutRequest.update({ where: { id }, data: { status: "declined", note: reason, processedAt: new Date() } });
}

/**
 * list payout requests (admin)
 */
export async function listPayoutRequests({ skip = 0, take = 50 } = {}) {
  return prisma.payoutRequest.findMany({
    orderBy: { requestedAt: "desc" },
    skip,
    take,
    include: { affiliate: true }
  });
}

/**
 * get payout detail
 */
export async function getPayoutDetail(id) {
  return prisma.payoutRequest.findUnique({ where: { id }, include: { affiliate: true } });
}
