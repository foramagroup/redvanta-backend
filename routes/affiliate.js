const router = require("express").Router();
const db = require("../db");
const requireAuth = require("../middleware/requireAuth");

router.get("/me", requireAuth, async (req, res) => {
  const userId = req.user.id;

  const affiliate = await db.oneOrNone(
    "SELECT * FROM Affiliate WHERE ownerId = ?", [userId]
  );
  if (!affiliate) return res.status(400).json({ error: "Aucun profil affilié." });

  const clicks = await db.all(
    "SELECT * FROM Click WHERE affiliateId = ? ORDER BY createdAt DESC LIMIT 20",
    [affiliate.id]
  );

  const conversions = await db.all(
    "SELECT * FROM Conversion WHERE affiliateId = ? ORDER BY createdAt DESC LIMIT 20",
    [affiliate.id]
  );

  const revenue = await db.get(
    "SELECT SUM(amountCents) as amount FROM Conversion WHERE affiliateId = ?",
    [affiliate.id]
  );

  res.json({
    code: affiliate.code,
    clicks: clicks.length,
    conversions: conversions.length,
    revenue: revenue?.amount || 0,
    lastClicks: clicks,
    lastConversions: conversions
  });
});

module.exports = router;
