import express from "express";
import prisma from "../config/prisma.js";
const router = express.Router();

router.get("/", async (req, res) => {
  const uid = req.query.uid;
  if (!uid) return res.status(400).send("no uid");
  const tag = await prisma.nfcTag.findUnique({ where: { uid }});
  if (!tag) return res.status(404).send("tag not found");

  // record click
  await prisma.click.create({ data: { id: require('uuid').v4(), affiliateId: tag.affiliateId || null, ip: req.ip, userAgent: req.headers['user-agent'] || '', referer: req.headers.referer || '' }});

  // redirect to payload url (stored in tag.payload JSON)
  let payload;
  try { payload = JSON.parse(tag.payload).url; } catch(e){ payload = tag.payload; }
  return res.redirect(payload);
});

export async function publicRedirect(req, res) {
  const { uid } = req.query;

  // logging optimisé
  await prisma.scanLog.create({
    data: {
      tagUid: uid || null,
      ip: req.ip,
      agent: req.headers["user-agent"],
    },
  });

  // minimal fingerprint
  res.redirect(`/nfc/${uid}`);
}

export default router;
