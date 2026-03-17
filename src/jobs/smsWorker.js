import prisma from "../prismaClient.js";
import { sendSMS } from "../services/smsService.js";

export async function processQueuedSms() {
  const items = []; // implement if sms queue table exists
  for (const it of items) { await sendSMS(it.to, it.message); }
}
