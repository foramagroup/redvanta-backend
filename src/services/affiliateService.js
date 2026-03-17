// src/services/affiliateService.js
import prisma from "../prismaClient.js";

/**
 * Create affiliate account for a user
 */
export const createAffiliate = async (userId, name, email) => {
  return prisma.affiliate.create({
    data: {
      userId,
      name,
      email,
      refCode: generateCode()
    }
  });
};

const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

/**
 * Retrieve affiliate by referral code
 */
export const getAffiliateByCode = async (code) => {
  return prisma.affiliate.findUnique({
    where: { refCode: code }
  });
};

/**
 * Track a click for an affiliate
 */
export const recordClick = async (affiliateId, req) => {
  return prisma.click.create({
    data: {
      affiliateId,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      referer: req.headers["referer"] || null
    }
  });
};

/**
 * Save a conversion after an order
 */
export const recordConversion = async (orderId, affiliateId, amountCents) => {
  return prisma.conversion.create({
    data: {
      orderId,
      affiliateId,
      amountCents
    }
  });
};

/**
 * Affiliate statistics dashboard
 */
export const getAffiliateStats = async (affiliateId) => {
  const clicks = await prisma.click.count({ where: { affiliateId } });
  const conversions = await prisma.conversion.count({ where: { affiliateId } });
  const revenue = await prisma.conversion.aggregate({
    where: { affiliateId },
    _sum: { amountCents: true }
  });

  return {
    clicks,
    conversions,
    revenue: revenue._sum.amountCents || 0
  };
};
