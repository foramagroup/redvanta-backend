

const requestCounts = new Map(); 

function getRateLimitKey(userId) {
  const minute = Math.floor(Date.now() / 60000); 
  return `${userId}_${minute}`;
}

// Max 30 requêtes autocomplete par minute par user
// (Une session = ~5-10 frappes → 30 = 3-6 sessions par minute, très largement suffisant)
const MAX_AUTOCOMPLETE_PER_MINUTE = 30;

export const autocompleteRateLimit = (req, res, next) => {
  const userId = req.user?.userId ?? req.ip;
  const key    = getRateLimitKey(userId);

  const current = requestCounts.get(key) ?? 0;

  if (current >= MAX_AUTOCOMPLETE_PER_MINUTE) {
    return res.status(429).json({
      success: false,
      error:   "Trop de recherches. Attendez un instant.",
      retryAfter: 60,
    });
  }

  requestCounts.set(key, current + 1);

  // Nettoyer les anciennes entrées toutes les 5 minutes
  if (Math.random() < 0.01) {
    const now = Math.floor(Date.now() / 60000);
    for (const [k] of requestCounts) {
      const keyMinute = parseInt(k.split("_").pop());
      if (now - keyMinute > 5) requestCounts.delete(k);
    }
  }

  next();
};