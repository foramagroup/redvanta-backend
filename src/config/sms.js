/**
 * sms.js
 * Wrapper Twilio simple
 */

import Twilio from 'twilio';

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_PHONE_FROM;

const client = SID && TOKEN ? Twilio(SID, TOKEN) : null;

export async function sendSms(to, body) {
  if (!client) {
    console.warn('[sms] Twilio not configured — skipping SMS to', to);
    return;
  }
  return client.messages.create({ body, from: FROM, to });
}
