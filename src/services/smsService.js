// src/services/smsService.js
import twilio from "twilio";

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

export const sendSMS = async (to, message) => {
  try {
    return await client.messages.create({
      body: message,
      to,
      from: process.env.TWILIO_FROM
    });
  } catch (err) {
    console.error("Erreur SMS:", err);
    throw new Error("SMS_SEND_FAILED");
  }
};
