export function ok(res, data) {
  return res.json({ ok: true, ...data });
}

export function fail(res, status = 400, message = 'error') {
  return res.status(status).json({ ok: false, error: message });
}
