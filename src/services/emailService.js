// src/services/emailService.js
import nodemailer from "nodemailer";

/**
 * Create a single reusable transporter using environment variables
 */
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT) || 587,
  secure: Number(process.env.MAIL_PORT) === 465, // secure si port 465
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

/**
 * Generic email sender
 */
export const sendEmail = async ({ to, subject, html }) => {
  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject,
      html
    });

    return { success: true };
  } catch (err) {
    console.error("Erreur envoi email:", err);
    throw new Error("EMAIL_SEND_FAILED");
  }
};

/**
 * Send Invite Email
 */
export async function sendInviteEmail(email, token) {
  const link = `${process.env.FRONT_URL}/register?invite=${token}`;

  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || "No Reply <noreply@example.com>",
      to: email,
      subject: "You are invited!",
      html: `
        <p>Click here to create your account:</p>
        <a href="${link}">${link}</a>
      `
    });

    return { success: true };
  } catch (err) {
    console.error("Erreur envoi email (invite):", err);
    throw new Error("EMAIL_INVITE_FAILED");
  }
}
