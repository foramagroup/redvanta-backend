const { v4: uuid } = require("uuid");
const db = require("../db");

module.exports = async function affiliateTracking(req, res, next) {
  const ref = req.query.ref;
  const cookie = req.cookies.aff || uuid();

  if (!req.cookies.aff) {
    res.cookie("aff", cookie, { maxAge: 1000 * 60 * 60 * 24 * 30 });
  }

  if (ref) {
    const aff = await db.oneOrNone("SELECT * FROM Affiliate WHERE code = ?", [ref]);
    if (aff) {
      await db.run(
        "INSERT INTO Click (id, affiliateId, ip, userAgent, referer, cookie) VALUES (?,?,?,?,?,?)",
        [uuid(), aff.id, req.ip, req.headers["user-agent"], req.headers.referer || "", cookie]
      );
    }
  }

  next();
};
