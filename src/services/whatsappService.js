// src/services/whatsappService.js
import twilio from "twilio";

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

export const sendWhatsApp = async (to, message) => {
  try {
    return await client.messages.create({
      body: message,
      from: `whatsapp:${process.env.WHATSAPP_FROM}`,
      to: `whatsapp:${to}`
    });
  } catch (err) {
    console.error("Erreur WhatsApp:", err);
    throw new Error("WHATSAPP_SEND_FAILED");
  }
};
