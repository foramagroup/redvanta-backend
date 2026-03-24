
import nodemailer from "nodemailer";
import prisma     from "../../config/database.js";


function createTransporter() {
  const encryption = (process.env.SMTP_SECURE || process.env.MAIL_SECURE || process.env.MAIL_ENCRYPTION || "").toLowerCase();
  const host = process.env.MAIL_HOST || process.env.SMTP_HOST || "sandbox.smtp.mailtrap.io";
  const port = parseInt(process.env.MAIL_PORT || process.env.SMTP_PORT || "2525");
  const user = process.env.MAIL_USERNAME || process.env.MAIL_USER || process.env.SMTP_USER;
  const pass = process.env.MAIL_PASSWORD || process.env.MAIL_PASS || process.env.SMTP_PASS;
  return nodemailer.createTransport({
    host,
    port,
    secure: encryption === "true" || encryption === "ssl",
    auth: {
      user,
      pass,
    },
  });
}

// ─── Envoi générique ──────────────────────────────────────────

export async function sendMail({ to, subject, html, text }) {
  const transporter = createTransporter();
  const info = await transporter.sendMail({
    from: `"${process.env.MAIL_FROM_NAME || "REDVANTA"}" <${process.env.MAIL_FROM_ADDRESS || process.env.MAIL_FROM || "no-reply@redvanta.com"}>`,
    to,
    subject,
    html,
    text,
  });
  console.log(`[mail] Envoyé à ${to} — messageId: ${info.messageId}`);
  return info;
}

// ─── Résoudre les variables {{...}} dans un string ───────────

function resolveVariables(template, variables = {}) {
  if (!template) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] ?? match;
  });
}

// ─── Strip HTML → texte brut ─────────────────────────────────

function stripHtml(html = "") {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Chercher la langue par défaut ───────────────────────────

async function getDefaultLangId() {
  const lang = await prisma.language.findFirst({
    where:   { isDefault: true, status: "Active" },
    select:  { id: true },
  });
  if (lang) return lang.id;
  // Fallback : première langue active
  const fallback = await prisma.language.findFirst({
    where:  { status: "Active" },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  return fallback?.id ?? 1;
}

// ─── Charger un template depuis la DB ────────────────────────
// slug      : "welcome", "confirm_email", "review_request"...
// variables : { customer_name, company_name, confirm_url, ... }
// langId    : ID de la langue souhaitée (optionnel)
// Retourne  : { subject, html, text } ou null si template absent/inactif

export async function loadTemplate(slug, variables = {}, langId = null) {
  const template = await prisma.emailTemplate.findUnique({
    where:   { slug },
    include: {
      translations: {
        include: { language: true },
      },
    },
  });

  if (!template || !template.active || !template.translations.length) {
    return null;
  }

  // Priorité 1 : langue demandée
  let translation = langId
    ? template.translations.find((t) => t.languageId === langId) ?? null
    : null;

  // Priorité 2 : langue par défaut du système
  if (!translation) {
    const defaultLangId = await getDefaultLangId();
    translation = template.translations.find((t) => t.languageId === defaultLangId) ?? null;
  }

  // Priorité 3 : première traduction disponible
  if (!translation) {
    translation = template.translations[0];
  }

  const subject = resolveVariables(translation.subject, variables);
  const html    = resolveVariables(translation.body,    variables);

  return { subject, html, text: stripHtml(html) };
}

// ─── Envoyer un email avec template DB + fallback hardcodé ───
//
// slug         : slug du template dans la table email_templates
// variables    : objet de substitution { customer_name, company_name, ... }
// to           : adresse du destinataire
// langId       : langue préférée (optionnel)
// fallbackFn   : fonction () => { subject, html, text } si template DB absent

export async function sendTemplatedMail({ slug, variables = {}, to, langId = null, fallbackFn = null }) {
  // 1. Essayer la DB
  let payload = await loadTemplate(slug, variables, langId);

  // 2. Fallback hardcodé
  if (!payload) {
    if (typeof fallbackFn === "function") {
      console.log(`[mail] Template "${slug}" absent en DB → fallback hardcodé`);
      payload = fallbackFn();
    } else {
      console.warn(`[mail] Template "${slug}" absent en DB et pas de fallback fourni`);
      return null;
    }
  }

  return sendMail({ to, ...payload });
}

// ─── Exemples d'utilisation dans les controllers ─────────────
//
// 1. Email de confirmation (signup client)
//
//    import { buildConfirmEmailTemplate } from "../templates/confirmEmail.template.js";
//
//    await sendTemplatedMail({
//      slug:      "confirm_email",
//      to:        email,
//      langId:    defaultLangId,
//      variables: {
//        customer_name: companyName,
//        company_name:  companyName,
//        confirm_url:   confirmUrl,
//        expires_hours: "48",
//        year:          new Date().getFullYear().toString(),
//      },
//      fallbackFn: () => buildConfirmEmailTemplate({
//        name:        companyName,
//        companyName,
//        confirmUrl,
//        expiresHours: 48,
//      }),
//    });
//
// 2. Email de bienvenue (créé par superadmin)
//
//    import { buildWelcomeEmail } from "../templates/welcome.email.js";
//
//    await sendTemplatedMail({
//      slug:      "welcome",
//      to:        adminEmail,
//      langId:    body.defaultLanguageId,
//      variables: {
//        customer_name:  adminName,
//        company_name:   companyName,
//        email:          adminEmail,
//        password:       plainPassword,
//        login_url:      loginUrl,
//        primary_color:  primaryColor,
//        year:           new Date().getFullYear().toString(),
//      },
//      fallbackFn: () => buildWelcomeEmail({
//        companyName, adminName, email: adminEmail,
//        password: plainPassword, loginUrl, primaryColor,
//      }),
//    });
