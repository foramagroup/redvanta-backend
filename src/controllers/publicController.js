import prisma from "../config/prisma.js";
import { v4 as uuidv4 } from "uuid";
import geoip from "geoip-lite";

/**
 * Public redirect route: GET /r?uid=XXXX
 * - lookup tag by uid
 * - log minimal fingerprint (ip, userAgent shortened, geo)
 * - redirect to payload
 * - Apply rate-limit (see middleware)
 */
export async function publicRedirect(req, res) {
  try {
    const uid = req.query.uid;
    if (!uid) return res.status(400).send("Missing uid");

    const tag = await prisma.nFCTag.findUnique({ where: { uid } });
    if (!tag) return res.status(404).send("Not found");

    const ip = (req.headers['x-forwarded-for'] || req.ip || "").toString().split(",")[0].trim();
    const ua = (req.headers['user-agent'] || "").slice(0, 512); // keep small
    const geo = geoip.lookup(ip) || {};

    // avoid logging duplicate rapid hits from same IP/uid
    await prisma.scanLog.create({
      data: {
        id: uuidv4(),
        nfcTagId: tag.id,
        ip,
        agent: ua,
        country: geo.country || null,
        city: geo.city || null,
        lat: geo.ll ? geo.ll[0] : null,
        lon: geo.ll ? geo.ll[1] : null
      }
    }).catch(err => {
      console.warn("scanLog create failed", err.message);
    });

    // Redirect
    const redirectUrl = tag.payload || (tag.designId ? `${process.env.FRONT_URL}/design/${tag.designId}` : process.env.FRONT_URL || "/");
    // send 302 redirect
    return res.redirect(302, redirectUrl);
  } catch (err) {
    console.error("publicRedirect", err);
    res.status(500).send("Server error");
  }
}
