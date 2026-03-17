/**
 * logger.js
 * Simple logger wrapper. Remplace par pino/winston en prod.
 */

export function info(...args) { console.log('[info]', ...args); }
export function warn(...args) { console.warn('[warn]', ...args); }
export function error(...args) { console.error('[error]', ...args); }
