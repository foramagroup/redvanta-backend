// src/controllers/client/contact.controller.js
// Formulaire de contact public — stockage BD + notification superadmin

import prisma from "../../config/database.js";
import { sendMail } from "../../services/client/mail.service.js";

// ── helpers ────────────────────────────────────────────────────
const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function buildAdminNotificationEmail({ name, email, company, message }) {
  const companyLine = company ? `<p><strong>Company:</strong> ${company}</p>` : "";
  return {
    subject: `[Contact] New message from ${name}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f0f0f;color:#e5e5e5;border-radius:8px;overflow:hidden">
        <div style="background:#E10600;padding:20px 24px">
          <h2 style="margin:0;color:#fff;font-size:18px">New contact message</h2>
        </div>
        <div style="padding:24px;border:1px solid #2a2a2a;border-top:none;border-radius:0 0 8px 8px">
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> <a href="mailto:${email}" style="color:#E10600">${email}</a></p>
          ${companyLine}
          <hr style="border:none;border-top:1px solid #2a2a2a;margin:16px 0"/>
          <p style="white-space:pre-wrap;line-height:1.6">${message}</p>
          <hr style="border:none;border-top:1px solid #2a2a2a;margin:16px 0"/>
          <p style="font-size:12px;color:#666">Received ${new Date().toLocaleString("en-US")}</p>
        </div>
      </div>`,
    text: `New contact message\nFrom: ${name} <${email}>${company ? `\nCompany: ${company}` : ""}\n\n${message}`,
  };
}

// ── POST /api/contact ──────────────────────────────────────────
export const submitContact = async (req, res, next) => {
  try {
    const { name, email, company = null, message } = req.body;

    // Validation
    if (!name?.trim() || name.trim().length < 2) {
      return res.status(422).json({ success: false, error: "Name is required (min 2 characters)." });
    }
    if (!email?.trim() || !isValidEmail(email.trim())) {
      return res.status(422).json({ success: false, error: "A valid email address is required." });
    }
    if (!message?.trim() || message.trim().length < 10) {
      return res.status(422).json({ success: false, error: "Message is required (min 10 characters)." });
    }

    const cleanName    = name.trim();
    const cleanEmail   = email.trim().toLowerCase();
    const cleanCompany = company?.trim() || null;
    const cleanMessage = message.trim();

    // 1. Persist in DB
    await prisma.contactMessage.create({
      data: {
        name:    cleanName,
        email:   cleanEmail,
        company: cleanCompany,
        message: cleanMessage,
      },
    });

    // 2. Notify superadmin (fire-and-forget — never block the response)
    const superadmin = await prisma.user.findFirst({
      where:  { isSuperadmin: true },
      select: { email: true },
    });

    if (superadmin?.email) {
      sendMail({
        to: superadmin.email,
        ...buildAdminNotificationEmail({ name: cleanName, email: cleanEmail, company: cleanCompany, message: cleanMessage }),
      }).catch(console.error);
    }

    return res.status(201).json({
      success: true,
      message: "Your message has been sent. We will get back to you shortly.",
    });
  } catch (e) {
    next(e);
  }
};
