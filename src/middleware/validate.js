/**
 * validate.js
 * Quelques validateurs simples (ex: review input, product input).
 */

export function validateReviewInput(req, res, next) {
  const { rating, message } = req.body;
  if (typeof rating !== 'number' || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'rating must be integer 1-5' });
  }
  if (message && message.length > 4000) return res.status(400).json({ error: 'message too long' });
  next();
}

export function validateProductInput(req, res, next) {
  const { title, slug, priceCents } = req.body;
  if (!title || !slug) return res.status(400).json({ error: 'title and slug required' });
  if (typeof priceCents !== 'number') return res.status(400).json({ error: 'priceCents must be number' });
  next();
}
