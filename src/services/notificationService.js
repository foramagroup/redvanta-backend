// src/services/notificationService.js
import { sendEmail } from "./emailService.js";
import { sendSMS } from "./smsService.js";
import { sendWhatsApp } from "./whatsappService.js";

export const notifyUser = async ({ user, subject, message, html }) => {
  if (user.email) await sendEmail({ to: user.email, subject, html });
  if (user.phone) await sendSMS(user.phone, message);
  if (user.whatsapp) await sendWhatsApp(user.whatsapp, message);

  return true;
};
