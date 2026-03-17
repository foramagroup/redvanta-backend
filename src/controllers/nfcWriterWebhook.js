import prisma from "../config/prisma.js";

export async function writerWebhook(req, res) {
  try {
    const { deviceId, uidList } = req.body;

    await prisma.nfcWriteLog.create({
      data: {
        deviceId,
        payload: JSON.stringify(uidList),
      },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "write failed" });
  }
}