// src/utils/subscription.helpers.js

/**
 * Créer une subscription pour une company
 */
export async function createSubscriptionForCompany(tx, companyId, planId, options = {}) {
  const {
    status = 'trialing',
    interval = 'monthly',
    startDate = new Date(),
    trialDays = 14,
  } = options;
  
  // Récupérer le plan
  const plan = await tx.planSetting.findUnique({
    where: { id: planId }
  });
  
  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }
  
  const now = startDate;
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + (trialDays || plan.trialDays));
  
  const currentPeriodStart = now;
  const currentPeriodEnd = new Date(now);
  if (interval === 'monthly') {
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
  } else {
    currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
  }
  
  return await tx.subscription.create({
    data: {
      companyId,
      planId,
      status,
      interval,
      baseAmount: interval === 'monthly' ? plan.price : plan.annual,
      addonsAmount: 0,
      totalAmount: interval === 'monthly' ? plan.price : plan.annual,
      currentPeriodStart,
      currentPeriodEnd,
      nextBillingDate: status === 'trialing' ? trialEnd : currentPeriodEnd,
      trialStart: status === 'trialing' ? now : null,
      trialEnd: status === 'trialing' ? trialEnd : null,
    }
  });
}

/**
 * Calculer le total d'une subscription avec addons
 */
export async function recalculateSubscriptionTotal(tx, subscriptionId) {
  const subscription = await tx.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      addons: {
        where: { status: 'active' }
      }
    }
  });
  
  if (!subscription) {
    throw new Error(`Subscription ${subscriptionId} not found`);
  }
  
  const addonsAmount = subscription.addons.reduce((sum, a) => sum + a.amount, 0);
  const totalAmount = subscription.baseAmount + addonsAmount;
  
  return await tx.subscription.update({
    where: { id: subscriptionId },
    data: {
      addonsAmount,
      totalAmount
    }
  });
}