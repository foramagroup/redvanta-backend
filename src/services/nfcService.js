// src/services/nfcService.js
import db from "../config/db.js";

export const assignNFCTag = async (userId, uid) => {
  return await db.nfcTag.create({
    data: { userId, uid }
  });
};

export const getNFCTargetUrl = (uid) =>
  `${process.env.FRONTEND_URL}/profile/${uid}`;
