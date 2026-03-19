// src/services/mail.service.js
// Service d'envoi d'emails via Nodemailer (SMTP configurable)

import nodemailer from "nodemailer";

// ─── Transporter ──────────────────────────────────────────────

function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.MAIL_HOST   || "sandbox.smtp.mailtrap.io",
    port:   parseInt(process.env.MAIL_PORT || "2525"),
    secure: process.env.MAIL_SECURE === "true",
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });
}

// ─── Envoi générique ──────────────────────────────────────────

export async function sendMail({ to, subject, html, text }) {
  const transporter = createTransporter();
  const info = await transporter.sendMail({
    from:    `"${process.env.MAIL_FROM_NAME || "REDVANTA"}" <${process.env.MAIL_FROM_ADDRESS || "no-reply@redvanta.com"}>`,
    to,
    subject,
    html,
    text,
  });
  console.log(`[mail] Envoyé à ${to} — messageId: ${info.messageId}`);
  return info;
}