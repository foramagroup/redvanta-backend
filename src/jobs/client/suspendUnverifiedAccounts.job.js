// src/jobs/suspendUnverifiedAccounts.job.js

import prisma from '../../config/database.js';

/**
 * Job CRON - Suspendre les comptes non vérifiés après expiration
 * À exécuter toutes les heures
 */
export async function suspendUnverifiedAccounts() {
  try {
    console.log('🔍 [CRON] Checking for expired unverified accounts...');

    const now = new Date();

    // Trouver les comptes non vérifiés avec code expiré
    const expiredUsers = await prisma.user.findMany({
      where: {
        emailVerifiedAt: null,
        emailVerifyCodeExp: {
          lt: now // Code expiré
        },
        accountSuspendedAt: null // Pas encore suspendu
      }
    });

    if (expiredUsers.length === 0) {
      console.log('✅ [CRON] No expired accounts to suspend');
      return { suspended: 0 };
    }

    console.log(`⚠️ [CRON] Found ${expiredUsers.length} expired accounts to suspend`);

    // Suspendre tous les comptes expirés
    const result = await prisma.user.updateMany({
      where: {
        id: {
          in: expiredUsers.map(u => u.id)
        }
      },
      data: {
        accountSuspendedAt: now,
        suspensionReason: 'Email non vérifié dans les délais impartis (3 jours)'
      }
    });

    console.log(`✅ [CRON] Suspended ${result.count} accounts`);

    return {
      suspended: result.count,
      accounts: expiredUsers.map(u => ({ id: u.id, email: u.email }))
    };

  } catch (error) {
    console.error('❌ [CRON] Error suspending unverified accounts:', error);
    throw error;
  }
}