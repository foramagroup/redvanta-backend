/**
 * errorHandler.js
 * Centralise les erreurs pour renvoyer JSON.
 */

export function errorHandler(err, req, res, next) {
  console.error('[errorHandler] ', err && err.stack ? err.stack : err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error',
    details: process.env.NODE_ENV === 'production' ? undefined : (err && err.stack ? err.stack.split('\\n').slice(0,3).join('\\n') : undefined)
  });
}
