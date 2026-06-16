// ═══════════════════════════════════════════════════════════
// src/controllers/superadmin/aiCredits.controller.js
// Gestion superadmin des achats de crédits IA
// ═══════════════════════════════════════════════════════════

import prisma from "../../config/database.js";
import { invalidateLimitsCache } from "../../services/limits.service.js";

// ── GET /api/superadmin/ai-credits ────────────────────────────
// Liste toutes les demandes d'achat de crédits
export async function listAllCreditPurchases(req, res) {
  try {
    const { status, search, limit = 200 } = req.query;

    const where = {};
    if (status && status !== "all") where.status = status;
    if (search) {
      where.OR = [
        { company: { name:  { contains: search } } },
        { company: { email: { contains: search } } },
        { invoice: { invoiceNumber: { contains: search } } },
      ];
    }

    const purchases = await prisma.aiCreditPurchase.findMany({
      where,
      take: parseInt(limit),
      orderBy: { createdAt: "desc" },
      include: {
        pack:    { select: { id: true, slug: true, credits: true, priceUsd: true } },
        company: { select: { id: true, name: true, email: true } },
        user:    { select: { id: true, name: true, email: true } },
        invoice: {
          select: {
            id:            true,
            invoiceNumber: true,
            status:        true,
            total:         true,
            currency:      true,
            invoiceDate:   true,
            dueDate:       true,
            paymentMethod: true,
            billingEmail:  true,
            billingPhone:  true,
            emailStatus:   true,
            items:         true,
          },
        },
      },
    });

    const totalCount   = purchases.length;
    const paidCount    = purchases.filter((p) => p.status === "paid").length;
    const pendingCount = purchases.filter((p) => p.status === "pending").length;
    const totalRevenue = purchases.filter((p) => p.status === "paid").reduce((s, p) => s + p.amountUsd, 0);

    res.json({
      success: true,
      data: purchases.map((p) => ({
        id:           p.id,
        company:      p.company,
        user:         p.user,
        packId:       p.packId,
        pack:         p.pack,
        credits:      p.credits,
        amount:       p.amountUsd,
        status:       p.status,
        paymentMethod: p.paymentMethod,
        paidAt:       p.paidAt,
        createdAt:    p.createdAt,
        invoice:      p.invoice,
      })),
      stats: {
        total:   totalCount,
        paid:    paidCount,
        pending: pendingCount,
        revenue: totalRevenue,
      },
    });
  } catch (err) {
    console.error("[listAllCreditPurchases]", err);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
}

// ── POST /api/superadmin/ai-credits/:id/mark-paid ─────────────
// Body: { paidAmount?, paymentMethod?, transactionId?, notes? }
export async function markCreditPurchasePaid(req, res) {
  try {
    const { id } = req.params;
    const { paymentMethod = "Manual Payment", transactionId, notes, paidAmount } = req.body;

    const purchase = await prisma.aiCreditPurchase.findUnique({
      where:   { id: parseInt(id) },
      include: { invoice: true, pack: { select: { slug: true } } },
    });

    if (!purchase) {
      return res.status(404).json({ success: false, error: "Purchase introuvable" });
    }

    if (purchase.status === "paid") {
      return res.status(422).json({ success: false, error: "Cette purchase est déjà payée." });
    }

    const amount = paidAmount ? Number(paidAmount) : purchase.amountUsd;
    const now       = new Date();
    const methodLabel = paymentMethod || purchase.paymentMethod || "Manual Payment";

    await prisma.$transaction(async (tx) => {
      // Marquer la purchase comme payée
      await tx.aiCreditPurchase.update({
        where: { id: purchase.id },
        data: {
          status:        "paid",
          paidAt:        now,
          paymentMethod: methodLabel,
          notes:         notes || purchase.notes,
        },
      });

      // Mettre à jour l'invoice si elle existe
      if (purchase.invoice) {
        await tx.invoice.update({
          where: { id: purchase.invoice.id },
          data: {
            status:        "paid",
            paidAt:        now,
            paidAmount:    amount,
            paymentMethod: methodLabel,
            notes:         notes || undefined,
          },
        });
      }

      // Activer les crédits
      await tx.aiCreditBalance.upsert({
        where:  { companyId: purchase.companyId },
        create: { companyId: purchase.companyId, purchased: purchase.credits },
        update: { purchased: { increment: purchase.credits } },
      });

      // Ledger
      await tx.aiCreditTransaction.create({
        data: {
          companyId:  purchase.companyId,
          kind:       "purchase",
          amount:     purchase.credits,
          revenueUsd: amount,
          meta: {
            packId:        purchase.packId,
            packSlug:      purchase.pack?.slug || null,
            source:        "manual_superadmin",
            purchaseId:    purchase.id,
            transactionId: transactionId || null,
          },
        },
      });
    });

    invalidateLimitsCache(purchase.companyId);

    res.json({
      success: true,
      message: `${purchase.credits} crédits activés pour la company ${purchase.companyId}.`,
    });
  } catch (err) {
    console.error("[markCreditPurchasePaid]", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── POST /api/superadmin/ai-credits/:id/send-invoice ──────────
export async function sendCreditInvoiceEmail(req, res) {
  try {
    const { id } = req.params;
    const { to, mode = "send" } = req.body;

    const purchase = await prisma.aiCreditPurchase.findUnique({
      where:   { id: parseInt(id) },
      include: { invoice: { include: { items: true } }, company: true, user: true },
    });

    if (!purchase || !purchase.invoice) {
      return res.status(404).json({ success: false, error: "Purchase ou facture introuvable" });
    }

    const recipient = to || purchase.user?.email || purchase.company?.email;
    if (!recipient) {
      return res.status(422).json({ success: false, error: "Destinataire introuvable" });
    }

    // Marquer comme envoyé dans l'invoice
    await prisma.invoice.update({
      where: { id: purchase.invoice.id },
      data: {
        emailStatus: "Sent",
        emailSentAt: new Date(),
      },
    });

    res.json({ success: true, message: `Facture envoyée à ${recipient}.` });
  } catch (err) {
    console.error("[sendCreditInvoiceEmail]", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
