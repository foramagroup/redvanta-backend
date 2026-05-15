
import nodemailer from "nodemailer";
import prisma     from "../../config/database.js";
import  SettingService  from '../../services/superadmin/settingService.js';
import { getEmailFallback } from "../../i18n/emailFallbacks.js";
const appName = await SettingService.getCompanyName();


function createTransporter() {
  const encryption = (process.env.MAIL_SECURE).toLowerCase();
  const host = process.env.MAIL_HOST || "sandbox.smtp.mailtrap.io";
  const port = parseInt(process.env.MAIL_PORT || "2525");
  const user = process.env.MAIL_USER || "5bdf74304b82af";
  const pass = process.env.MAIL_PASS || "e68a51f3c6efdc";
  return nodemailer.createTransport({
    host,
    port,
    secure: encryption === "true",
    auth: {
      user,
      pass,
    },
  });
}

// ─── Envoi générique ──────────────────────────────────────────

export async function sendMail({ to, subject, html, text, attachments = [] }) {
  const transporter = createTransporter();
  const info = await transporter.sendMail({
    from: `"${appName || "OPINOOR"}" <${process.env.MAIL_FROM_ADDRESS || process.env.MAIL_FROM || "no-reply@opinoor.com"}>`,
    to,
    subject,
    html,
    text,
    ...(attachments.length > 0 && { attachments }),
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

// ─── Résoudre la langue d'une company ────────────────────────
// Priorité : defaultLanguageId de la company → langue "en" → langue système par défaut.
export async function resolveCompanyLangId(companyId) {
  if (companyId) {
    const company = await prisma.company.findUnique({
      where:  { id: companyId },
      select: { defaultLanguageId: true },
    });
    if (company?.defaultLanguageId) return company.defaultLanguageId;
  }
  // Fallback : langue "en" active
  const en = await prisma.language.findFirst({
    where:  { code: "en", status: "Active" },
    select: { id: true },
  });
  return en?.id ?? null; // null → getDefaultLangId() prendra le relais
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

// ─── Envoyer un email avec template DB + fallback i18n + fallback hardcodé ───
//
// slug         : slug du template dans la table email_templates
// variables    : objet de substitution { customer_name, company_name, ... }
// to           : adresse du destinataire
// langId       : ID de la langue préférée (optionnel)
// langCode     : code de la langue ("fr","en","ro") — si absent, résolu depuis langId
// fallbackFn   : fonction () => { subject, html, text } si aucun template trouvé

export async function sendTemplatedMail({ slug, variables = {}, to, langId = null, langCode = null, fallbackFn = null, attachments = [] }) {
  // 1. Essayer le template en DB
  let payload = await loadTemplate(slug, variables, langId);

  // 2. Fallback fichier i18n (traduit selon la langue de la company)
  if (!payload) {
    let code = langCode;
    if (!code && langId) {
      const lang = await prisma.language.findUnique({ where: { id: langId }, select: { code: true } });
      code = lang?.code ?? "en";
    }
    code = code ?? "en";

    const fileFallback = getEmailFallback(slug, code, variables);
    if (fileFallback) {
      console.log(`[mail] Template "${slug}" absent en DB → i18n fichier (${code})`);
      payload = fileFallback;
    }
  }

  // 3. Fallback hardcodé (dernière option, toujours en anglais)
  if (!payload) {
    if (typeof fallbackFn === "function") {
      console.log(`[mail] Template "${slug}" → fallback hardcodé`);
      payload = fallbackFn();
    } else {
      console.warn(`[mail] Template "${slug}" absent en DB et pas de fallback fourni`);
      return null;
    }
  }

  return sendMail({ to, ...payload, attachments });
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
