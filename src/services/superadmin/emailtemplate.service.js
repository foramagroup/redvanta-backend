
import prisma from "../../config/database.js";
import { buildWelcomeEmail as hardcodedWelcome } from "../../templates/superadmin/welcome.email.js";

// ─── Variables disponibles par slug ──────────────────────────
// Sert de documentation et de validation
export const TEMPLATE_VARIABLES = {
  welcome: {
    "{{customer_name}}":  "Nom de l'administrateur",
    "{{company_name}}":   "Nom de l'entreprise",
    "{{email}}":          "Adresse email de connexion",
    "{{password}}":       "Mot de passe temporaire généré",
    "{{login_url}}":      "URL de connexion à la plateforme",
    "{{primary_color}}":  "Couleur principale de la company",
    "{{year}}":           "Année courante",
  },
  review_request: {
    "{{customer_name}}":  "Nom du client",
    "{{company_name}}":   "Nom de l'entreprise",
    "{{review_url}}":     "URL de la page d'avis",
    "{{location_name}}":  "Nom de l'emplacement",
  },
  password_reset: {
    "{{customer_name}}":  "Nom de l'utilisateur",
    "{{reset_url}}":      "URL de réinitialisation",
    "{{expiry_minutes}}": "Durée de validité en minutes",
  },
  invoice: {
    "{{customer_name}}":  "Nom du client",
    "{{company_name}}":   "Nom de l'entreprise",
    "{{invoice_number}}": "Numéro de facture",
    "{{amount}}":         "Montant",
    "{{due_date}}":       "Date d'échéance",
  },
};

// ─── Résoudre les variables dans un string ───────────────────
// "Bonjour {{customer_name}}" + { customer_name: "Jean" }
// → "Bonjour Jean"
export function resolveVariables(template, variables = {}) {
  if (!template) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    // Chercher avec et sans underscore ({{customer_name}} → variables.customer_name)
    return variables[key] ?? variables[key.replace(/_/g, "")] ?? match;
  });
}

// ─── Chercher le languageId par défaut (langue "active" + isDefault) ─
async function getDefaultLanguageId() {
  const lang = await prisma.language.findFirst({
    where: { isDefault: true, status: "Active" },
    select: { id: true },
  });
  // Fallback : première langue active
  if (!lang) {
    const fallback = await prisma.language.findFirst({
      where: { status: "Active" },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    return fallback?.id ?? 1;
  }
  return lang.id;
}

// ─── Charger une traduction de template ──────────────────────
// slug     : "welcome", "review_request", etc.
// langId   : ID de la langue (optionnel — fallback langue par défaut puis EN)
// variables: objet de substitution { customer_name, company_name, ... }
export async function loadTemplate(slug, variables = {}, langId = null) {
  // 1. Récupérer le template avec ses traductions disponibles
  const template = await prisma.emailTemplate.findUnique({
    where:   { slug },
    include: { translations: { include: { language: true } } },
  });

  if (!template || !template.active) {
    console.warn(`[emailTemplate] Template "${slug}" introuvable ou inactif → fallback hardcodé`);
    return null; // → le caller utilisera le fallback hardcodé
  }

  if (!template.translations.length) {
    console.warn(`[emailTemplate] Template "${slug}" n'a aucune traduction → fallback hardcodé`);
    return null;
  }

  // 2. Trouver la traduction dans la langue demandée
  let translation = null;

  if (langId) {
    translation = template.translations.find((t) => t.languageId === langId) ?? null;
  }

  // 3. Fallback 1 : langue par défaut du système
  if (!translation) {
    const defaultLangId = await getDefaultLanguageId();
    translation = template.translations.find((t) => t.languageId === defaultLangId) ?? null;
  }

  // 4. Fallback 2 : première traduction disponible (souvent EN)
  if (!translation) {
    translation = template.translations[0];
  }

  // 5. Résoudre les variables dans subject et body
  const resolvedSubject = resolveVariables(translation.subject, variables);
  const resolvedBody    = resolveVariables(translation.body,    variables);

  return {
    subject:    resolvedSubject,
    html:       resolvedBody,
    text:       stripHtml(resolvedBody),
    templateId: template.id,
    languageId: translation.languageId,
    langCode:   translation.language?.code ?? "en",
  };
}

// ─── Utilitaire : strip HTML pour la version texte ───────────
function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi,      "\n")
    .replace(/<\/div>/gi,    "\n")
    .replace(/<[^>]+>/g,     "")
    .replace(/&nbsp;/g,      " ")
    .replace(/&amp;/g,       "&")
    .replace(/&lt;/g,        "<")
    .replace(/&gt;/g,        ">")
    .replace(/\n{3,}/g,      "\n\n")
    .trim();
}

// ─── Fonction principale : email de bienvenue ─────────────────
// Essaie d'abord la DB, sinon utilise le template hardcodé
export async function buildWelcomeEmailFromTemplate(params, langId = null) {
  const {
    companyName,
    adminName,
    email,
    password,
    loginUrl,
    primaryColor = "#E10600",
  } = params;

  const variables = {
    customer_name: adminName,
    company_name:  companyName,
    email,
    password,
    login_url:     loginUrl,
    primary_color: primaryColor,
    year:          new Date().getFullYear().toString(),
  };

  // Tenter de charger depuis la DB
  const dbTemplate = await loadTemplate("welcome", variables, langId);

  if (dbTemplate) {
    console.log(`[emailTemplate] Template "welcome" chargé depuis DB (lang: ${dbTemplate.langCode})`);
    return {
      subject: dbTemplate.subject,
      html:    dbTemplate.html,
      text:    dbTemplate.text,
    };
  }

  // Fallback : template hardcodé
  console.log(`[emailTemplate] Utilisation du template "welcome" hardcodé`);
  return hardcodedWelcome(params);
}