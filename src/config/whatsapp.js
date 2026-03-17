/**
 * whatsapp.js
 * Wrapper pour WhatsApp via Twilio (ou autre). Ici Twilio WhatsApp usage.
 */

import Twilio from 'twilio';

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const WA_FROM = process.env.TWILIO_WHATSAPP_FROM; // ex: +123456789

const client = SID && TOKEN ? Twilio(SID, TOKEN) : null;

export async function sendWhatsApp(to, body) {
  if (!client) {
    console.warn('[whatsapp] Twilio not configured — skipping');
    return;
  }
  return client.messages.create({
    body,
    from: `whatsapp:${WA_FROM}`,
    to: `whatsapp:${to}`
  });
}
