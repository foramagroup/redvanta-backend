// backend/src/services/affiliateAdminService.js
import prisma from "../prismaClient.js";
import { v4 as uuidv4 } from "uuid";
import { exportCSV } from "./../services/exportService.js";

/**
 * Service admin pour gérer les affiliés
 */

export async function listAffiliates({ skip = 0, take = 50 } = {}) {
  const items = await prisma.affiliate.findMany({
    take,
    skip,
    orderBy: { createdAt: "desc" },
    include: {
      clicks: { take: 0 }, // don't load full clicks by default
      conversions: { take: 0 }
    }
  });

  // pour chaque affilié on calcule quelques metrics (count)
  const enriched = await Promise.all(items.map(async (a) => {
    const clicksCount = await prisma.click.count({ where: { affiliateId: a.id } });
    const conversionsCount = await prisma.conversion.count({ where: { affiliateId: a.id } });
    const revenue = await prisma.conversion.aggregate({ _sum: { amountCents: true }, where: { affiliateId: a.id } });
    return {
      ...a,
      clicksCount,
      conversionsCount,
      revenueCents: revenue._sum.amountCents || 0
    };
  }));

  return enriched;
}

export async function createAffiliate({ name, email, ownerId }) {
  const code = "AFF" + Math.random().toString(36).slice(2, 8).toUpperCase();
  const affiliate = await prisma.affiliate.create({
    data: { id: uuidv4(), code, name, email, ownerId: ownerId || null }
  });
  return affiliate;
}

export async function updateAffiliate(id, data) {
  const up = await prisma.affiliate.update({ where: { id }, data });
  return up;
}

export async function deleteAffiliate(id) {
  await prisma.affiliate.delete({ where: { id } });
  return true;
}

export async function getAffiliateDetail(id, { clicksLimit = 100, convLimit = 100 } = {}) {
  const affiliate = await prisma.affiliate.findUnique({ where: { id } });
  if (!affiliate) return null;
  const clicks = await prisma.click.findMany({ where: { affiliateId: id }, orderBy: { createdAt: "desc" }, take: clicksLimit });
  const conversions = await prisma.conversion.findMany({ where: { affiliateId: id }, orderBy: { createdAt: "desc" }, take: convLimit });
  const revenueAgg = await prisma.conversion.aggregate({ _sum: { amountCents: true }, where: { affiliateId: id } });

  return {
    affiliate,
    clicks,
    conversions,
    metrics: {
      clicksCount: clicks.length,
      conversionsCount: conversions.length,
      revenueCents: revenueAgg._sum.amountCents || 0
    }
  };
}

export async function exportAffiliatesCSV() {
  // simple export: affiliate rows + metrics
  const affs = await prisma.affiliate.findMany();
  const rows = await Promise.all(affs.map(async (a) => {
    const clicks = await prisma.click.count({ where: { affiliateId: a.id } });
    const conv = await prisma.conversion.count({ where: { affiliateId: a.id } });
    const revenue = (await prisma.conversion.aggregate({ _sum: { amountCents: true }, where: { affiliateId: a.id } }))._sum.amountCents || 0;
    return {
      id: a.id,
      code: a.code,
      name: a.name || "",
      email: a.email || "",
      clicks,
      conversions: conv,
      revenueCents: revenue,
      createdAt: a.createdAt.toISOString()
    };
  }));
  return exportCSV(rows);
}
